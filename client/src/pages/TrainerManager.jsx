import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const EMPTY = { name: '', email: '', password: '', phone: '', district: '', employeeId: '' };

export default function TrainerManager() {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [pwdModal, setPwdModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newPwd, setNewPwd] = useState('');

  useEffect(() => { api.get('/admin/trainers').then(r => setTrainers(r.data)).finally(() => setLoading(false)); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (t) => { setForm({ name: t.name, email: t.email, phone: t.phone || '', district: t.district || '', employeeId: t.employeeId || '', password: '' }); setEditing(t._id); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/admin/trainers/${editing}`, form);
        setTrainers(prev => prev.map(t => t._id === editing ? data : t));
        toast.success('Trainer updated');
      } else {
        const { data } = await api.post('/admin/trainers', form);
        setTrainers(prev => [data, ...prev]);
        toast.success('Trainer added');
      }
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!newPwd || newPwd.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    try {
      await api.put(`/admin/trainers/${pwdModal}/reset-password`, { password: newPwd });
      toast.success('Password reset');
      setPwdModal(null); setNewPwd('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggleActive = async (t) => {
    const { data } = await api.put(`/admin/trainers/${t._id}`, { active: !t.active });
    setTrainers(prev => prev.map(x => x._id === t._id ? data : x));
    toast.success(data.active ? 'Trainer activated' : 'Trainer deactivated');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Trainers</div>
          <div className="page-subtitle">{trainers.filter(t => t.active).length} active trainers</div>
        </div>
        <button className="btn btn-orange" onClick={openAdd}>+ Add Trainer</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>District</th>
                <th>Employee ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading...</td></tr>
              ) : trainers.map(t => (
                <tr key={t._id}>
                  <td style={{ fontWeight: 500 }}>{t.name}</td>
                  <td>{t.email}</td>
                  <td>{t.phone || '—'}</td>
                  <td>{t.district || '—'}</td>
                  <td>{t.employeeId || '—'}</td>
                  <td><span className={`badge ${t.active ? 'badge-green' : 'badge-gray'}`}>{t.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setPwdModal(t._id); setNewPwd(''); }}>Reset Pwd</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t)}>{t.active ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editing ? 'Edit Trainer' : 'Add Trainer'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Trainer's full name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="trainer@bharatcares.in" disabled={!!editing} />
                </div>
                {!editing && (
                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input className="form-input" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
                  </div>
                )}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="98XXXXXXXX" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Employee ID</label>
                    <input className="form-input" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} placeholder="TR001" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">District / Region</label>
                  <input className="form-input" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} placeholder="e.g. Jaipur" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add Trainer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pwdModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPwdModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <span className="modal-title">Reset Password</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPwdModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPwdModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={resetPassword}>Reset Password</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
