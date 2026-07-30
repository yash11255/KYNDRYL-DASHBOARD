import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const EMPTY = { name: '', district: '', block: '', address: '', googleMapsLink: '', latitude: '', longitude: '', principalName: '', principalPhone: '', totalStudents: '' };

export default function SchoolManager() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchSchools(); }, []);

  const fetchSchools = () => {
    api.get('/admin/schools').then(r => setSchools(r.data)).finally(() => setLoading(false));
  };

  const openAdd = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (s) => { setForm({ ...s, latitude: s.latitude || '', longitude: s.longitude || '', totalStudents: s.totalStudents || '' }); setEditing(s._id); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/admin/schools/${editing}`, form);
        setSchools(prev => prev.map(s => s._id === editing ? data : s));
        toast.success('School updated');
      } else {
        const { data } = await api.post('/admin/schools', form);
        setSchools(prev => [data, ...prev]);
        toast.success('School added');
      }
      setModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const filtered = schools.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.district.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Schools</div>
          <div className="page-subtitle">{schools.length} partner schools</div>
        </div>
        <button className="btn btn-orange" onClick={openAdd}>+ Add School</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input className="form-input" placeholder="Search by name or district..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>School Name</th>
                <th>District</th>
                <th>Block</th>
                <th>Principal</th>
                <th>Students</th>
                <th>Maps</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No schools found</td></tr>
              ) : filtered.map(s => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td>{s.district}</td>
                  <td>{s.block || '—'}</td>
                  <td>{s.principalName ? `${s.principalName}${s.principalPhone ? ` · ${s.principalPhone}` : ''}` : '—'}</td>
                  <td>{s.totalStudents || '—'}</td>
                  <td>
                    {s.googleMapsLink ? (
                      <a href={s.googleMapsLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">📍 Open</a>
                    ) : '—'}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Edit</button>
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
              <span className="modal-title">{editing ? 'Edit School' : 'Add School'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">School Name *</label>
                  <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Govt. Senior Secondary School..." />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">District *</label>
                    <input className="form-input" required value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} placeholder="e.g. Jaipur" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Block</label>
                    <input className="form-input" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} placeholder="e.g. Sanganer" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address</label>
                  <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Full address" />
                </div>
                <div className="form-group">
                  <label className="form-label">Google Maps Link</label>
                  <input className="form-input" value={form.googleMapsLink} onChange={e => setForm({ ...form, googleMapsLink: e.target.value })} placeholder="https://maps.google.com/..." />
                  <div className="form-hint">Paste the Maps share link for this school</div>
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Latitude (optional)</label>
                    <input className="form-input" type="number" step="any" value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} placeholder="26.9124" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Longitude (optional)</label>
                    <input className="form-input" type="number" step="any" value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} placeholder="75.7873" />
                  </div>
                </div>
                <div className="form-hint" style={{ marginTop: -8, marginBottom: 16 }}>
                  Latitude & Longitude enable auto distance calculation for trainers
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Principal Name</label>
                    <input className="form-input" value={form.principalName} onChange={e => setForm({ ...form, principalName: e.target.value })} placeholder="Mr. / Mrs. ..." />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Principal Phone</label>
                    <input className="form-input" value={form.principalPhone} onChange={e => setForm({ ...form, principalPhone: e.target.value })} placeholder="98XXXXXXXX" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Total Students (approx.)</label>
                  <input className="form-input" type="number" value={form.totalStudents} onChange={e => setForm({ ...form, totalStudents: e.target.value })} placeholder="e.g. 450" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update School' : 'Add School'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
