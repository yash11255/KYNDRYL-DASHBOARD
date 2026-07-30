import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const ROLES = [
  { value: 'manager',   label: 'Manager',   color: '#7c3aed' },
  { value: 'team_lead', label: 'Team Lead', color: '#0043ce' },
  { value: 'trainer',   label: 'Trainer',   color: '#00c73c' },
  { value: 'reviewer',  label: 'Reviewer',  color: '#F4622A' },
];

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]));

const RoleBadge = ({ role }) => {
  const r = ROLE_MAP[role] || { label: role, color: 'var(--c-50)' };
  return (
    <span style={{ display:'inline-block', padding:'2px 8px', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', background: r.color + '15', color: r.color, border:`1px solid ${r.color}30` }}>
      {r.label}
    </span>
  );
};

const FieldGroup = ({ label, children }) => (
  <div>
    <label style={{ display:'block', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text-secondary)', marginBottom:6 }}>{label}</label>
    {children}
  </div>
);

export default function HierarchyManager() {
  const [members,        setMembers]        = useState([]);
  const [showForm,       setShowForm]       = useState(false);
  const [editUser,       setEditUser]       = useState(null);
  const [viewTree,       setViewTree]       = useState(false);
  const [filterRole,     setFilterRole]     = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [resetPwdUser,   setResetPwdUser]   = useState(null);
  const [newPwd,         setNewPwd]         = useState('');
  const [form, setForm] = useState({ name:'', email:'', password:'', phone:'', district:'', employeeId:'', role:'trainer', managerId:'', teamLeadId:'', team:'' });

  const load = async () => { const { data } = await api.get('/admin/members'); setMembers(data); };
  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ name:'', email:'', password:'', phone:'', district:'', employeeId:'', role:'trainer', managerId:'', teamLeadId:'', team:'' });

  const handleSubmit = async () => {
    if (!form.name || !form.email) return toast.error('Name & email required');
    try {
      if (editUser) { await api.put(`/admin/trainers/${editUser._id}`, form); toast.success('Updated'); }
      else { if (!form.password) return toast.error('Password required'); await api.post('/admin/trainers', form); toast.success('Member added'); }
      setShowForm(false); setEditUser(null); resetForm(); load();
    } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  };

  const openEdit = u => {
    setEditUser(u);
    setForm({ name:u.name, email:u.email, password:'', phone:u.phone||'', district:u.district||'', employeeId:u.employeeId||'', role:u.role, managerId:u.managerId?._id||'', teamLeadId:u.teamLeadId?._id||'', team:u.team||'' });
    setShowForm(true);
  };

  const toggleActive = async u => { await api.put(`/admin/trainers/${u._id}`, { active: !u.active }); load(); };

  const provisionDrive = async u => {
    try { const { data } = await api.post(`/admin/trainers/${u._id}/provision-drive`); toast.success(data.message || 'Drive folder created'); load(); }
    catch (err) { toast.error(err.response?.data?.message || 'Drive provision failed'); }
  };

  const resetPassword = async () => {
    if (!newPwd || newPwd.length < 6) return toast.error('Min 6 chars');
    await api.put(`/admin/trainers/${resetPwdUser._id}/reset-password`, { password: newPwd });
    toast.success('Password reset'); setResetPwdUser(null); setNewPwd('');
  };

  const managers  = members.filter(m => m.role === 'manager');
  const teamLeads = members.filter(m => m.role === 'team_lead');
  const districts = [...new Set(members.map(m => m.district).filter(Boolean))].sort();

  const filtered = members.filter(m =>
    (!filterRole || m.role === filterRole) &&
    (!filterDistrict || (m.district||'').toLowerCase() === filterDistrict.toLowerCase())
  );

  const treeManagers = members.filter(m => m.role === 'manager');
  const getTeamLeads = mgr => members.filter(m => m.role === 'team_lead' && m.managerId?._id === mgr._id);
  const getTrainers  = (parentId, type) => members.filter(m => ['trainer','reviewer'].includes(m.role) && (
    type === 'tl' ? m.teamLeadId?._id === parentId : (m.managerId?._id === parentId && !m.teamLeadId)
  ));

  const TH = ({ children }) => (
    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'var(--text-helper)', textTransform:'uppercase', letterSpacing:'.07em', background:'var(--c-10)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>
      {children}
    </th>
  );

  const ActionBtn = ({ onClick, children, danger, muted }) => (
    <button onClick={onClick} style={{
      fontSize:11, padding:'4px 10px', border:'1px solid',
      borderColor: danger ? 'var(--red)' : muted ? 'var(--border)' : 'var(--bharat-navy)',
      background:'transparent',
      color: danger ? 'var(--red)' : muted ? 'var(--text-secondary)' : 'var(--bharat-navy)',
      cursor:'pointer', fontWeight:600, fontFamily:'inherit', letterSpacing:'.02em',
    }}>{children}</button>
  );

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="page-title">Team Hierarchy</div>
          <div className="page-subtitle">Manage members — managers, team leads, trainers, reviewers</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewTree(v => !v)}>
            {viewTree ? 'Table View' : 'Org Tree'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { resetForm(); setEditUser(null); setShowForm(true); }}>
            + Add Member
          </button>
        </div>
      </div>

      {/* ── Add / Edit form ── */}
      {showForm && (
        <div style={{ marginBottom:20, border:'1px solid var(--border)', borderLeft:'3px solid var(--bharat-navy)', background:'var(--surface)' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
              {editUser ? `Edit — ${editUser.name}` : 'Add Team Member'}
            </div>
            <button className="modal-close" onClick={() => { setShowForm(false); setEditUser(null); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="form-grid-3" style={{ padding:'20px' }}>
            <FieldGroup label="Full Name *">
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Email *">
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!!editUser} />
            </FieldGroup>
            {!editUser && (
              <FieldGroup label="Password *">
                <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </FieldGroup>
            )}
            <FieldGroup label="Phone">
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Employee ID">
              <input className="form-input" value={form.employeeId} onChange={e => setForm(f => ({ ...f, employeeId: e.target.value }))} />
            </FieldGroup>
            <FieldGroup label="Role *">
              <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="District">
              <input className="form-input" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="e.g. Gorakhpur" />
            </FieldGroup>
            <FieldGroup label="Team">
              <input className="form-input" value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} placeholder="Team A, Team B…" />
            </FieldGroup>
            {['trainer','team_lead','reviewer'].includes(form.role) && (
              <FieldGroup label="Reports to Manager">
                <select className="form-input" value={form.managerId} onChange={e => setForm(f => ({ ...f, managerId: e.target.value }))}>
                  <option value="">— None —</option>
                  {managers.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </FieldGroup>
            )}
            {form.role === 'trainer' && (
              <FieldGroup label="Team Lead (optional)">
                <select className="form-input" value={form.teamLeadId} onChange={e => setForm(f => ({ ...f, teamLeadId: e.target.value }))}>
                  <option value="">— No Team Lead —</option>
                  {teamLeads.map(tl => <option key={tl._id} value={tl._id}>{tl.name} ({tl.district || '—'})</option>)}
                </select>
              </FieldGroup>
            )}
          </div>
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', background:'var(--c-10)', display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditUser(null); }}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSubmit}>{editUser ? 'Update' : 'Add Member'}</button>
          </div>
        </div>
      )}

      {/* ── Password reset modal ── */}
      {resetPwdUser && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <span className="modal-title">Reset Password — {resetPwdUser.name}</span>
              <button className="modal-close" onClick={() => setResetPwdUser(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Password (min 6 chars)</label>
                <input className="form-input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setResetPwdUser(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={resetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Org Tree ── */}
      {viewTree && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-header"><span className="card-title">Organisation Tree</span></div>
          {treeManagers.map(mgr => (
            <div key={mgr._id} style={{ marginBottom:16 }}>
              <TreeNode member={mgr} indent={0} />
              {getTrainers(mgr._id,'mgr').map(t => <TreeNode key={t._id} member={t} indent={1} />)}
              {getTeamLeads(mgr).map(tl => (
                <div key={tl._id}>
                  <TreeNode member={tl} indent={1} />
                  {getTrainers(tl._id,'tl').map(t => <TreeNode key={t._id} member={t} indent={2} />)}
                </div>
              ))}
            </div>
          ))}
          {members.filter(m => ['trainer','reviewer'].includes(m.role) && !m.managerId && !m.teamLeadId).length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-helper)', padding:'8px 0', marginTop:8, borderTop:'1px solid var(--border)' }}>Unassigned</div>
              {members.filter(m => ['trainer','reviewer'].includes(m.role) && !m.managerId && !m.teamLeadId).map(t => <TreeNode key={t._id} member={t} indent={0} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {!viewTree && (
        <>
          {/* Filters */}
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <select className="form-input" style={{ width:'auto', paddingRight:24 }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All roles</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select className="form-input" style={{ width:'auto', paddingRight:24 }} value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
              <option value="">All districts</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-helper)', fontFamily:"'IBM Plex Mono',monospace" }}>{filtered.length} members</span>
          </div>

          <div className="card" style={{ padding:0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['Name', 'Role', 'District / Team', 'Reports To', 'Phone', 'Status', 'Actions'].map(h => <TH key={h}>{h}</TH>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, i) => (
                    <tr key={m._id} style={{ background: i%2 ? 'rgba(244,244,244,.5)' : '#fff', opacity: m.active ? 1 : 0.5, borderTop:'1px solid var(--c-10)' }}>
                      {/* Name */}
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{m.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono',monospace", marginTop:2 }}>{m.email}</div>
                        {m.employeeId && <div style={{ fontSize:10, color:'var(--text-helper)', marginTop:1 }}>ID: {m.employeeId}</div>}
                        {m.driveFolderUrl ? (
                          <a href={m.driveFolderUrl} target="_blank" rel="noreferrer" style={{ fontSize:10, color:'var(--bharat-navy)', display:'inline-flex', alignItems:'center', gap:3, marginTop:3, fontWeight:600, borderBottom:'1px solid var(--bharat-navy)', textDecoration:'none' }}>
                            Drive ↗
                          </a>
                        ) : (['trainer','reviewer'].includes(m.role) && (
                          <span style={{ fontSize:10, color:'#f1c21b', marginTop:3, display:'inline-block' }}>No Drive folder</span>
                        ))}
                      </td>
                      {/* Role */}
                      <td style={{ padding:'12px 16px' }}><RoleBadge role={m.role} /></td>
                      {/* District/Team */}
                      <td style={{ padding:'12px 16px', fontSize:12 }}>
                        {m.district && <div style={{ fontWeight:500, color:'var(--text-primary)' }}>{m.district}</div>}
                        {m.team && <div style={{ color:'var(--text-secondary)', marginTop:2 }}>{m.team}</div>}
                      </td>
                      {/* Reports to */}
                      <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-secondary)' }}>
                        {m.managerId?.name && <div>Mgr: {m.managerId.name}</div>}
                        {m.teamLeadId?.name && <div style={{ color:'var(--text-helper)', marginTop:2 }}>TL: {m.teamLeadId.name}</div>}
                        {!m.managerId?.name && !m.teamLeadId?.name && <span style={{ color:'var(--c-30)' }}>—</span>}
                      </td>
                      {/* Phone */}
                      <td style={{ padding:'12px 16px', fontSize:12, color:'var(--text-secondary)', fontFamily:"'IBM Plex Mono',monospace" }}>
                        {m.phone || <span style={{ color:'var(--c-30)' }}>—</span>}
                      </td>
                      {/* Status */}
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color: m.active ? 'var(--kyndryl-green)' : 'var(--red)' }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background: m.active ? 'var(--kyndryl-green)' : 'var(--red)', flexShrink:0 }} />
                          {m.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                          <ActionBtn onClick={() => openEdit(m)}>Edit</ActionBtn>
                          <ActionBtn onClick={() => setResetPwdUser(m)} muted>Reset Pwd</ActionBtn>
                          <ActionBtn onClick={() => toggleActive(m)} danger={m.active}>
                            {m.active ? 'Deactivate' : 'Activate'}
                          </ActionBtn>
                          {['trainer','reviewer'].includes(m.role) && !m.driveFolderId && (
                            <ActionBtn onClick={() => provisionDrive(m)} muted>Drive</ActionBtn>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TreeNode({ member, indent }) {
  const color = (ROLE_MAP[member.role] || { color: 'var(--c-50)' }).color;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', paddingLeft: indent * 24 }}>
      {indent > 0 && <div style={{ width:16, height:1, background:'var(--border)', flexShrink:0 }} />}
      <div style={{ width:30, height:30, background: color + '15', border:`1px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', color, fontWeight:700, fontSize:13, flexShrink:0 }}>
        {member.name[0]}
      </div>
      <div>
        <span style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{member.name}</span>
        <RoleBadge role={member.role} />
        {member.district && <span style={{ marginLeft:6, fontSize:11, color:'var(--text-secondary)' }}>{member.district}</span>}
        {member.team && <span style={{ marginLeft:6, fontSize:11, color:'var(--text-helper)' }}>({member.team})</span>}
      </div>
    </div>
  );
}
