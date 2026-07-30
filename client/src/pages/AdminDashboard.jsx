import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const SERVER = 'http://localhost:5001';
const imgUrl = fn => fn ? `${SERVER}/uploads/${fn}` : null;
const fmtDate = d => !d ? '' : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const KPI = ({ value, label, accent, icon, sub }) => (
  <div style={{ background: 'var(--surface)', padding: '18px 20px', borderTop: `3px solid ${accent}`, flex: '1 1 180px', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-helper)' }}>{label}</div>
      <div style={{ width: 28, height: 28, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.75" strokeLinecap="round" style={{ width: 15, height: 15 }}>
          <path d={icon} />
        </svg>
      </div>
    </div>
    <div style={{ fontSize: 30, fontWeight: 300, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-helper)', marginTop: 5 }}>{sub}</div>}
  </div>
);

const STATUS_MAP = {
  submitted:     { cls: 'badge-green',  label: 'Submitted' },
  'in-progress': { cls: 'badge-yellow', label: 'In Progress' },
  draft:         { cls: 'badge-gray',   label: 'Draft' },
  reviewed:      { cls: 'badge-blue',   label: 'Reviewed' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || { cls: 'badge-gray', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const QuickLink = ({ to, label, icon }) => (
  <Link to={to} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500, transition: 'color .15s' }}
    onMouseEnter={e => e.currentTarget.style.color = 'var(--bharat-navy)'}
    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-primary)'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{ width: 15, height: 15, color: 'var(--c-40)', flexShrink: 0 }}>
      <path d={icon} />
    </svg>
    {label}
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12, marginLeft: 'auto', color: 'var(--c-40)', flexShrink: 0 }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  </Link>
);

/* ── Photo Carousel ── */
function PhotoCarousel({ slides }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);

  const advance = useCallback(() => setIdx(i => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    if (!slides.length || paused) return;
    timer.current = setInterval(advance, 4500);
    return () => clearInterval(timer.current);
  }, [advance, paused, slides.length]);

  if (!slides.length) return null;

  const slide = slides[idx];

  return (
    <div style={{ background: 'var(--c-100)', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>

      {/* Main image */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '46%', background: '#0a0a0a', overflow: 'hidden' }}>
        <img
          key={slide.src}
          src={slide.src}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .9, transition: 'opacity .5s' }}
          onError={e => { e.target.style.opacity = 0; }}
        />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(22,22,22,.95) 0%, rgba(22,22,22,.3) 50%, transparent 100%)' }} />

        {/* Caption */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{slide.school}</div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {slide.trainer && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>
                    {slide.trainer}
                  </span>
                )}
                {slide.date && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {slide.date}
                  </span>
                )}
                {slide.location && (
                  <span style={{ fontSize: 12, color: 'var(--kyndryl-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {slide.location}
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: "'IBM Plex Mono',monospace", flexShrink: 0 }}>
              {idx + 1} / {slides.length}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + slides.length) % slides.length)}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: 16 }}>
            ‹
          </button>
          <button onClick={() => setIdx(i => (i + 1) % slides.length)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: 16 }}>
            ›
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      <div style={{ display: 'flex', gap: 2, padding: '2px', background: 'var(--c-100)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {slides.map((s, i) => (
          <button key={i} onClick={() => setIdx(i)}
            style={{ flexShrink: 0, width: 56, height: 40, padding: 0, border: i === idx ? '2px solid var(--kyndryl-green)' : '2px solid transparent', background: 'var(--c-80)', cursor: 'pointer', overflow: 'hidden', opacity: i === idx ? 1 : 0.5, transition: 'opacity .2s, border-color .2s' }}>
            <img src={s.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--c-80)' }}>
        <div style={{ height: '100%', background: 'var(--kyndryl-green)', width: `${((idx + 1) / slides.length) * 100}%`, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

/* ── Info card ── */
const InfoCard = ({ icon, title, value, sub, accent }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
    <div style={{ width: 36, height: 36, background: accent + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.75" style={{ width: 18, height: 18 }}>
        <path d={icon} />
      </svg>
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-helper)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

/* ══════════ MAIN ══════════ */
export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([api.get('/admin/stats'), api.get('/admin/sessions')])
      .then(([sRes, sessRes]) => { setStats(sRes.data); setSessions(sessRes.data || []); })
      .finally(() => setLoading(false));
  }, []);

  /* Build carousel slides from recent session photos */
  const slides = (() => {
    const out = [];
    const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const s of sorted) {
      const school  = s.school?.name || '';
      const trainer = s.trainer?.name || '';
      const date    = fmtDate(s.date);
      const allPh   = [
        ...(s.checkIn?.photo?.filename ? [{ filename: s.checkIn.photo.filename, location: s.checkIn?.locationName || '' }] : []),
        ...(s.sessionPhotos || []).map(p => ({ filename: p.filename, url: p.url, location: p.locationName || '' })),
      ];
      for (const p of allPh) {
        const src = p.url || imgUrl(p.filename);
        if (src) out.push({ src, school, trainer, date, location: p.location });
        if (out.length >= 18) break;
      }
      if (out.length >= 18) break;
    }
    return out;
  })();

  /* District breakdown */
  const districts = (() => {
    const map = {};
    for (const s of sessions) {
      const d = s.school?.district;
      if (d) { map[d] = (map[d] || 0) + 1; }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  })();

  const completionRate = sessions.length
    ? Math.round((sessions.filter(s => s.status === 'submitted').length / sessions.length) * 100)
    : 0;

  const avgStudents = sessions.length
    ? Math.round(sessions.reduce((s, x) => s + (x.students?.total || 0), 0) / sessions.length)
    : 0;

  if (loading) return (
    <div className="page" style={{ paddingTop: 48, textAlign: 'center' }}>
      <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="var(--c-40)" strokeWidth="2" style={{ width: 24, height: 24, margin: '0 auto 12px', display: 'block' }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <p style={{ color: 'var(--text-helper)', fontSize: 13 }}>Loading dashboard…</p>
    </div>
  );

  return (
    <div className="page" style={{ padding: '20px 24px 60px', maxWidth: 1400 }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">AI Pathshala Field Operations — real-time overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/admin/sessions" className="btn btn-ghost btn-sm">View Reports</Link>
          <Link to="/admin/assignments" className="btn btn-primary btn-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M12 5v14M5 12h14" /></svg>
            New Assignment
          </Link>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="dash-kpi-strip" style={{ display: 'flex', gap: 1, background: 'var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        <KPI
          value={stats?.trainers || 0}
          label="Active Trainers"
          accent="#0f2d6b"
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
        <KPI
          value={stats?.schools || 0}
          label="Partner Schools"
          accent="#F4622A"
          icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
        <KPI
          value={stats?.sessionsTotal || 0}
          label="Sessions Submitted"
          accent="#00c73c"
          sub={`${completionRate}% completion`}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 3h6M9 14h4"
        />
        <KPI
          value={stats?.totalStudents?.toLocaleString('en-IN') || 0}
          label="Students Reached"
          accent="#8B5CF6"
          sub={`avg ${avgStudents.toLocaleString('en-IN')} per session`}
          icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </div>

      {/* ── Photo Carousel + Info cards row ── */}
      {slides.length > 0 && (
        <div className="dash-carousel-grid">
          <PhotoCarousel slides={slides} />

          {/* Info cards column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
            <InfoCard
              icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              title="This Month"
              value={`${stats?.sessionsMonth || 0} sessions`}
              sub="active field operations"
              accent="var(--kyndryl-green)"
            />
            <InfoCard
              icon="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              title="Field Photos"
              value={`${slides.length}`}
              sub="verified geo-tagged images"
              accent="var(--bharat-orange)"
            />
            <InfoCard
              icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              title="Completion Rate"
              value={`${completionRate}%`}
              sub="sessions fully submitted"
              accent="var(--bharat-navy)"
            />

            {/* District breakdown */}
            {districts.length > 0 && (
              <div style={{ background: 'var(--surface)', padding: '16px', flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-helper)', marginBottom: 12 }}>
                  District Coverage
                </div>
                {districts.map(([d, count]) => {
                  const max = districts[0][1];
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={d} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{d}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-helper)', fontFamily: "'IBM Plex Mono',monospace" }}>{count}</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--c-20)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--bharat-navy)', width: `${pct}%`, transition: 'width .5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main two-panel ── */}
      <div className="dash-main-grid">

        {/* Recent sessions */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-header" style={{ padding: '14px 20px', margin: 0 }}>
            <span className="card-title">Recent Sessions</span>
            <Link to="/admin/sessions" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>View all →</Link>
          </div>

          {stats?.recentSessions?.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['School', 'Trainer', 'District', 'Date', 'Status'].map(h => (
                      <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.07em', background: 'var(--c-10)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSessions.map((s, i) => (
                    <tr key={s._id} style={{ background: i % 2 ? 'rgba(244,244,244,.5)' : '#fff', borderTop: '1px solid var(--c-10)' }}>
                      <td style={{ padding: '10px 16px', fontWeight: 600, fontSize: 13 }}>{s.school?.name}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>{s.trainer?.name}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontSize: 12 }}>{s.school?.district}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-helper)', fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                      <td style={{ padding: '10px 16px' }}><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty"><p>No sessions recorded yet</p></div>
          )}
        </div>

        {/* Quick actions + metric */}
        <div className="card" style={{ borderLeft: 'none', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ marginBottom: 0 }}>
            <span className="card-title">Quick Actions</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <QuickLink to="/admin/hierarchy"   label="Manage Team"       icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            <QuickLink to="/admin/schools"     label="School Directory"  icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            <QuickLink to="/admin/assignments" label="Schedule Sessions" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            <QuickLink to="/admin/sessions"    label="All Reports"       icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            <QuickLink to="/admin/audit"       label="Audit Logs"        icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </div>

          {/* This month block */}
          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <div style={{ padding: '14px 16px', background: 'var(--bharat-navy)', borderLeft: '3px solid var(--kyndryl-green)' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>This Month</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                {stats?.sessionsMonth || 0}
                <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 6, opacity: .65 }}>sessions</span>
              </div>
            </div>

            {/* ATL breakdown */}
            {sessions.length > 0 && (() => {
              const atlYes = sessions.filter(s => s.atlLabStatus === 'YES').length;
              const atlNo  = sessions.filter(s => s.atlLabStatus === 'NO').length;
              const total  = sessions.length;
              return (
                <div style={{ padding: '12px 16px', background: 'var(--c-10)', borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginBottom: 10 }}>ATL Lab Status</div>
                  <div style={{ display: 'flex', gap: 2, height: 8, marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ flex: atlYes, background: 'var(--kyndryl-green)', transition: 'flex .5s' }} />
                    <div style={{ flex: atlNo, background: 'var(--red)', transition: 'flex .5s' }} />
                    <div style={{ flex: total - atlYes - atlNo, background: 'var(--c-20)', transition: 'flex .5s' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                    <span style={{ color: 'var(--kyndryl-green)', fontWeight: 600 }}>{atlYes} YES</span>
                    <span style={{ color: 'var(--red)', fontWeight: 600 }}>{atlNo} NO</span>
                    <span style={{ color: 'var(--text-helper)' }}>{total - atlYes - atlNo} N/A</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

    </div>
  );
}
