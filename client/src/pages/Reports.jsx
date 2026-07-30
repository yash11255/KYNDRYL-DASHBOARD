import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const SERVER = 'http://localhost:5001';
const imgUrl = fn => fn ? `${SERVER}/uploads/${fn}` : null;

const COLS = [
  { key: 'date',     label: 'Date',                     w: 82  },
  { key: 'time',     label: 'Time',                     w: 62  },
  { key: 'block',    label: 'Block',                    w: 105 },
  { key: 'school',   label: 'School Name',              w: 205 },
  { key: 'enroll',   label: 'Enroll.',                  w: 70  },
  { key: 'al',       label: 'Ack. Letter',              w: 148 },
  { key: 'ba',       label: 'Baseline Assess.',         w: 148 },
  { key: 'prena',    label: 'Attendance [Prena]',       w: 118 },
  { key: 'attDrive', label: 'Attendance (Drive)',       w: 118 },
  { key: 'photos',   label: 'Photographs',              w: 148 },
  { key: 'atl',      label: 'ATL Lab',                  w: 88  },
  { key: 'feedback', label: 'Feedback',                 w: 190 },
  { key: 'willing',  label: 'Teacher Training',         w: 100 },
];

const fmtDate  = d  => !d ? '' : new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }).replace(' ', '-');
const fmtTime  = t  => !t ? '' : new Date(t).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:false });
const fmtLong  = d  => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
const sameDay  = (a,b) => a && b && fmtDate(a) === fmtDate(b);

/* ── Status badge mapping ── */
const ATL_STYLE  = { YES:['#d1fae5','#065f46'], NO:['#fee2e2','#991b1b'], NA:['var(--c-10)','var(--c-60)'] };
const WILL_STYLE = { YES:['#d1fae5','#065f46'], NO:['#fee2e2','#991b1b'], MAYBE:['#fef3c7','#78350f'] };

const FlatChip = ({ val, map }) => {
  const [bg, color] = map[val] || ['var(--c-10)', 'var(--c-60)'];
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', fontSize:11, fontWeight:700,
      letterSpacing:'.04em', textTransform:'uppercase', background:bg, color, border:`1px solid ${color}30` }}>
      {val || '—'}
    </span>
  );
};

const toRow = s => ({
  _id:  s._id, _raw: s, status: s.status, date: s.date,
  time: s.checkIn?.time, block: s.school?.block || '',
  school: s.school?.name || '—', enroll: s.students?.total ?? '',
  al: { filename: s.acknowledgment?.pdfFilename || '', localUrl: s.acknowledgment?.pdfFilename ? `${SERVER}/uploads/${s.acknowledgment.pdfFilename}` : '', driveUrl: s.acknowledgment?.pdfDriveUrl || '', done: !!s.acknowledgment?.uploaded },
  ba: { filename: s.assessment?.pdfFilename || '', localUrl: s.assessment?.pdfFilename ? `${SERVER}/uploads/${s.assessment.pdfFilename}` : '', driveUrl: s.assessment?.driveUrl || s.assessment?.pdfUrl || '', done: !!s.assessment?.submitted },
  sessionPhotos: s.sessionPhotos || [], driveFolderUrl: s.driveFolderUrl || '',
  atl: s.atlLabStatus || 'NA', feedback: s.trainerFeedback || '',
  willing: s.teacherTrainingWillingness || 'NO',
});

/* ── Document link (flat enterprise style) ── */
const DocCell = ({ filename, localUrl, driveUrl, done }) => {
  if (!filename && !done) return <span style={{ color:'var(--c-50)', fontSize:11 }}>Missing</span>;
  const view = driveUrl || localUrl || null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <span style={{ fontSize:11, color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:124 }} title={filename}>
        {filename || 'File'}
      </span>
      <div style={{ display:'flex', gap:6 }}>
        {view && <a href={view} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'var(--blue)', fontWeight:600, textDecoration:'none', borderBottom:'1px solid var(--blue)' }}>View ↗</a>}
        {localUrl && <a href={localUrl} download={filename} style={{ fontSize:11, color:'var(--kyndryl-green)', fontWeight:600, textDecoration:'none', borderBottom:'1px solid var(--kyndryl-green)' }}>↓ Save</a>}
      </div>
    </div>
  );
};

/* ── Status cell (thin left bar) ── */
const StatusTD = ({ ok, manual, children, center }) => (
  <td style={{ padding:'8px 10px', verticalAlign:'middle', textAlign:center?'center':'left',
    borderLeft: manual ? '2px solid transparent' : ok ? '2px solid var(--kyndryl-green)' : '2px solid #f1c21b',
    background: manual ? 'transparent' : ok ? 'transparent' : 'rgba(241,194,27,.04)' }}>
    {children}
  </td>
);

/* ══════════ SESSION DETAIL PANEL ══════════ */
function SessionDetail({ session: s, onClose }) {
  const raw = s._raw;
  const [downloading, setDownloading] = useState(false);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${SERVER}/api/sessions/${s._id}/full-report`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(`Failed (${response.status})`);
      const blob = await response.blob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${(raw.school?.name || 'Session').replace(/[^a-zA-Z0-9]/g,'_')}_${fmtDate(s.date)}.pdf`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
    } catch (err) { alert(err.message || 'Download failed'); }
    finally { setDownloading(false); }
  };

  const photos   = (raw.sessionPhotos || []).filter(p => p.filename || p.url);
  const hasAck   = !!(raw.acknowledgment?.photo?.filename || raw.acknowledgment?.pdfFilename);
  const hasBa    = !!(raw.assessment?.submitted && raw.assessment?.responses?.length);
  const cInTime  = raw.checkIn?.time  ? new Date(raw.checkIn.time).toLocaleTimeString('en-IN',  { hour:'2-digit', minute:'2-digit', hour12:true }) : null;
  const cOutTime = raw.checkOut?.time ? new Date(raw.checkOut.time).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }) : null;

  const Divider = () => <div style={{ height:1, background:'var(--border)', margin:'0 -20px' }} />;
  const SectionLabel = ({ children }) => (
    <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--text-helper)', marginBottom:10 }}>
      {children}
    </div>
  );
  const KVRow = ({ label, value, accent }) => (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--c-10)', fontSize:13 }}>
      <span style={{ color:'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight:600, color: accent || 'var(--text-primary)' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(22,22,22,.6)', backdropFilter:'blur(2px)' }} />
      <div style={{ position:'relative', width:480, maxWidth:'95vw', background:'var(--surface)', overflowY:'auto', display:'flex', flexDirection:'column', borderLeft:'1px solid var(--border)', boxShadow:'-4px 0 24px rgba(0,0,0,.2)' }}>

        {/* Header */}
        <div style={{ background:'var(--bharat-navy)', padding:'18px 20px', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexShrink:0, borderLeft:'4px solid var(--kyndryl-green)' }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:15, lineHeight:1.3 }}>{s.school}</div>
            <div style={{ color:'rgba(255,255,255,.55)', fontSize:12, marginTop:4 }}>{fmtLong(s.date)} · {s.block}</div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', color:'#fff', width:30, height:30, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>×</button>
        </div>

        <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:0, flex:1 }}>

          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--border)', marginBottom:20 }}>
            {[
              { label:'Students', value: raw.students?.total ?? '—' },
              { label:'ATL Lab',  value: s.atl },
              { label:'Tchr Training', value: s.willing },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--c-10)', padding:'12px 14px', textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:300, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
                <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)', marginTop:3 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Timing */}
          <div style={{ marginBottom:20 }}>
            <SectionLabel>Timing & Location</SectionLabel>
            {cInTime  && <KVRow label="Check-In"  value={cInTime}  accent="var(--kyndryl-green)" />}
            {cOutTime && <KVRow label="Check-Out" value={cOutTime} accent="var(--red)" />}
            {raw.checkIn?.locationName && <KVRow label="Location" value={raw.checkIn.locationName} />}
            {raw.checkIn?.latitude && (
              <div style={{ marginTop:8 }}>
                <a href={`https://www.google.com/maps?q=${raw.checkIn.latitude},${raw.checkIn.longitude}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize:12, color:'var(--blue)', fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width:12, height:12 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  View on Maps
                </a>
              </div>
            )}
          </div>

          <Divider />

          {/* Session Photos */}
          {photos.length > 0 && (
            <div style={{ margin:'20px 0' }}>
              <SectionLabel>Session Photos ({photos.length})</SectionLabel>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
                {photos.map((p, i) => {
                  const src = p.url || imgUrl(p.filename);
                  if (!src) return null;
                  return (
                    <a key={i} href={src} target="_blank" rel="noreferrer" style={{ display:'block', aspectRatio:'4/3', background:'var(--c-20)', overflow:'hidden', position:'relative' }}>
                      <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} onError={e => { e.target.style.display='none'; }} />
                      {p.locationName && (
                        <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(22,22,22,.7)', color:'#fff', fontSize:9, padding:'3px 5px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:"'IBM Plex Mono',monospace" }}>
                          {p.locationName}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <Divider />

          {/* Acknowledgment */}
          <div style={{ margin:'20px 0' }}>
            <SectionLabel>Acknowledgment Letter</SectionLabel>
            {hasAck ? (() => {
              const fn = raw.acknowledgment.pdfFilename || raw.acknowledgment.photo?.filename;
              const local = `${SERVER}/uploads/${fn}`;
              const drive = raw.acknowledgment.pdfDriveUrl || '';
              return (
                <div>
                  <div style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:8, fontFamily:"'IBM Plex Mono',monospace" }}>{fn}</div>
                  <div style={{ display:'flex', gap:10 }}>
                    {(drive||local) && <a href={drive||local} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--blue)', fontWeight:600, borderBottom:'1px solid var(--blue)', textDecoration:'none' }}>View ↗</a>}
                    {local && <a href={local} download={fn} style={{ fontSize:12, color:'var(--kyndryl-green)', fontWeight:600, borderBottom:'1px solid var(--kyndryl-green)', textDecoration:'none' }}>↓ Download</a>}
                  </div>
                </div>
              );
            })() : <span style={{ color:'var(--c-50)', fontSize:12 }}>Not uploaded yet</span>}
          </div>

          <Divider />

          {/* Baseline Assessment */}
          <div style={{ margin:'20px 0' }}>
            <SectionLabel>Baseline Assessment</SectionLabel>
            {hasBa ? (
              <>
                {raw.assessment.responses.slice(0,3).map((r, i) => (
                  <div key={i} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text-primary)', marginBottom:4 }}>Q{i+1}. {r.question}</div>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', paddingLeft:10, borderLeft:'2px solid var(--bharat-navy)' }}>
                      {r.type === 'mcq' ? (r.selectedLabel || r.answer || '—') : (r.answer || '—')}
                    </div>
                  </div>
                ))}
                {raw.assessment.responses.length > 3 && <div style={{ fontSize:11, color:'var(--text-helper)' }}>+{raw.assessment.responses.length-3} more questions</div>}
                <div style={{ display:'flex', gap:10, marginTop:10 }}>
                  {s.ba.localUrl && <a href={s.ba.localUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--blue)', fontWeight:600, borderBottom:'1px solid var(--blue)', textDecoration:'none' }}>View PDF ↗</a>}
                  {s.ba.localUrl && <a href={s.ba.localUrl} download={s.ba.filename} style={{ fontSize:12, color:'var(--kyndryl-green)', fontWeight:600, borderBottom:'1px solid var(--kyndryl-green)', textDecoration:'none' }}>↓ Download</a>}
                </div>
              </>
            ) : <span style={{ color:'var(--c-50)', fontSize:12 }}>Not submitted yet</span>}
          </div>

          {/* Feedback */}
          {s.feedback && (
            <>
              <Divider />
              <div style={{ margin:'20px 0' }}>
                <SectionLabel>Trainer Feedback</SectionLabel>
                <div style={{ fontSize:13, color:'var(--text-primary)', lineHeight:1.65, padding:'10px 12px', borderLeft:'2px solid var(--yellow)', background:'rgba(241,194,27,.05)' }}>
                  {s.feedback}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer: download */}
        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--border)', background:'var(--c-10)', flexShrink:0 }}>
          <button onClick={downloadReport} disabled={downloading}
            className="btn btn-primary btn-full btn-lg"
            style={{ height:44 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:16, height:16 }}>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            {downloading ? 'Generating PDF…' : 'Download Full Report'}
          </button>
          <div style={{ textAlign:'center', fontSize:11, color:'var(--text-helper)', marginTop:6 }}>
            Includes photos · acknowledgment · assessment · feedback
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════ GOOGLE SETUP GUIDE ══════════ */
function SheetsGuide({ onClose }) {
  const steps = [
    { n:1, title:'Get your Sheet ID', body:'Open your Google Sheet → copy the ID from the URL\ndocs.google.com/spreadsheets/d/ ▶ THIS ◀ /edit\n\nPaste into server/.env:\nGOOGLE_SHEETS_ID=paste_here' },
    { n:2, title:'Create a Service Account', body:'console.cloud.google.com → APIs & Services → Library\nEnable: Google Sheets API + Google Drive API\nIAM & Admin → Service Accounts → + Create → "pathshala-bot"' },
    { n:3, title:'Download credentials', body:'Service Account → Keys → Add Key → JSON\nFrom that file:\nclient_email → GOOGLE_SERVICE_ACCOUNT_EMAIL\nprivate_key  → GOOGLE_PRIVATE_KEY\n(keep the \\n — do not reformat)' },
    { n:4, title:'Share the Sheet with the bot', body:'Google Sheet → Share → paste client_email\nGive it Editor access → Share' },
    { n:5, title:'Set Drive parent folder', body:'Open your Drive project folder → copy folder ID from URL\ndrive.google.com/drive/folders/ ▶ THIS ◀\n\nPaste into server/.env:\nGOOGLE_DRIVE_PARENT_FOLDER_ID=paste_here' },
    { n:6, title:'Restart server', body:'Add all values to server/.env, then:\ncd server && node index.js\n\nNew sessions auto-sync. Use "Sync All to Sheets"\nfor existing sessions.' },
  ];
  return (
    <div className="modal-overlay" style={{ zIndex:500 }}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <span className="modal-title">Connect Google Drive & Sheets</span>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="modal-body" style={{ padding:'20px 24px' }}>
          <div className="alert alert-info" style={{ marginBottom:16, fontSize:12 }}>
            Your existing sheet already has trainer tabs (Yash, Harshal, etc.) — the app writes to those tabs automatically.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {steps.map(step => (
              <div key={step.n} style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', paddingBottom:14, marginBottom:14 }}>
                <div style={{ width:28, height:28, background:'var(--bharat-navy)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0, marginRight:14, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {step.n}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', marginBottom:6 }}>{step.title}</div>
                  <pre style={{ margin:0, fontSize:11, color:'var(--text-secondary)', lineHeight:1.7, background:'var(--c-10)', padding:'8px 10px', fontFamily:"'IBM Plex Mono',monospace", whiteSpace:'pre-wrap', border:'1px solid var(--border)' }}>{step.body}</pre>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════ MAIN PAGE ══════════ */
export default function Reports() {
  const [sessions,  setSessions]  = useState([]);
  const [trainers,  setTrainers]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [from,      setFrom]      = useState('');
  const [to,        setTo]        = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [detail,    setDetail]    = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, tRes] = await Promise.all([api.get('/admin/sessions'), api.get('/admin/trainers')]);
      setSessions(sRes.data);
      setTrainers(tRes.data.filter(t => ['trainer','reviewer'].includes(t.role)));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rows = sessions
    .filter(s => activeTab ? s.trainer?._id === activeTab : true)
    .filter(s => {
      if (from && new Date(s.date) < new Date(from)) return false;
      if (to   && new Date(s.date) > new Date(to))   return false;
      return true;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(toRow);

  const syncAll = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/sessions/sync-to-sheets');
      toast.success(`Synced ${data.synced} / ${data.total} sessions to Sheets`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Sync failed';
      toast.error(msg);
      if (msg.toLowerCase().includes('configured') || msg.toLowerCase().includes('not')) setShowGuide(true);
    }
    setSyncing(false);
  };

  const submitted  = sessions.filter(s => s.status === 'submitted').length;
  const inProgress = sessions.filter(s => s.status === 'in-progress').length;
  const totalStu   = sessions.reduce((s, x) => s + (x.students?.total || 0), 0);
  const missingAL  = rows.filter(r => !r.al.done && !r.al.filename).length;
  const missingBA  = rows.filter(r => !r.ba.done && !r.ba.filename).length;
  const missingPh  = rows.filter(r => !r.sessionPhotos.length && !r.driveFolderUrl).length;
  const missingFb  = rows.filter(r => !r.feedback).length;

  return (
    <div style={{ padding:'0 0 60px', background:'var(--bg)', minHeight:'100vh' }}>
      {showGuide && <SheetsGuide onClose={() => setShowGuide(false)} />}
      {detail    && <SessionDetail session={detail} onClose={() => setDetail(null)} />}

      {/* ── Page header ── */}
      <div style={{ padding:'20px 24px 0', background:'var(--surface)', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, gap:12, flexWrap:'wrap' }}>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-.01em' }}>On-Ground Tracker</h2>
            <div style={{ fontSize:12, color:'var(--text-helper)', marginTop:3 }}>{sessions.length} sessions · {totalStu.toLocaleString('en-IN')} students reached</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowGuide(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" style={{ width:14, height:14 }}>
                <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 0015 4V2M4.93 4.93A10 10 0 004 9H2M4.93 19.07A10 10 0 009 20v2M19.07 19.07A10 10 0 0020 15h2"/>
              </svg>
              Drive + Sheets Setup
            </button>
            <button className="btn btn-green btn-sm" onClick={syncAll} disabled={syncing}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              {syncing ? 'Syncing…' : 'Sync All to Sheets'}
            </button>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'var(--border)', marginBottom:0 }}>
          {[
            { label:'Total Sessions',   value:sessions.length,              accent:'var(--bharat-navy)' },
            { label:'Submitted',        value:submitted,                    accent:'var(--kyndryl-green)' },
            { label:'In Progress',      value:inProgress,                   accent:'#f1c21b' },
            { label:'Students Reached', value:totalStu.toLocaleString('en-IN'), accent:'#8B5CF6' },
          ].map(c => (
            <div key={c.label} style={{ background:'var(--surface)', padding:'14px 16px', borderTop:`3px solid ${c.accent}` }}>
              <div style={{ fontSize:26, fontWeight:300, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', marginBottom:2 }}>{c.value}</div>
              <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* ── Trainer tab bar ── */}
        <div style={{ display:'flex', gap:0, overflowX:'auto', marginTop:0 }}>
          {[{ _id:null, name:'All Trainers' }, ...trainers].map(t => {
            const isActive = (activeTab ?? null) === t._id;
            const cnt = t._id === null ? sessions.length : sessions.filter(s => s.trainer?._id === t._id).length;
            return (
              <button key={t._id ?? 'all'} onClick={() => setActiveTab(t._id)}
                style={{
                  padding:'10px 18px', border:'none', borderBottom: isActive ? `2px solid var(--bharat-navy)` : '2px solid transparent',
                  background:'transparent', color: isActive ? 'var(--bharat-navy)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400, fontSize:13, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap',
                  display:'flex', alignItems:'center', gap:6, fontFamily:'inherit',
                  transition:'color .15s, border-color .15s',
                }}>
                {t.name}
                <span style={{
                  background: isActive ? 'var(--bharat-navy)' : 'var(--c-20)',
                  color: isActive ? '#fff' : 'var(--c-60)',
                  padding:'1px 6px', fontSize:10, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace",
                }}>{cnt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'8px 24px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)' }}>Filter</span>
        {['From','To'].map((lbl, i) => (
          <div key={lbl} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <label style={{ fontSize:11, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.06em' }}>{lbl}</label>
            <input type="date" value={i===0?from:to} onChange={e => i===0?setFrom(e.target.value):setTo(e.target.value)}
              style={{ border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'4px 8px', fontSize:12, fontFamily:'inherit', outline:'none', color:'var(--text-primary)' }} />
          </div>
        ))}
        {(from||to) && (
          <button onClick={() => { setFrom(''); setTo(''); }} style={{ fontSize:11, padding:'4px 10px', border:'1px solid var(--border)', background:'transparent', cursor:'pointer', color:'var(--text-secondary)', fontFamily:'inherit' }}>
            Clear
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:11, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace" }}>{rows.length} row{rows.length!==1?'s':''}</span>
          <div style={{ display:'flex', gap:10 }}>
            {[['var(--kyndryl-green)','Complete'],['#f1c21b','Pending'],['var(--c-30)','Manual']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.05em' }}>
                <span style={{ width:8, height:8, background:c, display:'inline-block', flexShrink:0 }}/>{l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ padding:'0 24px 20px' }}>
        {loading ? (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:'60px', textAlign:'center' }}>
            <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="var(--c-30)" strokeWidth="2" style={{ width:28, height:28, margin:'0 auto 12px', display:'block' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <div style={{ fontSize:13, color:'var(--text-helper)' }}>Loading tracker data…</div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text-helper)', marginBottom:8 }}>No Sessions</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)' }}>Sessions appear here once trainers submit their work</div>
          </div>
        ) : (
          <div style={{ overflowX:'auto', border:'1px solid var(--border)', marginTop:0, background:'var(--surface)' }}>
            <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12, tableLayout:'fixed', minWidth: COLS.reduce((s,c)=>s+c.w,0) }}>
              <colgroup>{COLS.map(c => <col key={c.key} style={{ width:c.w }} />)}</colgroup>
              <thead>
                <tr>
                  {COLS.map(c => (
                    <th key={c.key} style={{ padding:'9px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', background:'var(--c-10)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', position:'sticky', top:0, zIndex:2 }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const prev      = rows[idx-1];
                  const isNewDate = !prev || !sameDay(prev.date, row.date);
                  const isDraft   = row.status === 'draft' || row.status === 'in-progress';
                  const rowBg     = idx % 2 === 0 ? '#fff' : 'rgba(244,244,244,.5)';
                  const thumbs    = row.sessionPhotos.slice(0,3).filter(p => p.filename || p.url);
                  return (
                    <tr key={row._id} style={{ background: rowBg, borderTop: isNewDate && idx>0 ? '2px solid var(--c-20)' : '1px solid var(--c-10)', opacity: isDraft ? 0.65 : 1 }}>
                      {/* Date */}
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', whiteSpace:'nowrap' }}>
                        {isNewDate ? (
                          <span style={{ fontWeight:700, fontSize:12, color:'var(--text-primary)', fontFamily:"'IBM Plex Mono',monospace" }}>{fmtDate(row.date)}</span>
                        ) : (
                          <span style={{ color:'var(--c-20)', fontSize:11 }}>″</span>
                        )}
                      </td>
                      {/* Time */}
                      <td style={{ padding:'8px 10px', fontSize:11, color:'var(--text-secondary)', verticalAlign:'middle', whiteSpace:'nowrap', fontFamily:"'IBM Plex Mono',monospace" }}>
                        {row.time ? fmtTime(row.time) : <span style={{ color:'var(--c-20)' }}>—</span>}
                      </td>
                      {/* Block */}
                      <td style={{ padding:'8px 10px', fontSize:12, color:'var(--text-secondary)', verticalAlign:'middle' }}>{row.block||'—'}</td>
                      {/* School */}
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', borderLeft: row.school!=='—' ? '2px solid var(--kyndryl-green)' : '2px solid #f1c21b', cursor:'pointer' }} onClick={() => setDetail(row)}>
                        <div style={{ fontWeight:600, color:'var(--bharat-navy)', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', fontSize:12 }}>
                          {row.school}
                        </div>
                        {isDraft && <span style={{ fontSize:10, color:'#f1c21b', fontWeight:600 }}>● {row.status}</span>}
                      </td>
                      {/* Enrollment */}
                      <StatusTD ok={row.enroll !== ''} center>
                        {row.enroll !== '' ? (
                          <span style={{ fontWeight:700, color:'var(--text-primary)', fontSize:13, fontVariantNumeric:'tabular-nums' }}>{row.enroll}</span>
                        ) : <span style={{ color:'#f1c21b', fontSize:11 }}>—</span>}
                      </StatusTD>
                      {/* AL */}
                      <StatusTD ok={row.al.done || !!row.al.filename}><DocCell {...row.al} /></StatusTD>
                      {/* BA */}
                      <StatusTD ok={row.ba.done || !!row.ba.filename}><DocCell {...row.ba} /></StatusTD>
                      {/* Prena — manual */}
                      <StatusTD manual><span style={{ color:'var(--c-40)', fontSize:10, fontStyle:'italic' }}>Sheet only</span></StatusTD>
                      {/* Drive attend — manual */}
                      <StatusTD manual><span style={{ color:'var(--c-40)', fontSize:10, fontStyle:'italic' }}>Sheet only</span></StatusTD>
                      {/* Photos */}
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', borderLeft:(thumbs.length||row.driveFolderUrl)?'2px solid var(--kyndryl-green)':'2px solid #f1c21b', background:(thumbs.length||row.driveFolderUrl)?'transparent':'rgba(241,194,27,.04)' }}>
                        {thumbs.length > 0 ? (
                          <div style={{ display:'flex', gap:2, alignItems:'center', cursor:'pointer' }} onClick={() => setDetail(row)}>
                            {thumbs.map((p, i) => {
                              const src = p.url || imgUrl(p.filename);
                              return src ? (
                                <img key={i} src={src} alt="" style={{ width:36, height:36, objectFit:'cover', border:'1px solid var(--border)' }} onError={e => { e.target.style.display='none'; }} />
                              ) : null;
                            })}
                            {row.sessionPhotos.length > 3 && (
                              <span style={{ fontSize:10, color:'var(--bharat-navy)', fontWeight:700, background:'var(--c-10)', border:'1px solid var(--border)', padding:'2px 5px', whiteSpace:'nowrap', fontFamily:"'IBM Plex Mono',monospace" }}>+{row.sessionPhotos.length-3}</span>
                            )}
                          </div>
                        ) : row.driveFolderUrl ? (
                          <a href={row.driveFolderUrl} target="_blank" rel="noreferrer" style={{ color:'var(--blue)', fontSize:11, fontWeight:600, textDecoration:'none', borderBottom:'1px solid var(--blue)' }}>
                            View Folder ↗
                          </a>
                        ) : <span style={{ color:'#f1c21b', fontSize:11 }}>Missing</span>}
                      </td>
                      {/* ATL */}
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', textAlign:'center' }}>
                        <FlatChip val={row.atl} map={ATL_STYLE} />
                      </td>
                      {/* Feedback */}
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', borderLeft: row.feedback?'2px solid var(--kyndryl-green)':'2px solid #f1c21b', background:row.feedback?'transparent':'rgba(241,194,27,.04)' }}>
                        {row.feedback
                          ? <span style={{ fontSize:12, color:'var(--text-secondary)', display:'-webkit-box', overflow:'hidden', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }} title={row.feedback}>{row.feedback}</span>
                          : <span style={{ color:'#f1c21b', fontSize:11 }}>Missing</span>}
                      </td>
                      {/* Willing */}
                      <td style={{ padding:'8px 10px', verticalAlign:'middle', textAlign:'center' }}>
                        <FlatChip val={row.willing} map={WILL_STYLE} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Status banner ── */}
        {rows.length > 0 && missingAL+missingBA+missingPh+missingFb > 0 && (
          <div className="alert alert-warning" style={{ marginTop:12 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14, flexShrink:0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>
              <strong>Incomplete:</strong>
              {missingAL > 0 && ` ${missingAL} Ack Letters`}
              {missingBA > 0 && ` · ${missingBA} Assessments`}
              {missingPh > 0 && ` · ${missingPh} Photos`}
              {missingFb > 0 && ` · ${missingFb} Feedback`}
            </span>
          </div>
        )}
        {rows.length > 0 && missingAL+missingBA+missingPh+missingFb === 0 && (
          <div className="alert alert-success" style={{ marginTop:12 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14, flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>
            All sessions complete — ready to sync to Google Sheets
          </div>
        )}
      </div>
    </div>
  );
}
