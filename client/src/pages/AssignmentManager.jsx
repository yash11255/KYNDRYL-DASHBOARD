import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const EMPTY = { trainer:'', school:'', date:'', topic:'AI Pathshala', expectedStudents:'', notes:'' };

const STATUS_STYLE = {
  scheduled:   { bg:'#dde6f5', color:'var(--bharat-navy)' },
  completed:   { bg:'#d0f7e1', color:'#065f46' },
  cancelled:   { bg:'#fee2e2', color:'#991b1b' },
  rescheduled: { bg:'#fef3c7', color:'#78350f' },
};

const StatusPill = ({ status }) => {
  const s = STATUS_STYLE[status] || { bg:'var(--c-10)', color:'var(--c-60)' };
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', background:s.bg, color:s.color }}>
      {status}
    </span>
  );
};

const TH = ({ children, right }) => (
  <th style={{ padding:'9px 16px', textAlign: right ? 'right' : 'left', fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', background:'var(--c-10)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
    {children}
  </th>
);

export default function AssignmentManager() {
  const [assignments, setAssignments] = useState([]);
  const [trainers,    setTrainers]    = useState([]);
  const [schools,     setSchools]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState(EMPTY);
  const [editing,     setEditing]     = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [filter,      setFilter]      = useState({ trainerId:'', status:'' });

  useEffect(() => {
    Promise.all([api.get('/admin/assignments'), api.get('/admin/trainers'), api.get('/admin/schools')])
      .then(([a,t,s]) => { setAssignments(a.data); setTrainers(t.data); setSchools(s.data); })
      .finally(() => setLoading(false));
  }, []);

  const openAdd  = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = a => {
    setForm({ trainer: a.trainer._id, school: a.school._id, date: a.date.split('T')[0], topic: a.topic, expectedStudents: a.expectedStudents||'', notes: a.notes||'' });
    setEditing(a._id); setModal(true);
  };

  const handleSubmit = async e => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/admin/assignments/${editing}`, form);
        setAssignments(p => p.map(a => a._id === editing ? data : a));
        toast.success('Assignment updated');
      } else {
        const { data } = await api.post('/admin/assignments', form);
        setAssignments(p => [data, ...p]);
        toast.success('Assignment created');
      }
      setModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this assignment?')) return;
    await api.delete(`/admin/assignments/${id}`);
    setAssignments(p => p.filter(a => a._id !== id));
    toast.success('Deleted');
  };

  const updateStatus = async (id, status) => {
    const { data } = await api.put(`/admin/assignments/${id}`, { status });
    setAssignments(p => p.map(a => a._id === id ? data : a));
    toast.success('Status updated');
  };

  const filtered = assignments.filter(a =>
    (!filter.trainerId || a.trainer._id === filter.trainerId) &&
    (!filter.status    || a.status === filter.status)
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Assignments</div>
          <div className="page-subtitle">Schedule trainers to schools</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Assignment
        </button>
      </div>

      {/* ── Filters ── */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <select className="form-input" style={{ width:'auto', paddingRight:24 }} value={filter.trainerId} onChange={e => setFilter({ ...filter, trainerId: e.target.value })}>
          <option value="">All Trainers</option>
          {trainers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
        </select>
        <select className="form-input" style={{ width:'auto', paddingRight:24 }} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="rescheduled">Rescheduled</option>
        </select>
        {(filter.trainerId || filter.status) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ trainerId:'', status:'' })}>Clear</button>
        )}
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace" }}>{filtered.length} assignment{filtered.length!==1?'s':''}</span>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding:0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <TH>Date</TH>
                <TH>Trainer</TH>
                <TH>School</TH>
                <TH>District</TH>
                <TH>Topic</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:'var(--text-helper)', fontSize:13 }}>
                  Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center' }}>
                  <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)' }}>No assignments found</div>
                </td></tr>
              ) : filtered.map((a, i) => (
                <tr key={a._id} style={{ background: i%2 ? 'rgba(244,244,244,.5)' : '#fff', borderTop:'1px solid var(--c-10)' }}>
                  <td style={{ padding:'11px 16px', whiteSpace:'nowrap', fontSize:12, fontWeight:600, color:'var(--text-primary)', fontFamily:"'IBM Plex Mono',monospace" }}>
                    {new Date(a.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                  </td>
                  <td style={{ padding:'11px 16px' }}>
                    <div style={{ fontWeight:600, fontSize:13 }}>{a.trainer.name}</div>
                    <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono',monospace" }}>{a.trainer.phone}</div>
                  </td>
                  <td style={{ padding:'11px 16px', fontSize:13, fontWeight:500 }}>{a.school.name}</td>
                  <td style={{ padding:'11px 16px', fontSize:12, color:'var(--text-secondary)' }}>{a.school.district}</td>
                  <td style={{ padding:'11px 16px', fontSize:12, color:'var(--text-secondary)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {a.topic}
                  </td>
                  <td style={{ padding:'11px 16px' }}><StatusPill status={a.status} /></td>
                  <td style={{ padding:'11px 16px' }}>
                    <div style={{ display:'flex', gap:5 }}>
                      <button onClick={() => openEdit(a)} style={{ fontSize:11, padding:'4px 10px', border:'1px solid var(--bharat-navy)', background:'transparent', color:'var(--bharat-navy)', cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>Edit</button>
                      {a.status === 'scheduled' && (
                        <button onClick={() => updateStatus(a._id,'cancelled')} style={{ fontSize:11, padding:'4px 10px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-secondary)', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                      )}
                      <button onClick={() => handleDelete(a._id)} style={{ fontSize:11, padding:'4px 10px', border:'1px solid var(--red)', background:'transparent', color:'var(--red)', cursor:'pointer', fontWeight:600, fontFamily:'inherit' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Assignment' : 'New Assignment'}</span>
              <button className="modal-close" onClick={() => setModal(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Trainer *</label>
                  <select className="form-input" required value={form.trainer} onChange={e => setForm({ ...form, trainer: e.target.value })}>
                    <option value="">Select trainer…</option>
                    {trainers.filter(t => t.active).map(t => <option key={t._id} value={t._id}>{t.name} — {t.district}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">School *</label>
                  <select className="form-input" required value={form.school} onChange={e => setForm({ ...form, school: e.target.value })}>
                    <option value="">Select school…</option>
                    {schools.map(s => <option key={s._id} value={s._id}>{s.name} — {s.district}</option>)}
                  </select>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Session Date *</label>
                    <input className="form-input" type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expected Students</label>
                    <input className="form-input" type="number" value={form.expectedStudents} onChange={e => setForm({ ...form, expectedStudents: e.target.value })} placeholder="Approx. count" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Topic</label>
                  <input className="form-input" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Special instructions…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create Assignment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
