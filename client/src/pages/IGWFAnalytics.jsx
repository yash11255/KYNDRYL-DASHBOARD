import { useState, useMemo } from 'react';
import DATA from '../data/igwf.json';

/* ─── palette ─── */
const C = {
  navy:   '#0f2d6b',
  green:  '#00c73c',
  orange: '#F4622A',
  amber:  '#f1c21b',
  red:    '#da1e28',
  purple: '#8B5CF6',
  teal:   '#0891b2',
  slate:  '#64748b',
};

const STATE_COLORS = [C.navy, C.green, C.orange, C.amber, C.red, C.purple, C.teal, '#059669','#dc2626','#7c3aed','#0284c7','#65a30d'];

/* ─── helpers ─── */
const fmtDate = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) : '—';
const grp = (arr, key) => arr.reduce((acc, r) => { const k = r[key] || 'Unknown'; acc[k] = (acc[k]||0)+1; return acc; }, {});
const topN = (obj, n=10) => Object.entries(obj).sort((a,b)=>b[1]-a[1]).slice(0,n);

/* ─── SVG Donut ─── */
function Donut({ data, size = 140, hole = 0.6 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const cx = size/2, cy = size/2, r = (size/2) - 6;
  const ri = r * hole;
  let angle = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1o = cx + r  * Math.cos(angle), y1o = cy + r  * Math.sin(angle);
    const x1i = cx + ri * Math.cos(angle), y1i = cy + ri * Math.sin(angle);
    angle += sweep;
    const x2o = cx + r  * Math.cos(angle), y2o = cy + r  * Math.sin(angle);
    const x2i = cx + ri * Math.cos(angle), y2i = cy + ri * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1i} ${y1i} L ${x1o} ${y1o} A ${r} ${r} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${large} 0 ${x1i} ${y1i} Z`;
    return { ...d, path };
  });
  const top = data.reduce((a,b) => a.value>b.value ? a : b);
  return (
    <svg width={size} height={size}>
      {slices.map((s,i) => <path key={i} d={s.path} fill={s.color} />)}
      <text x={cx} y={cy-6} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: '#161616', fontFamily: 'inherit' }}>{top.value}</text>
      <text x={cx} y={cy+14} textAnchor="middle" style={{ fontSize: 10, fill: '#525252', fontFamily: 'inherit', textTransform:'uppercase' }}>{top.label.slice(0,12)}</text>
    </svg>
  );
}

/* ─── Bar chart (horizontal) ─── */
function HBarChart({ data, color = C.navy, secondColor = C.green, showSecond = false }) {
  const max = Math.max(...data.map(d => d.value + (d.value2||0)));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:11, color:'var(--text-secondary)', width:110, flexShrink:0, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={d.label}>{d.label}</div>
          <div style={{ flex:1, display:'flex', height:20, gap:1 }}>
            <div style={{ width:`${(d.value/max)*100}%`, background:color, minWidth:2, display:'flex', alignItems:'center', paddingLeft:4, boxSizing:'border-box', transition:'width .4s' }}>
              <span style={{ fontSize:10, color:'#fff', fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", whiteSpace:'nowrap' }}>{d.value}</span>
            </div>
            {showSecond && d.value2 > 0 && (
              <div style={{ width:`${(d.value2/max)*100}%`, background:secondColor, minWidth:2, display:'flex', alignItems:'center', paddingLeft:4, transition:'width .4s' }}>
                <span style={{ fontSize:10, color:'#fff', fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>{d.value2}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Timeline chart ─── */
function TimelineChart({ draftByDate, appliedByDate }) {
  const allDates = [...new Set([...Object.keys(draftByDate), ...Object.keys(appliedByDate)])].sort();
  if (!allDates.length) return null;
  const maxVal = Math.max(...allDates.map(d => (draftByDate[d]||0) + (appliedByDate[d]||0)));
  const W = 600, H = 140, PAD = { t:10, r:10, b:30, l:32 };
  const bw = Math.max(4, Math.floor((W - PAD.l - PAD.r) / allDates.length) - 2);
  const scaleY = (v) => H - PAD.b - (v / maxVal) * (H - PAD.t - PAD.b);

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={Math.max(W, allDates.length * (bw+2) + PAD.l + PAD.r)} height={H} style={{ fontFamily:'inherit' }}>
        {/* Y gridlines */}
        {[0,.25,.5,.75,1].map(p => {
          const y = H - PAD.b - p*(H-PAD.t-PAD.b);
          return (
            <g key={p}>
              <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.l-4} y={y+4} textAnchor="end" style={{ fontSize:9, fill:'#9ca3af', fontFamily:"'IBM Plex Mono',monospace" }}>{Math.round(p*maxVal)}</text>
            </g>
          );
        })}
        {/* Bars */}
        {allDates.map((d, i) => {
          const x = PAD.l + i*(bw+2);
          const dv = draftByDate[d]||0;
          const av = appliedByDate[d]||0;
          const dhgt = (dv/maxVal)*(H-PAD.t-PAD.b);
          const ahgt = (av/maxVal)*(H-PAD.t-PAD.b);
          return (
            <g key={d}>
              {/* draft bar */}
              <rect x={x} y={scaleY(dv)} width={bw*0.55} height={dhgt} fill={C.amber} opacity={0.9} />
              {/* applied bar */}
              <rect x={x+bw*0.45} y={scaleY(av)} width={bw*0.55} height={ahgt} fill={C.navy} opacity={0.9} />
              {/* X label every 3rd */}
              {i % Math.max(1,Math.floor(allDates.length/12)) === 0 && (
                <text x={x+bw/2} y={H-PAD.b+12} textAnchor="middle" style={{ fontSize:8, fill:'#6b7280', fontFamily:"'IBM Plex Mono',monospace" }}>
                  {fmtDate(d)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display:'flex', gap:16, marginTop:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)' }}>
          <div style={{ width:12, height:12, background:C.amber }} /> Draft
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)' }}>
          <div style={{ width:12, height:12, background:C.navy }} /> Applied
        </div>
      </div>
    </div>
  );
}

/* ─── Missing field badge ─── */
const MISSING_FIELDS = [
  { key:'dob',        label:'Date of Birth' },
  { key:'aadhar',     label:'Aadhaar No.' },
  { key:'motherName', label:'Mother Name' },
  { key:'fatherName', label:'Father Name' },
  { key:'income',     label:'Family Income' },
  { key:'passport',   label:'Passport' },
  { key:'height',     label:'Height' },
  { key:'weight',     label:'Weight' },
  { key:'laptop',     label:'Laptop' },
  { key:'dgcaNum',    label:'DGCA No.' },
];

function missingCount(r) { return MISSING_FIELDS.filter(f => !r[f.key]).length; }
function completionPct(r) { return Math.round((1 - missingCount(r)/MISSING_FIELDS.length)*100); }

/* ─── Applicant row (draft) ─── */
function DraftRow({ r, calling }) {
  const [expanded, setExpanded] = useState(false);
  const missing = MISSING_FIELDS.filter(f => !r[f.key]);
  const pct = completionPct(r);
  const call = calling.find(c => c.id === r.id);

  const callColor = {
    'Called':       C.green,
    'DNP':          C.amber,
    'Wrong Number': C.red,
    'Switch off':   C.slate,
  }[call?.callingStatus] || 'var(--c-30)';

  return (
    <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red}` }}>
      <div style={{ padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12 }} onClick={() => setExpanded(e => !e)}>
        {/* name + id */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {r.firstName} {r.lastName}
          </div>
          <div style={{ fontSize:11, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace" }}>{r.id} · {fmtDate(r.date)}</div>
        </div>
        {/* state */}
        <div style={{ fontSize:11, color:'var(--text-secondary)', width:120, flexShrink:0, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.state}</div>
        {/* call status */}
        {call && (
          <div style={{ fontSize:10, fontWeight:700, background:callColor+'20', color:callColor, padding:'2px 8px', flexShrink:0, letterSpacing:'.04em', border:`1px solid ${callColor}40` }}>
            {call.callingStatus || '—'}
          </div>
        )}
        {/* completion */}
        <div style={{ flexShrink:0, width:90 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-helper)', marginBottom:3, fontFamily:"'IBM Plex Mono',monospace" }}>
            <span>{pct}%</span><span>{missing.length} missing</span>
          </div>
          <div style={{ height:4, background:'var(--c-20)' }}>
            <div style={{ height:'100%', width:`${pct}%`, background: pct>=70?C.green:pct>=40?C.amber:C.red }} />
          </div>
        </div>
        <div style={{ fontSize:14, color:'var(--text-helper)', flexShrink:0, transform: expanded?'rotate(90deg)':'none', transition:'transform .15s' }}>›</div>
      </div>

      {expanded && (
        <div style={{ padding:'0 16px 14px', borderTop:'1px solid var(--c-10)' }}>
          {/* contact */}
          <div style={{ display:'flex', gap:20, fontSize:12, color:'var(--text-secondary)', marginBottom:12, marginTop:10 }}>
            <span>{r.phone || '—'}</span>
            <span>{r.email || '—'}</span>
            <span>DOB: {fmtDate(r.dob)}</span>
          </div>
          {/* missing fields */}
          {missing.length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)', marginBottom:6 }}>Missing Data ({missing.length} fields)</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {missing.map(f => (
                  <span key={f.key} style={{ fontSize:11, fontWeight:600, background:'#fff1f2', color:C.red, border:'1px solid #fecdd3', padding:'2px 8px' }}>{f.label}</span>
                ))}
              </div>
            </div>
          )}
          {/* calling detail */}
          {call && (call.callStatus || call.remarks) && (
            <div style={{ marginTop:12, padding:'8px 12px', background:'var(--c-10)', borderLeft:'2px solid var(--border-strong)', fontSize:12 }}>
              {call.callStatus && <div><strong>Call Result:</strong> {call.callStatus}</div>}
              {call.remarks && <div style={{ color:'var(--text-secondary)', marginTop:3 }}>{call.remarks}</div>}
              {call.assignedTo && <div style={{ color:'var(--text-helper)', marginTop:2, fontSize:11 }}>Assigned to: {call.assignedTo}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Applied row ─── */
function AppliedRow({ r }) {
  const statusColor = r.status === 'Under Review' ? C.navy : C.amber;
  return (
    <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', borderLeft:`3px solid ${statusColor}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{r.firstName} {r.lastName}</div>
        <div style={{ fontSize:11, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace" }}>{r.id} · {fmtDate(r.date)}</div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-secondary)', width:120, flexShrink:0, textAlign:'right' }}>{r.state}</div>
      <div style={{ fontSize:11, color:'var(--text-secondary)', width:80, flexShrink:0, textAlign:'right' }}>{r.district}</div>
      <span style={{ fontSize:10, fontWeight:700, background:statusColor+'20', color:statusColor, border:`1px solid ${statusColor}40`, padding:'2px 10px', flexShrink:0, letterSpacing:'.04em' }}>
        {r.status || 'Pending'}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function IGWFAnalytics() {
  const [tab,        setTab]        = useState('analytics');
  const [search,     setSearch]     = useState('');
  const [stateFilter,setStateFilter]= useState('');
  const [sortDrafts, setSortDrafts] = useState('missing'); // missing | date | state

  const { drafts, applied, registered, calling, summary } = DATA;

  /* ── Compute analytics ── */
  const totalRegistered = registered.length;
  const totalDrafts     = drafts.length;
  const totalApplied    = applied.length;
  const conversionRate  = totalRegistered ? ((totalApplied / totalRegistered) * 100).toFixed(1) : 0;
  const draftRate       = totalRegistered ? ((totalDrafts / totalRegistered) * 100).toFixed(1) : 0;

  const callStatusDist = useMemo(() => {
    const raw = grp(calling.filter(c => c.callStatus), 'callStatus');
    const colors = [C.green, C.amber, C.red, C.navy, C.purple, C.teal, C.slate, C.orange];
    return Object.entries(raw).sort((a,b)=>b[1]-a[1]).map(([label,value],i) => ({ label, value, color: colors[i%colors.length] }));
  }, [calling]);

  const callingStatusDist = useMemo(() => {
    const raw = grp(calling, 'callingStatus');
    return [
      { label:'Called',       value: raw['Called']||0,        color: C.green },
      { label:'DNP',          value: raw['DNP']||0,           color: C.amber },
      { label:'Wrong Number', value: raw['Wrong Number']||0,  color: C.red },
      { label:'Switch off',   value: raw['Switch off']||0,    color: C.slate },
      { label:'Not Called',   value: raw['null']||raw[null]||calling.filter(c=>!c.callingStatus).length, color: 'var(--c-30)' },
    ].filter(d => d.value > 0);
  }, [calling]);

  const topDraftStates  = useMemo(() => topN(summary.draftByState, 12).map(([label,value],i) => ({ label, value, color: STATE_COLORS[i%STATE_COLORS.length] })), []);
  const topAppliedStates= useMemo(() => topN(summary.appliedByState, 12).map(([label,value],i) => ({ label, value, color: STATE_COLORS[i%STATE_COLORS.length] })), []);

  const stateComparison = useMemo(() => {
    const allStates = [...new Set([...Object.keys(summary.draftByState), ...Object.keys(summary.appliedByState)])];
    return allStates.map(s => ({
      label:  s,
      value:  summary.draftByState[s] || 0,
      value2: summary.appliedByState[s] || 0,
    })).sort((a,b) => (b.value+b.value2)-(a.value+a.value2)).slice(0,12);
  }, []);

  /* Missing data summary across all drafts */
  const missingStats = useMemo(() => MISSING_FIELDS.map(f => ({
    ...f,
    missing: drafts.filter(r => !r[f.key]).length,
    pct:     Math.round(drafts.filter(r => !r[f.key]).length / drafts.length * 100),
  })).sort((a,b) => b.missing - a.missing), [drafts]);

  /* ── Draft tab filtering ── */
  const allStates = useMemo(() => [...new Set(drafts.map(r => r.state).filter(Boolean))].sort(), [drafts]);

  const filteredDrafts = useMemo(() => {
    let out = drafts;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r => [r.firstName, r.lastName, r.email, r.phone, r.id, r.state].join(' ').toLowerCase().includes(q));
    }
    if (stateFilter) out = out.filter(r => r.state === stateFilter);
    if (sortDrafts === 'missing') out = [...out].sort((a,b) => missingCount(b)-missingCount(a));
    else if (sortDrafts === 'date')  out = [...out].sort((a,b) => (b.date||'').localeCompare(a.date||''));
    else if (sortDrafts === 'state') out = [...out].sort((a,b) => (a.state||'').localeCompare(b.state||''));
    return out;
  }, [drafts, search, stateFilter, sortDrafts]);

  /* ── Applied tab filtering ── */
  const filteredApplied = useMemo(() => {
    let out = applied;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r => [r.firstName, r.lastName, r.email, r.phone, r.id, r.state].join(' ').toLowerCase().includes(q));
    }
    if (stateFilter) out = out.filter(r => r.state === stateFilter);
    return out;
  }, [applied, search, stateFilter]);

  /* ── Tab change: reset filters ── */
  const switchTab = (t) => { setTab(t); setSearch(''); setStateFilter(''); };

  const SectionTitle = ({ children, sub }) => (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'var(--text-primary)', textTransform:'uppercase', letterSpacing:'.07em' }}>{children}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-helper)', marginTop:2 }}>{sub}</div>}
    </div>
  );

  const Panel = ({ children, style }) => (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:'20px', ...style }}>{children}</div>
  );

  return (
    <div style={{ padding:'0 0 80px', background:'var(--bg)', minHeight:'100vh' }}>

      {/* ── Page header ── */}
      <div style={{ background:'var(--surface)', borderBottom:'1px solid var(--border)', padding:'20px 24px 0' }}>
        <div style={{ marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:600, color:'var(--text-primary)', letterSpacing:'-.01em' }}>
            IGWF Applicants Analytics
          </h2>
          <div style={{ fontSize:12, color:'var(--text-helper)', marginTop:3 }}>
            Giving Wings to Fly — Airline Ready Pilot Training Programme · Data as of 27 Jun 2026
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:1, background:'var(--border)', marginBottom:0 }}>
          {[
            { label:'Registered',       value: totalRegistered.toLocaleString('en-IN'), accent: C.teal },
            { label:'Drafts',           value: totalDrafts.toLocaleString('en-IN'),     accent: C.amber },
            { label:'Applied',          value: totalApplied.toLocaleString('en-IN'),    accent: C.navy },
            { label:'Calling Records',  value: calling.length.toLocaleString('en-IN'),  accent: C.purple },
            { label:'Conversion Rate',  value: `${conversionRate}%`,                   accent: C.green },
          ].map(c => (
            <div key={c.label} style={{ background:'var(--surface)', padding:'14px 16px', borderTop:`3px solid ${c.accent}` }}>
              <div style={{ fontSize:26, fontWeight:300, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums', marginBottom:2 }}>{c.value}</div>
              <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display:'flex', borderBottom:'none', marginTop:0 }}>
          {[
            { id:'analytics', label:'Analytics', count:null },
            { id:'drafts',    label:'Drafts',    count:totalDrafts },
            { id:'applied',   label:'Applied',   count:totalApplied },
          ].map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)}
              style={{ padding:'12px 20px', border:'none', borderBottom: tab===t.id ? `2px solid ${C.navy}` : '2px solid transparent',
                background:'transparent', color: tab===t.id ? C.navy : 'var(--text-secondary)',
                fontWeight: tab===t.id ? 700 : 400, fontSize:13, cursor:'pointer', fontFamily:'inherit',
                display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap', transition:'color .15s, border-color .15s',
              }}>
              {t.label}
              {t.count !== null && (
                <span style={{ background: tab===t.id ? C.navy : 'var(--c-20)', color: tab===t.id ? '#fff' : 'var(--c-60)', padding:'1px 6px', fontSize:10, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace" }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ ANALYTICS TAB ══════════ */}
      {tab === 'analytics' && (
        <div style={{ padding:'24px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Row 1: Timeline */}
          <Panel>
            <SectionTitle sub="Daily submission counts — Draft (amber) vs Applied (navy)">
              Submission Timeline
            </SectionTitle>
            <TimelineChart draftByDate={summary.draftByDate} appliedByDate={summary.appliedByDate} />
          </Panel>

          {/* Row 2: State comparison + donut */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }}>
            <Panel>
              <SectionTitle sub="Top 12 states — Draft (left) + Applied (right)">
                State-wise Breakdown
              </SectionTitle>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)' }}>
                  <div style={{ width:12, height:12, background:C.amber }} /> Draft
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text-secondary)' }}>
                  <div style={{ width:12, height:12, background:C.navy }} /> Applied
                </div>
              </div>
              <HBarChart data={stateComparison} color={C.amber} secondColor={C.navy} showSecond />
            </Panel>

            {/* Calling status donut */}
            <Panel>
              <SectionTitle sub={`${calling.length} calling records`}>Calling Status</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                <Donut data={callingStatusDist} size={150} />
                <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%' }}>
                  {callingStatusDist.map(d => (
                    <div key={d.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:10, height:10, background:d.color, flexShrink:0 }} />
                      <span style={{ fontSize:12, color:'var(--text-secondary)', flex:1 }}>{d.label}</span>
                      <span style={{ fontSize:12, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{d.value}</span>
                      <span style={{ fontSize:10, color:'var(--text-helper)', width:36, textAlign:'right', fontFamily:"'IBM Plex Mono',monospace" }}>
                        {Math.round(d.value/calling.length*100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {/* Row 3: Call result + Missing data */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

            {/* Call result distribution */}
            <Panel>
              <SectionTitle sub="Outcome of calling attempts">Call Result Distribution</SectionTitle>
              <div style={{ display:'flex', gap:16, marginBottom:16, justifyContent:'center' }}>
                <Donut data={callStatusDist.slice(0,8)} size={130} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                {callStatusDist.map(d => (
                  <div key={d.label} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, background:d.color, flexShrink:0 }} />
                    <span style={{ fontSize:11, color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Missing data analysis */}
            <Panel>
              <SectionTitle sub="How many draft applicants are missing each field">Draft — Missing Data Analysis</SectionTitle>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {missingStats.map(f => (
                  <div key={f.key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ fontSize:12, color:'var(--text-secondary)', width:110, flexShrink:0 }}>{f.label}</div>
                    <div style={{ flex:1, height:18, background:'var(--c-10)', position:'relative' }}>
                      <div style={{ height:'100%', width:`${f.pct}%`, background: f.pct>90?C.red:f.pct>60?C.orange:f.pct>30?C.amber:C.green, transition:'width .4s' }} />
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, fontVariantNumeric:'tabular-nums', color: f.pct>90?C.red:f.pct>60?C.orange:'var(--text-primary)', width:50, textAlign:'right', fontFamily:"'IBM Plex Mono',monospace" }}>
                      {f.pct}%
                    </span>
                    <span style={{ fontSize:10, color:'var(--text-helper)', width:56, textAlign:'right', fontFamily:"'IBM Plex Mono',monospace" }}>
                      {f.missing}/{totalDrafts}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Row 4: Applied state donut + top states tables */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Panel>
              <SectionTitle sub="Top 12 states by draft count">Draft Applications by State</SectionTitle>
              <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
                <Donut data={topDraftStates} size={130} />
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                  {topDraftStates.slice(0,8).map(d => (
                    <div key={d.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, background:d.color, flexShrink:0 }} />
                      <span style={{ fontSize:11, color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel>
              <SectionTitle sub="Top 12 states by applied count">Applied Applications by State</SectionTitle>
              <div style={{ display:'flex', gap:20, alignItems:'flex-start' }}>
                <Donut data={topAppliedStates} size={130} />
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                  {topAppliedStates.slice(0,8).map(d => (
                    <div key={d.label} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ width:8, height:8, background:d.color, flexShrink:0 }} />
                      <span style={{ fontSize:11, color:'var(--text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.label}</span>
                      <span style={{ fontSize:11, fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {/* Row 5: Summary table */}
          <Panel>
            <SectionTitle sub="Conversion funnel by state (top 15)">State-wise Conversion Funnel</SectionTitle>
            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--c-10)' }}>
                    {['State','Registered','Draft','Applied','Draft Rate','Applied Rate'].map(h => (
                      <th key={h} style={{ padding:'8px 12px', textAlign: h==='State'?'left':'right', fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stateComparison.map((s, i) => {
                    const regCount = registered.filter(r => r.name).length; // proxy
                    const dPct = totalDrafts ? Math.round(s.value/totalDrafts*100) : 0;
                    const aPct = totalApplied ? Math.round(s.value2/totalApplied*100) : 0;
                    return (
                      <tr key={s.label} style={{ background: i%2===0 ? 'var(--surface)' : 'rgba(244,244,244,.5)', borderBottom:'1px solid var(--c-10)' }}>
                        <td style={{ padding:'8px 12px', fontWeight:600, color:'var(--text-primary)' }}>{s.label}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono',monospace" }}>—</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', color:C.amber, fontFamily:"'IBM Plex Mono',monospace" }}>{s.value}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:700, fontVariantNumeric:'tabular-nums', color:C.navy, fontFamily:"'IBM Plex Mono',monospace" }}>{s.value2}</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:"'IBM Plex Mono',monospace", color:'var(--text-secondary)' }}>{dPct}%</td>
                        <td style={{ padding:'8px 12px', textAlign:'right', fontFamily:"'IBM Plex Mono',monospace", color: s.value2>0 ? C.green : 'var(--text-helper)' }}>{aPct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ══════════ DRAFTS TAB ══════════ */}
      {tab === 'drafts' && (
        <div style={{ padding:'20px 24px' }}>

          {/* info banner */}
          <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderLeft:`3px solid ${C.amber}`, padding:'12px 16px', fontSize:12, color:'#78350f', marginBottom:20, display:'flex', gap:12, alignItems:'flex-start' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:16, height:16, flexShrink:0, marginTop:1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <strong>Draft Applications — Incomplete Submissions</strong>
              <div style={{ marginTop:4 }}>These applicants started but did not complete their application. Key fields most commonly missing: <strong>Income, Mother/Father names, Laptop status, DGCA number, Height/Weight</strong>. Left border color: <span style={{color:C.green}}>green</span> = 70%+ complete, <span style={{color:C.amber}}>amber</span> = 40–70%, <span style={{color:C.red}}>red</span> = below 40%.</div>
            </div>
          </div>

          {/* filters */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:'12px 16px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:0 }}>
            <input
              placeholder="Search name, phone, email, state, ID…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'6px 10px', fontSize:12, fontFamily:'inherit', outline:'none', flex:'1 1 200px', minWidth:180, color:'var(--text-primary)' }}
            />
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
              style={{ border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'6px 10px', fontSize:12, fontFamily:'inherit', color:'var(--text-primary)', outline:'none' }}>
              <option value="">All States</option>
              {allStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display:'flex', gap:1, background:'var(--border)' }}>
              {[['missing','Most Missing'],['date','Newest'],['state','State A–Z']].map(([v,l]) => (
                <button key={v} onClick={() => setSortDrafts(v)}
                  style={{ padding:'6px 12px', border:'none', background: sortDrafts===v ? C.navy : 'var(--surface)', color: sortDrafts===v ? '#fff' : 'var(--text-secondary)', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight: sortDrafts===v ? 600 : 400 }}>
                  {l}
                </button>
              ))}
            </div>
            <span style={{ fontSize:11, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace", marginLeft:'auto' }}>
              {filteredDrafts.length} of {totalDrafts}
            </span>
          </div>

          {/* list */}
          <div style={{ border:'1px solid var(--border)', borderTop:'none' }}>
            {filteredDrafts.slice(0, 200).map(r => (
              <DraftRow key={r.id} r={r} calling={calling} />
            ))}
            {filteredDrafts.length > 200 && (
              <div style={{ padding:'14px', textAlign:'center', fontSize:12, color:'var(--text-helper)', background:'var(--c-10)', borderTop:'1px solid var(--border)' }}>
                Showing first 200 of {filteredDrafts.length} — use filters to narrow down
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ APPLIED TAB ══════════ */}
      {tab === 'applied' && (
        <div style={{ padding:'20px 24px' }}>

          {/* status strip */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'var(--border)', marginBottom:20 }}>
            {[
              { label:'Total Applied',   value: totalApplied,                                    accent: C.navy },
              { label:'Pending',         value: applied.filter(a=>a.status==='Pending').length,   accent: C.amber },
              { label:'Under Review',    value: applied.filter(a=>a.status==='Under Review').length, accent: C.green },
            ].map(c => (
              <div key={c.label} style={{ background:'var(--surface)', padding:'14px 16px', borderTop:`3px solid ${c.accent}`, textAlign:'center' }}>
                <div style={{ fontSize:26, fontWeight:300, color:'var(--text-primary)', fontVariantNumeric:'tabular-nums' }}>{c.value}</div>
                <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)', marginTop:3 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* filters */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:'12px 16px', display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:0 }}>
            <input
              placeholder="Search name, phone, email, ID…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'6px 10px', fontSize:12, fontFamily:'inherit', outline:'none', flex:'1 1 200px', color:'var(--text-primary)' }}
            />
            <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
              style={{ border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'6px 10px', fontSize:12, fontFamily:'inherit', color:'var(--text-primary)', outline:'none' }}>
              <option value="">All States</option>
              {[...new Set(applied.map(r => r.state).filter(Boolean))].sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize:11, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace", marginLeft:'auto' }}>
              {filteredApplied.length} of {totalApplied}
            </span>
          </div>

          {/* header row */}
          <div style={{ background:'var(--c-10)', border:'1px solid var(--border)', borderTop:'none', borderBottom:'none', padding:'8px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1, fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em' }}>Name / ID</div>
            <div style={{ width:120, fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', textAlign:'right' }}>State</div>
            <div style={{ width:80, fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', textAlign:'right' }}>District</div>
            <div style={{ width:100, fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', textAlign:'right' }}>Status</div>
          </div>
          <div style={{ border:'1px solid var(--border)', borderTop:'none' }}>
            {filteredApplied.slice(0, 200).map(r => (
              <AppliedRow key={r.id} r={r} />
            ))}
            {filteredApplied.length > 200 && (
              <div style={{ padding:'14px', textAlign:'center', fontSize:12, color:'var(--text-helper)', background:'var(--c-10)', borderTop:'1px solid var(--border)' }}>
                Showing first 200 of {filteredApplied.length} — use filters to narrow down
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
