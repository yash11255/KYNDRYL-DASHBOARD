import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const stepCompletion = (s) => {
  const steps = [s.checkIn?.time, s.sessionPhotos?.length, s.students?.total, s.assessment?.submitted, s.acknowledgment?.uploaded, s.travel?.baseLocation, s.checklist];
  const done = steps.filter(Boolean).length;
  return { done, total: steps.length, pct: Math.round(done / steps.length * 100) };
};

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const isToday = d => new Date(d).toDateString() === new Date().toDateString();
const isYesterday = d => { const y = new Date(); y.setDate(y.getDate() - 1); return new Date(d).toDateString() === y.toDateString(); };

const STATUS_META = {
  submitted:     { dot: 'var(--kyndryl-green)', bg: '#d1fae5', color: '#065f46', label: 'Submitted' },
  'in-progress': { dot: '#f1c21b',             bg: '#fef3c7', color: '#78350f', label: 'In Progress' },
  draft:         { dot: 'var(--c-40)',          bg: 'var(--c-10)', color: 'var(--c-60)', label: 'Draft' },
};

const StatChip = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono',monospace" }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11, flexShrink: 0 }}>
      <path d={icon} />
    </svg>
    {label}
  </div>
);

const STAT_ICONS = {
  students: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  photos:   'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8',
  km:       'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v5M16 17H9m7 0a2 2 0 100-4 2 2 0 000 4M5 17a2 2 0 100-4 2 2 0 000 4',
  ack:      'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0',
};

export default function TrainerSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/sessions/my-sessions').then(r => setSessions(r.data)).finally(() => setLoading(false));
  }, []);

  const pending   = sessions.filter(s => s.status !== 'submitted').length;
  const submitted = sessions.filter(s => s.status === 'submitted').length;

  const filtered = sessions.filter(s => {
    if (filter === 'pending')   return s.status !== 'submitted';
    if (filter === 'submitted') return s.status === 'submitted';
    return true;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 14 }}>
      <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="var(--c-30)" strokeWidth="2" style={{ width: 24, height: 24 }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Loading sessions…</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-.01em' }}>
          My <strong style={{ fontWeight: 700 }}>Sessions</strong>
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: "'IBM Plex Mono',monospace" }}>
          {sessions.length} total · {pending} pending · {submitted} submitted
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--border)', marginBottom: 20 }}>
        {[
          { label: 'Total',     value: sessions.length, accent: 'var(--bharat-navy)' },
          { label: 'Pending',   value: pending,         accent: '#f1c21b' },
          { label: 'Submitted', value: submitted,       accent: 'var(--kyndryl-green)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--surface)', padding: '12px 14px', borderTop: `2px solid ${c.accent}`, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{c.value}</div>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginTop: 3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {[['all', 'All'], ['pending', 'Pending'], ['submitted', 'Submitted']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: filter === val ? 600 : 400,
              color: filter === val ? 'var(--bharat-navy)' : 'var(--text-secondary)',
              background: 'transparent', border: 'none', borderBottom: `2px solid ${filter === val ? 'var(--bharat-navy)' : 'transparent'}`,
              marginBottom: -1, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'color .15s, border-color .15s',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Session list ── */}
      {filtered.length === 0 ? (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 36, height: 36, margin: '0 auto 12px', display: 'block', opacity: .4 }}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p>No sessions found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
          {filtered.map(s => {
            const { done, total, pct } = stepCompletion(s);
            const meta = STATUS_META[s.status] || STATUS_META.draft;
            return (
              <div key={s._id}
                onClick={() => navigate(`/trainer/session/${s._id}`)}
                style={{ background: 'var(--surface)', padding: '16px', cursor: 'pointer', borderLeft: `3px solid ${meta.dot}`, transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-10)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}
              >
                {/* Date row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-helper)', fontFamily: "'IBM Plex Mono',monospace" }}>{fmtDate(s.date)}</span>
                  {isToday(s.date) && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--bharat-navy)', color: '#fff', padding: '2px 7px', letterSpacing: '.04em' }}>TODAY</span>}
                  {isYesterday(s.date) && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#78350f', padding: '2px 7px', letterSpacing: '.04em' }}>YESTERDAY</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, background: meta.bg, color: meta.color, padding: '2px 7px', letterSpacing: '.04em', marginLeft: 'auto' }}>{meta.label}</span>
                </div>

                {/* School */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--bharat-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.school?.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.school?.district}{s.school?.block ? ` · ${s.school.block}` : ''}</div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                      {s.students?.total > 0   && <StatChip icon={STAT_ICONS.students} label={`${s.students.total} students`} />}
                      {s.sessionPhotos?.length > 0 && <StatChip icon={STAT_ICONS.photos} label={`${s.sessionPhotos.length} photos`} />}
                      {s.travel?.kmTravelled > 0 && <StatChip icon={STAT_ICONS.km} label={`${s.travel.kmTravelled} km`} />}
                      {s.acknowledgment?.uploaded && <StatChip icon={STAT_ICONS.ack} label="Ack. done" />}
                    </div>
                  </div>

                  {/* Action button */}
                  <div style={{ flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/trainer/session/${s._id}`); }}
                      style={{
                        padding: '9px 14px', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        background: s.status === 'submitted' ? 'var(--c-10)' : 'var(--bharat-orange)',
                        color:      s.status === 'submitted' ? 'var(--text-secondary)' : '#fff',
                        fontFamily: 'inherit',
                      }}>
                      {s.status === 'submitted' ? 'Edit' : 'Continue'}
                    </button>
                    {s.driveFolderUrl && (
                      <a href={s.driveFolderUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ display: 'block', textAlign: 'right', fontSize: 11, color: 'var(--blue)', fontWeight: 600, textDecoration: 'none', marginTop: 6, borderBottom: '1px solid var(--blue)' }}>
                        Drive ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Progress bar (non-submitted only) */}
                {s.status !== 'submitted' && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-helper)', marginBottom: 5, fontFamily: "'IBM Plex Mono',monospace" }}>
                      <span>{done} of {total} steps complete</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--c-20)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--kyndryl-green)' : 'var(--bharat-orange)', transition: 'width .4s' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
