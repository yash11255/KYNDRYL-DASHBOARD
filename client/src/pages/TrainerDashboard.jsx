import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getCurrentPosition } from '../utils/geo';

const fmtDate = (d) => {
  const date = new Date(d);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = Math.floor((date - now) / 86400000);
  const label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return { label, full: date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }), isToday: diff === 0 };
};

/* SVG icons */
const Icon = ({ d, size = 15 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

const ICONS = {
  map:      'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10m-3 0a3 3 0 116 0 3 3 0 01-6 0',
  car:      'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v5M16 17H9m7 0a2 2 0 100-4 2 2 0 000 4M5 17a2 2 0 100-4 2 2 0 000 4',
  check:    'M5 13l4 4L19 7',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  user:     'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  play:     'M5 3l14 9-14 9V3z',
  hotel:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  rupee:    'M6 3h12M6 8h12m-7 13l-5-5 5-5M13 3a5 5 0 010 10H6',
};

const StatusBadge = ({ status }) => {
  const map = {
    scheduled:     { bg: '#dde6f5', color: 'var(--bharat-navy)' },
    completed:     { bg: '#d1fae5', color: '#065f46' },
    'in-progress': { bg: '#fef3c7', color: '#78350f' },
  };
  const s = map[status] || { bg: 'var(--c-10)', color: 'var(--c-60)' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', background: s.bg, color: s.color }}>
      {status === 'in-progress' ? 'In Progress' : status}
    </span>
  );
};

const JourneyBar = ({ status, km }) => {
  const map = {
    not_started: null,
    travelling:  { color: '#f1c21b', label: 'Travelling to school' },
    arrived:     { color: 'var(--kyndryl-green)', label: km ? `Arrived · ${km} km from base` : 'Arrived at school' },
  };
  const s = map[status];
  if (!s) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: s.color + '18', borderLeft: `3px solid ${s.color}`, marginTop: 12 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
    </div>
  );
};

export default function TrainerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments,   setAssignments]   = useState([]);
  const [sessions,      setSessions]      = useState([]);
  const [journeyState,  setJourneyState]  = useState({});
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([api.get('/sessions/my-assignments'), api.get('/sessions/my-sessions')])
      .then(([a, s]) => {
        setAssignments(a.data);
        setSessions(s.data);
        const jState = {};
        s.data.forEach(sess => { if (sess.journey) jState[sess._id] = sess.journey; });
        setJourneyState(jState);
      }).finally(() => setLoading(false));
  }, []);

  const upcoming        = assignments.filter(a => new Date(a.date) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const todayAssignment = upcoming.find(a => fmtDate(a.date).isToday);
  const getSession      = (assignmentId) => sessions.find(s => s.assignment === assignmentId || s.assignment?._id === assignmentId);

  const startSession = async (assignment) => {
    const { data } = await api.get(`/sessions/for-assignment/${assignment._id}`);
    navigate(`/trainer/session/${data.session._id}`);
  };

  const startJourney = async (assignment) => {
    try {
      toast('Getting your location…');
      const pos = await getCurrentPosition();
      const { data } = await api.get(`/sessions/for-assignment/${assignment._id}`);
      const sessionId = data.session._id;
      await api.put(`/sessions/${sessionId}/journey/start`, {
        latitude: pos.latitude, longitude: pos.longitude,
        locationName: `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`,
      });
      setJourneyState(prev => ({ ...prev, [sessionId]: { status: 'travelling', startedAt: new Date() } }));
      toast.success('Journey started! Drive safe.');
      const school = assignment.school;
      if (school.latitude && school.longitude) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${school.latitude},${school.longitude}&travelmode=driving`, '_blank');
      } else if (school.googleMapsLink) {
        window.open(school.googleMapsLink, '_blank');
      }
    } catch (e) { toast.error('Could not start journey: ' + (e.message || 'GPS error')); }
  };

  const markArrived = async (assignment) => {
    try {
      const pos = await getCurrentPosition();
      const { data } = await api.get(`/sessions/for-assignment/${assignment._id}`);
      const sessionId = data.session._id;
      const result = await api.put(`/sessions/${sessionId}/journey/arrive`, {
        latitude: pos.latitude, longitude: pos.longitude,
        locationName: `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`,
      });
      setJourneyState(prev => ({ ...prev, [sessionId]: result.data.journey }));
      const km = result.data.journey?.kmFromBase;
      toast.success(km ? `Arrived! Distance: ${km} km` : 'Arrival recorded!');
    } catch { toast.error('Could not mark arrival'); }
  };

  const whatsappLink = (school, date) => {
    if (!school.spokeWhatsAppLink) return null;
    const d = new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = encodeURIComponent(`Hello ${school.spokeContactName || 'there'}, I am ${user?.name} from Kyndryl AI Pathshala. I am scheduled to conduct a session at ${school.name} on ${d}. Please confirm the arrangements. Thank you!`);
    return `${school.spokeWhatsAppLink}?text=${msg}`;
  };

  if (loading) return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 48 }}>
      <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="var(--c-40)" strokeWidth="2" style={{ width: 24, height: 24, margin: '0 auto 12px', display: 'block' }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <p style={{ color: 'var(--text-helper)', fontSize: 13 }}>Loading your schedule…</p>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', margin: 0, letterSpacing: '-.01em' }}>
            Hi, <strong style={{ fontWeight: 700 }}>{user?.name?.split(' ')[0]}</strong>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>
            {user?.role === 'reviewer' ? 'Your observation assignments' : 'Your AI Pathshala schedule'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/trainer/basestay')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon d={ICONS.hotel} size={13} /> Base Stay
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/trainer/expenses')} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon d={ICONS.rupee} size={13} /> Expenses
          </button>
        </div>
      </div>

      {/* ── Today's session card ── */}
      {todayAssignment ? (() => {
        const sess = getSession(todayAssignment._id);
        const jData = sess ? (journeyState[sess._id] || sess.journey) : null;
        const jStatus = jData?.status || 'not_started';
        const wa = whatsappLink(todayAssignment.school, todayAssignment.date);
        return (
          <div style={{ background: 'var(--bharat-navy)', borderLeft: '4px solid var(--kyndryl-green)', padding: '20px', marginBottom: 20, color: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.55)', marginBottom: 8 }}>
              {user?.role === 'reviewer' ? "Today's Observation" : "Today's Session"}
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>{todayAssignment.school.name}</h2>
            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, marginBottom: 4 }}>
              {todayAssignment.school.district} · {todayAssignment.school.block}
            </div>
            {todayAssignment.school.address && (
              <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginBottom: 8 }}>{todayAssignment.school.address}</div>
            )}

            {/* Spoke info */}
            {todayAssignment.school.spokeContactName && (
              <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,.1)', borderLeft: '2px solid rgba(255,255,255,.25)', marginTop: 10, marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
                  Spoke: <strong style={{ color: '#fff' }}>{todayAssignment.school.spokeContactName}</strong>
                  {todayAssignment.school.spokeContactPhone && (
                    <span style={{ marginLeft: 8, fontFamily: "'IBM Plex Mono',monospace" }}>{todayAssignment.school.spokeContactPhone}</span>
                  )}
                </div>
              </div>
            )}

            {/* Journey status */}
            <JourneyBar status={jStatus} km={jData?.kmFromBase} />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#25d366', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Message Spoke
                </a>
              )}
              {todayAssignment.school.googleMapsLink && (
                <a href={todayAssignment.school.googleMapsLink} target="_blank" rel="noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'rgba(255,255,255,.12)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none', border: '1px solid rgba(255,255,255,.2)' }}>
                  <Icon d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10m-3 0a3 3 0 116 0 3 3 0 01-6 0" size={13} />
                  School Map
                </a>
              )}
              {user?.role !== 'reviewer' && (() => {
                if (jStatus === 'not_started')
                  return (
                    <button onClick={() => startJourney(todayAssignment)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: '#f1c21b', color: '#1a1a1a', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                      <Icon d={ICONS.car} size={13} /> Start Journey
                    </button>
                  );
                if (jStatus === 'travelling')
                  return (
                    <button onClick={() => markArrived(todayAssignment)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'var(--kyndryl-green)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
                      <Icon d={ICONS.check} size={13} /> I've Arrived
                    </button>
                  );
                return null;
              })()}
              <button onClick={() => startSession(todayAssignment)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--bharat-orange)', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
                <Icon d={ICONS.play} size={13} />
                {user?.role === 'reviewer' ? 'Open Review' : 'Start Session'}
              </button>
            </div>

            {/* Principal info */}
            {todayAssignment.school.principalName && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,.45)', fontFamily: "'IBM Plex Mono',monospace" }}>
                Principal: {todayAssignment.school.principalName}
                {todayAssignment.school.principalPhone && ` · ${todayAssignment.school.principalPhone}`}
              </div>
            )}
          </div>
        );
      })() : (
        <div style={{ padding: '16px 20px', background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--c-30)', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No session scheduled for today</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Check your upcoming assignments below.</div>
        </div>
      )}

      {/* ── Upcoming assignments ── */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-helper)', marginBottom: 12 }}>Upcoming Assignments</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {upcoming.map((a, i) => {
              const d = fmtDate(a.date);
              const wa = whatsappLink(a.school, a.date);
              return (
                <div key={a._id} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: i < upcoming.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
                  {/* Date badge */}
                  <div style={{ minWidth: 52, background: d.isToday ? 'var(--bharat-navy)' : 'var(--c-10)', border: d.isToday ? 'none' : '1px solid var(--border)', padding: '6px 4px', textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? 'rgba(255,255,255,.65)' : 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{d.label}</div>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.school.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.school.district} · {a.school.block}</div>
                    {a.topic && <div style={{ fontSize: 12, color: 'var(--bharat-orange)', marginTop: 2, fontWeight: 500 }}>{a.topic}</div>}
                    {a.school.spokeContactName && <div style={{ fontSize: 12, color: 'var(--text-helper)', marginTop: 2 }}>Spoke: {a.school.spokeContactName}</div>}
                    {a.reviewer && <div style={{ fontSize: 11, color: '#92400e', marginTop: 3, fontWeight: 500 }}>Reviewer: {a.reviewer.name}</div>}
                    {/* Links row */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                      {a.school.googleMapsLink && (
                        <a href={a.school.googleMapsLink} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600, borderBottom: '1px solid var(--blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          Map ↗
                        </a>
                      )}
                      {wa && (
                        <a href={wa} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: '#25d366', fontWeight: 600, borderBottom: '1px solid #25d366', textDecoration: 'none' }}>
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Right */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <StatusBadge status={a.status} />
                    {d.isToday && a.status === 'scheduled' && (
                      <button className="btn btn-primary btn-sm" onClick={() => startSession(a)}>Start</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Recent sessions ── */}
      {sessions.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-helper)', marginBottom: 12 }}>Recent Sessions</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {sessions.slice(0, 5).map((s, i) => (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < 4 ? '1px solid var(--c-10)' : 'none', borderLeft: `3px solid ${s.status === 'submitted' ? 'var(--kyndryl-green)' : '#f1c21b'}`, gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.school?.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {new Date(s.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {s.students?.total ? ` · ${s.students.total} students` : ''}
                    {s.journey?.kmFromBase ? ` · ${s.journey.kmFromBase} km` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <span className={`badge ${s.status === 'submitted' ? 'badge-green' : s.status === 'in-progress' ? 'badge-yellow' : 'badge-gray'}`}>{s.status}</span>
                  {s.status !== 'submitted' && (
                    <button className="btn btn-outline btn-sm" onClick={() => navigate(`/trainer/session/${s._id}`)}>Continue</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!upcoming.length && !sessions.length && (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40, margin: '0 auto 14px', display: 'block' }}>
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>No assignments yet. Your coordinator will assign sessions soon.</p>
        </div>
      )}
    </div>
  );
}
