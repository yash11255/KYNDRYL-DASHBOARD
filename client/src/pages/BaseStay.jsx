import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getCurrentPosition } from '../utils/geo';
import GeoCamera from '../components/GeoCamera';

const fmt    = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const rupee  = n => `₹${(n || 0).toLocaleString('en-IN')}`;

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-helper)', marginBottom: 12 }}>
    {children}
  </div>
);

const KV = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    <div style={{ fontSize: 11, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value || '—'}</div>
  </div>
);

export default function BaseStay() {
  const [stays,     setStays]     = useState([]);
  const [active,    setActive]    = useState(null);
  const [showForm,  setShowForm]  = useState(false);
  const [locating,  setLocating]  = useState(false);
  const [form, setForm] = useState({
    hotelName: '', hotelAddress: '', checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: '', district: '', notes: '', latitude: null, longitude: null, locationName: '',
  });

  const load = async () => {
    const { data } = await api.get('/basestay/mine');
    setStays(data);
    if (data.length && !active) setActive(data[0]._id);
  };
  useEffect(() => { load(); }, []);

  const captureLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.latitude}&lon=${pos.longitude}&format=json`);
      const d = await r.json();
      const loc = d.display_name || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`;
      setForm(f => ({ ...f, latitude: pos.latitude, longitude: pos.longitude, locationName: loc, hotelAddress: loc }));
      toast.success('Location captured');
    } catch { toast.error('Could not get location'); }
    setLocating(false);
  };

  const createStay = async () => {
    if (!form.hotelName || !form.checkInDate) return toast.error('Hotel name & check-in date required');
    try {
      await api.post('/basestay', form);
      toast.success('Base stay registered');
      setShowForm(false);
      setForm({ hotelName: '', hotelAddress: '', checkInDate: new Date().toISOString().split('T')[0], checkOutDate: '', district: '', notes: '', latitude: null, longitude: null, locationName: '' });
      load();
    } catch { toast.error('Failed to save'); }
  };

  const currentStay = stays.find(s => s._id === active);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', margin: 0, letterSpacing: '-.01em' }}>
            <strong style={{ fontWeight: 700 }}>Base Stay</strong>
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>Hotel & accommodation tracking per district deployment</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? 'Cancel' : '+ Register Hotel'}
        </button>
      </div>

      {/* ── Register form ── */}
      {showForm && (
        <div style={{ marginBottom: 24, border: '1px solid var(--border)', borderLeft: '3px solid var(--bharat-navy)', background: 'var(--surface)' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            Register New Base Stay
          </div>
          <div className="form-grid-2" style={{ padding: '18px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Hotel / Accommodation Name *</label>
              <input className="form-input" value={form.hotelName} onChange={e => setForm(f => ({ ...f, hotelName: e.target.value }))} placeholder="Hotel Rajputana, Dharamshala…" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">District</label>
              <input className="form-input" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="Chamba, HP" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Check-in Date *</label>
              <input className="form-input" type="date" value={form.checkInDate} onChange={e => setForm(f => ({ ...f, checkInDate: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Expected Check-out</label>
              <input className="form-input" type="date" value={form.checkOutDate} onChange={e => setForm(f => ({ ...f, checkOutDate: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
              <label className="form-label">Hotel Location</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" style={{ flex: 1 }} value={form.hotelAddress} onChange={e => setForm(f => ({ ...f, hotelAddress: e.target.value }))} placeholder="Address or tap GPS" />
                <button type="button" className="btn btn-outline btn-sm" onClick={captureLocation} disabled={locating} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {locating ? 'Locating…' : 'GPS Pin'}
                </button>
              </div>
              {form.latitude && (
                <div style={{ fontSize: 11, color: 'var(--kyndryl-green)', marginTop: 5, fontFamily: "'IBM Plex Mono',monospace" }}>
                  Captured: {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0, gridColumn: '1/-1' }}>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Contact, room no, etc." />
            </div>
          </div>
          <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--c-10)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={createStay}>Save Stay</button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {stays.length === 0 && !showForm && (
        <div className="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40, margin: '0 auto 14px', display: 'block', opacity: .4 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10" />
          </svg>
          <p>No base stays registered yet. When you travel to a district, register your hotel here.</p>
        </div>
      )}

      {/* ── Two-panel layout ── */}
      {stays.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 1, background: 'var(--border)', alignItems: 'start' }} className="basestay-grid">
          {/* Stay list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>
            {stays.map(s => (
              <div key={s._id} onClick={() => setActive(s._id)}
                style={{ background: active === s._id ? 'var(--bharat-navy)' : 'var(--surface)', padding: '14px 16px', cursor: 'pointer', borderLeft: active === s._id ? '3px solid var(--kyndryl-green)' : '3px solid transparent', transition: 'background .12s' }}
                onMouseEnter={e => { if (active !== s._id) e.currentTarget.style.background = 'var(--c-10)'; }}
                onMouseLeave={e => { if (active !== s._id) e.currentTarget.style.background = 'var(--surface)'; }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: active === s._id ? '#fff' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.hotelName}</div>
                <div style={{ fontSize: 11, color: active === s._id ? 'rgba(255,255,255,.6)' : 'var(--text-secondary)', marginTop: 3, fontFamily: "'IBM Plex Mono',monospace" }}>
                  {s.district}
                </div>
                <div style={{ fontSize: 11, color: active === s._id ? 'rgba(255,255,255,.5)' : 'var(--text-helper)', marginTop: 2 }}>
                  {fmt(s.checkInDate)} → {s.checkOutDate ? fmt(s.checkOutDate) : 'ongoing'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: active === s._id ? 'var(--kyndryl-green)' : 'var(--kyndryl-green)', marginTop: 6 }}>{rupee(s.totalAmount)}</div>
              </div>
            ))}
          </div>

          {/* Detail */}
          {currentStay && <StayDetail stay={currentStay} onRefresh={load} />}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .basestay-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function StayDetail({ stay, onRefresh }) {
  const [payAmt,    setPayAmt]    = useState('');

  const addPayment = async (photo) => {
    if (!payAmt && !photo) return;
    try {
      await api.post(`/basestay/${stay._id}/payment`, {
        filename: photo?.filename || '', url: photo?.url || '', amount: Number(payAmt) || 0,
      });
      toast.success('Payment added');
      setPayAmt('');
      onRefresh();
    } catch { toast.error('Failed'); }
  };

  return (
    <div style={{ background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)' }}>

      {/* Hotel info card */}
      <div style={{ background: 'var(--surface)', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{stay.hotelName}</h2>
            {stay.hotelAddress && <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, maxWidth: 380 }}>{stay.hotelAddress}</div>}
            {stay.latitude && (
              <a href={`https://maps.google.com/?q=${stay.latitude},${stay.longitude}`} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--blue)', fontWeight: 600, borderBottom: '1px solid var(--blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                View on Maps
              </a>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--bharat-navy)', fontVariantNumeric: 'tabular-nums' }}>
              ₹{(stay.totalAmount || 0).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total paid</div>
          </div>
        </div>

        {/* KV row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <KV label="District"   value={stay.district} />
          <KV label="Check-in"   value={new Date(stay.checkInDate).toLocaleDateString('en-IN')} />
          <KV label="Check-out"  value={stay.checkOutDate ? new Date(stay.checkOutDate).toLocaleDateString('en-IN') : 'Ongoing'} />
        </div>

        {stay.notes && (
          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-secondary)', background: 'var(--c-10)', padding: '10px 12px', borderLeft: '2px solid var(--border-strong)' }}>
            {stay.notes}
          </div>
        )}
      </div>

      {/* Payment records */}
      <div style={{ background: 'var(--surface)', padding: '20px' }}>
        <SectionLabel>Hotel Payment Records</SectionLabel>

        {stay.paymentScreenshots?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
            {stay.paymentScreenshots.map((p, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--c-10)', padding: 10 }}>
                {p.url && (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt="Payment" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  </a>
                )}
                <div style={{ marginTop: 6, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--bharat-navy)' }}>₹{(p.amount || 0).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-helper)', fontFamily: "'IBM Plex Mono',monospace" }}>
                  {new Date(p.uploadedAt).toLocaleDateString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-helper)', marginBottom: 16 }}>No payment records yet.</div>
        )}

        {/* Add payment */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>Add Payment Receipt</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">Amount (₹)</label>
              <input className="form-input" type="number" placeholder="1500" value={payAmt} onChange={e => setPayAmt(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => addPayment()}>Add</button>
          </div>
          <GeoCamera label="Photograph Receipt" tag="hotel_payment" onCapture={(photo) => addPayment(photo)} />
        </div>
      </div>
    </div>
  );
}
