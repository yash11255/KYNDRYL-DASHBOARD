import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

function newQuestion(order) {
  return { order, type:'text', question:'', options:['',''], isRequired:false };
}

const IconBtn = ({ onClick, disabled, title, children, danger }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    style={{ width:28, height:28, border:`1px solid ${danger ? 'var(--red)' : 'var(--border)'}`, background: danger ? 'rgba(218,30,40,.08)' : 'var(--c-10)', color: danger ? 'var(--red)' : 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, opacity: disabled ? 0.35 : 1, flexShrink:0 }}>
    {children}
  </button>
);

export default function AssessmentBuilder() {
  const [questions,     setQuestions]     = useState([]);
  const [version,       setVersion]       = useState(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    api.get('/assessment-template')
      .then(r => {
        if (r.data) {
          setVersion(r.data.version);
          setLastUpdatedBy(r.data.updatedBy?.name || r.data.createdBy?.name || null);
          setQuestions([...r.data.questions].sort((a,b) => a.order-b.order).map(q => ({
            order: q.order, type: q.type, question: q.question,
            options: q.options?.length ? [...q.options] : ['',''],
            isRequired: q.isRequired || false,
          })));
        } else { setQuestions([newQuestion(1)]); }
      })
      .catch(() => setQuestions([newQuestion(1)]))
      .finally(() => setLoading(false));
  }, []);

  const updateQ      = (idx, patch) => setQuestions(qs => qs.map((q,i) => i===idx ? { ...q, ...patch } : q));
  const addQuestion  = () => setQuestions(qs => [...qs, newQuestion(qs.length+1)]);
  const removeQuestion = idx => setQuestions(qs => qs.filter((_,i) => i!==idx).map((q,i) => ({ ...q, order:i+1 })));
  const moveUp       = idx => { if (idx===0) return; setQuestions(qs => { const n=[...qs]; [n[idx-1],n[idx]]=[n[idx],n[idx-1]]; return n.map((q,i) => ({ ...q, order:i+1 })); }); };
  const moveDown     = idx => setQuestions(qs => { if (idx>=qs.length-1) return qs; const n=[...qs]; [n[idx],n[idx+1]]=[n[idx+1],n[idx]]; return n.map((q,i) => ({ ...q, order:i+1 })); });
  const addOption    = idx => setQuestions(qs => qs.map((q,i) => i===idx ? { ...q, options:[...q.options,''] } : q));
  const removeOption = (qi,oi) => setQuestions(qs => qs.map((q,i) => i===qi ? { ...q, options:q.options.filter((_,j) => j!==oi) } : q));
  const updateOption = (qi,oi,val) => setQuestions(qs => qs.map((q,i) => { if (i!==qi) return q; const o=[...q.options]; o[oi]=val; return { ...q, options:o }; }));

  const handleSave = async () => {
    for (let i=0; i<questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) { toast.error(`Question ${i+1} is empty`); return; }
      if (q.type==='mcq' && q.options.filter(o => o.trim()).length < 2) { toast.error(`Q${i+1} (MCQ) needs ≥ 2 options`); return; }
    }
    setSaving(true);
    try {
      const payload = questions.map(q => ({
        order: q.order, type: q.type, question: q.question.trim(),
        options: q.type==='mcq' ? q.options.filter(o => o.trim()) : [],
        isRequired: q.isRequired,
      }));
      const { data } = await api.put('/assessment-template', { questions: payload });
      setVersion(data.version);
      setLastUpdatedBy(data.updatedBy?.name || null);
      toast.success(`Template saved as v${data.version}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:14 }}>
      <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="var(--c-30)" strokeWidth="2" style={{ width:24, height:24 }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      <div style={{ fontSize:12, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em' }}>Loading template…</div>
    </div>
  );

  return (
    <div style={{ maxWidth:740, margin:'0 auto', padding:'0 24px 100px' }}>

      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom:20 }}>
        <div>
          <div className="page-title">Assessment Builder</div>
          <div className="page-subtitle" style={{ fontFamily:"'IBM Plex Mono',monospace" }}>
            {version ? `v${version}` : 'No template'}{lastUpdatedBy && ` · ${lastUpdatedBy}`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || questions.length===0}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>

      {/* Info banner */}
      <div className="alert alert-warning" style={{ marginBottom:20, fontSize:12 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14, flexShrink:0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Saving creates a new version and immediately activates it. All trainers will see the new questions on their next session.
      </div>

      {/* ── Questions list ── */}
      {questions.map((q, idx) => (
        <div key={idx} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderLeft:`3px solid ${q.isRequired ? 'var(--bharat-navy)' : 'var(--c-20)'}`, marginBottom:8, transition:'border-color .15s' }}>
          {/* Question toolbar */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--c-10)' }}>
            {/* Number badge */}
            <div style={{ width:24, height:24, background:'var(--bharat-navy)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
              {idx+1}
            </div>
            {/* Move arrows */}
            <IconBtn onClick={() => moveUp(idx)} disabled={idx===0} title="Move up">↑</IconBtn>
            <IconBtn onClick={() => moveDown(idx)} disabled={idx===questions.length-1} title="Move down">↓</IconBtn>
            {/* Type selector */}
            <select value={q.type} onChange={e => updateQ(idx, { type: e.target.value, options: e.target.value==='mcq' ? (q.options.length ? q.options : ['','']) : [] })}
              style={{ border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'4px 8px', fontSize:12, color:'var(--text-primary)', fontWeight:600, fontFamily:'inherit', cursor:'pointer', outline:'none' }}>
              <option value="text">Text</option>
              <option value="mcq">MCQ</option>
            </select>
            {/* Required toggle */}
            <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--text-secondary)', cursor:'pointer', marginLeft:4, userSelect:'none' }}>
              <input type="checkbox" checked={q.isRequired} onChange={e => updateQ(idx, { isRequired: e.target.checked })} style={{ width:14, height:14, accentColor:'var(--bharat-navy)' }} />
              Required
            </label>
            {/* Remove */}
            <div style={{ marginLeft:'auto' }}>
              <IconBtn onClick={() => removeQuestion(idx)} danger title="Remove question">×</IconBtn>
            </div>
          </div>

          {/* Question body */}
          <div style={{ padding:'14px' }}>
            <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)', marginBottom:6 }}>
              Question Text
            </label>
            <input
              style={{ width:'100%', border:'none', borderBottom:'1px solid var(--border-strong)', background:'var(--c-10)', padding:'8px 10px', fontSize:14, fontFamily:'inherit', outline:'none', color:'var(--text-primary)' }}
              placeholder="Enter the question…"
              value={q.question}
              onChange={e => updateQ(idx, { question: e.target.value })}
            />

            {/* MCQ options */}
            {q.type === 'mcq' && (
              <div style={{ marginTop:14 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)', marginBottom:8 }}>
                  Options
                </label>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
                    <div style={{ width:22, height:22, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--text-helper)', flexShrink:0, fontFamily:"'IBM Plex Mono',monospace", background:'var(--surface)' }}>
                      {String.fromCharCode(65+oi)}
                    </div>
                    <input
                      style={{ flex:1, border:'none', borderBottom:'1px solid var(--border)', background:'transparent', padding:'6px 0', fontSize:13, fontFamily:'inherit', outline:'none', color:'var(--text-primary)' }}
                      placeholder={`Option ${String.fromCharCode(65+oi)}`}
                      value={opt}
                      onChange={e => updateOption(idx, oi, e.target.value)}
                    />
                    <IconBtn onClick={() => removeOption(idx, oi)} disabled={q.options.length <= 2} danger title="Remove option">×</IconBtn>
                  </div>
                ))}
                <button onClick={() => addOption(idx)}
                  style={{ marginTop:6, fontSize:12, color:'var(--bharat-navy)', background:'var(--c-10)', border:'1px solid var(--border)', padding:'5px 12px', cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>
                  + Option
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add Question */}
      <button onClick={addQuestion}
        style={{ width:'100%', padding:'12px', border:'1px dashed var(--border-strong)', background:'transparent', color:'var(--text-secondary)', fontWeight:600, fontSize:14, cursor:'pointer', marginBottom:20, fontFamily:'inherit', letterSpacing:'.02em', transition:'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background='var(--c-10)'}
        onMouseLeave={e => e.currentTarget.style.background='transparent'}>
        + Add Question
      </button>

      {/* Bottom save bar */}
      <div style={{ position:'fixed', bottom:0, left:'var(--sidebar-w)', right:0, background:'var(--surface)', borderTop:'1px solid var(--border)', padding:'12px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:100 }}>
        <div style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono',monospace" }}>
          {questions.length} question{questions.length!==1?'s':''} · {questions.filter(q => q.isRequired).length} required
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || questions.length===0}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
          {saving ? 'Saving…' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
