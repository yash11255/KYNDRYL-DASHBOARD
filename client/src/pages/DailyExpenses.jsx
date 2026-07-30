import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import SimpleCamera from '../components/SimpleCamera';

const TABS = [
  { key: 'food',           label: 'Food',       accent: '#f1c21b', icon: 'M3 11l19-9-9 19-2-8-8-2z', readOnly: false },
  { key: 'transportation', label: 'Travel',     accent: 'var(--bharat-navy)', icon: 'M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v5M16 17H9m7 0a2 2 0 100-4 2 2 0 000 4M5 17a2 2 0 100-4 2 2 0 000 4', readOnly: false },
  { key: 'fuel',           label: 'Fuel Bills', accent: 'var(--red)', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z', readOnly: true },
];

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'];
const today  = () => new Date().toISOString().split('T')[0];
const rupee  = n => `₹${(n || 0).toLocaleString('en-IN')}`;
const fmtTime = t => t ? new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
const emptyForm = () => ({ name: '', amount: '', mealType: 'Breakfast', time: new Date().toTimeString().slice(0, 5), remarks: '' });

/* ── Bill row ── */
const BillRow = ({ bill, tab, onRemove }) => {
  const accent = TABS.find(t => t.key === tab)?.accent || 'var(--bharat-navy)';
  const readOnly = TABS.find(t => t.key === tab)?.readOnly;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--c-10)', alignItems: 'flex-start' }}>
      {/* Photos */}
      {(bill.billPhoto?.url || bill.paymentProof?.url) && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {bill.billPhoto?.url && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <a href={bill.billPhoto.url} target="_blank" rel="noreferrer">
                <img src={bill.billPhoto.url} alt="Bill" style={{ width: 52, height: 52, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }} />
              </a>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(22,22,22,.75)', color: '#fff', fontSize: 8, textAlign: 'center', padding: '2px', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>BILL</div>
            </div>
          )}
          {bill.paymentProof?.url && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <a href={bill.paymentProof.url} target="_blank" rel="noreferrer">
                <img src={bill.paymentProof.url} alt="Payment" style={{ width: 52, height: 52, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }} />
              </a>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(22,22,22,.75)', color: '#fff', fontSize: 8, textAlign: 'center', padding: '2px', fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>PAID</div>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {bill.mealType && (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#92400e', background: '#fef3c7', padding: '2px 6px', marginBottom: 4, display: 'inline-block' }}>
            {bill.mealType}
          </span>
        )}
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, marginTop: bill.mealType ? 3 : 0 }}>
          {bill.name || (tab === 'fuel' ? (bill.schoolName || 'Fuel') : 'Bill')}
        </div>
        {bill.remarks && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{bill.remarks}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-helper)', marginTop: 2, fontFamily: "'IBM Plex Mono',monospace" }}>{fmtTime(bill.time)}</div>
      </div>

      {/* Amount + remove */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>
          {rupee(bill.amount || bill.totalFuelAmount)}
        </div>
        {!readOnly && (
          <button onClick={() => onRemove(bill._id)}
            style={{ width: 24, height: 24, background: 'rgba(218,30,40,.08)', border: '1px solid var(--red)', color: 'var(--red)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
export default function DailyExpenses() {
  const [date,         setDate]         = useState(today());
  const [tab,          setTab]          = useState('food');
  const [record,       setRecord]       = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [addOpen,      setAddOpen]      = useState(false);
  const [form,         setForm]         = useState(emptyForm());
  const [billPhoto,    setBillPhoto]    = useState(null);
  const [paymentProof, setPaymentProof] = useState(null);
  const [formSaving,   setFormSaving]   = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/expenses/day/${date}`); setRecord(data); }
    catch { toast.error('Failed to load'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [date]);

  const foodArray = (food) => {
    if (!food) return [];
    if (Array.isArray(food)) return food;
    return [...(food.breakfast||[]), ...(food.lunch||[]), ...(food.dinner||[])];
  };

  const bills = () => {
    if (!record) return [];
    if (tab === 'fuel')           return record.fuelBills || [];
    if (tab === 'transportation') return record.transportation || [];
    return foodArray(record.food);
  };

  const totalByTab = (key) => {
    if (!record) return 0;
    if (key === 'fuel')           return record.totalFuel || 0;
    if (key === 'transportation') return record.totalTransportation || 0;
    return foodArray(record.food).reduce((s, b) => s + (b.amount || 0), 0);
  };

  const grandTotal = ['food','transportation','fuel'].reduce((s, k) => s + totalByTab(k), 0);

  const addBill = async () => {
    if (!form.amount) { toast.error('Enter amount'); return; }
    setFormSaving(true);
    try {
      await api.post(`/expenses/day/${date}/bill`, {
        category: tab,
        name: form.name, amount: Number(form.amount) || 0, remarks: form.remarks,
        mealType: tab === 'food' ? form.mealType : undefined,
        time: new Date(`${date}T${form.time}:00`).toISOString(),
        billPhoto:    billPhoto    ? { url: billPhoto.url,    filename: billPhoto.filename }    : undefined,
        paymentProof: paymentProof ? { url: paymentProof.url, filename: paymentProof.filename } : undefined,
        attachment:   billPhoto    ? { url: billPhoto.url,    filename: billPhoto.filename }    : undefined,
      });
      toast.success('Bill saved');
      setForm(emptyForm()); setBillPhoto(null); setPaymentProof(null); setAddOpen(false);
      load();
    } catch { toast.error('Failed to save'); }
    setFormSaving(false);
  };

  const removeBill = async (billId) => {
    if (!window.confirm('Remove this bill?')) return;
    try { await api.delete(`/expenses/day/${date}/bill/${tab}/${billId}`); toast.success('Removed'); load(); }
    catch { toast.error('Failed'); }
  };

  const activeTab = TABS.find(t => t.key === tab);

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 80px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 300, color: 'var(--text-primary)', margin: 0, letterSpacing: '-.01em' }}>
            <strong style={{ fontWeight: 700 }}>Daily</strong> Expenses
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0', fontSize: 13 }}>Food, travel &amp; fuel per day</p>
        </div>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }} value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* ── Category KPI tiles ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--border)', marginBottom: 1 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setAddOpen(false); }}
            style={{ background: tab === t.key ? t.accent : 'var(--surface)', padding: '16px 12px', border: 'none', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit', transition: 'background .15s', borderTop: `3px solid ${t.accent}` }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={tab === t.key ? '#fff' : t.accent} strokeWidth="1.75" style={{ width: 20, height: 20, margin: '0 auto 6px', display: 'block' }}>
              <path d={t.icon} />
            </svg>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: tab === t.key ? 'rgba(255,255,255,.7)' : 'var(--text-helper)', marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: tab === t.key ? '#fff' : t.accent, fontVariantNumeric: 'tabular-nums' }}>{rupee(totalByTab(t.key))}</div>
          </button>
        ))}
      </div>

      {/* ── Grand total bar ── */}
      <div style={{ background: 'var(--bharat-navy)', borderLeft: '4px solid var(--kyndryl-green)', padding: '14px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · Total
        </div>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{rupee(grandTotal)}</div>
      </div>

      {/* ── Bill panel ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {/* Panel header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--c-10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={activeTab?.accent} strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}>
              <path d={activeTab?.icon} />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{activeTab?.label} Bills</span>
            {bills().length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, background: activeTab?.accent + '20', color: activeTab?.accent, padding: '2px 8px' }}>{bills().length}</span>
            )}
          </div>
          {!activeTab?.readOnly && (
            <button onClick={() => setAddOpen(o => !o)} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', background: addOpen ? 'var(--c-20)' : 'var(--bharat-navy)', color: addOpen ? 'var(--text-secondary)' : '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
              {addOpen ? 'Cancel' : '+ Add Bill'}
            </button>
          )}
        </div>

        {/* Fuel info */}
        {activeTab?.readOnly && (
          <div className="alert alert-warning" style={{ margin: 12, fontSize: 12 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Fuel bills are imported from session travel data. Add them in Session → Travel step.
          </div>
        )}

        {/* Empty state */}
        {!loading && bills().length === 0 && !addOpen && (
          <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-helper)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 32, height: 32, margin: '0 auto 10px', display: 'block', opacity: .35 }}>
              <path d={activeTab?.icon} />
            </svg>
            <div style={{ fontSize: 13 }}>No {activeTab?.label} bills for {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</div>
          </div>
        )}

        {/* Bills */}
        {bills().map((bill, i) => <BillRow key={bill._id || i} bill={bill} tab={tab} onRemove={removeBill} />)}

        {/* Tab total */}
        {bills().length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center', background: 'var(--c-10)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{activeTab?.label} Total</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: activeTab?.accent, fontVariantNumeric: 'tabular-nums' }}>{rupee(totalByTab(tab))}</span>
          </div>
        )}

        {/* ── Add Bill form ── */}
        {addOpen && !activeTab?.readOnly && (
          <div style={{ padding: '20px 16px', borderTop: '2px dashed var(--border)' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: activeTab?.accent, marginBottom: 16 }}>Add {activeTab?.label} Bill</div>

            {/* Meal type chips (food only) */}
            {tab === 'food' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginBottom: 8 }}>Meal Type</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {MEAL_TYPES.map(m => (
                    <button key={m} onClick={() => setForm(f => ({ ...f, mealType: m }))}
                      style={{ padding: '6px 12px', border: `1px solid ${form.mealType === m ? '#f1c21b' : 'var(--border)'}`, background: form.mealType === m ? '#fef3c7' : 'var(--surface)', color: form.mealType === m ? '#78350f' : 'var(--text-secondary)', fontWeight: form.mealType === m ? 700 : 400, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="form-grid-2" style={{ marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Merchant / Name</label>
                <input className="form-input" placeholder="Hotel Raj, Petrol Pump…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Amount (₹) *</label>
                <input className="form-input" type="number" placeholder="150" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Time</label>
                <input className="form-input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Remarks</label>
                <input className="form-input" placeholder="Optional note" value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
            </div>

            {/* Photo pair */}
            <div className="form-grid-2" style={{ marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginBottom: 8 }}>Bill Photo</div>
                <SimpleCamera label="Photo of bill/receipt" onCapture={p => setBillPhoto(p)} />
                {billPhoto && (
                  <div style={{ marginTop: 6, position: 'relative', display: 'inline-block' }}>
                    <img src={billPhoto.url} alt="Bill" style={{ width: '100%', height: 70, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }} />
                    <button onClick={() => setBillPhoto(null)} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, background: 'rgba(22,22,22,.7)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginBottom: 8 }}>Payment Proof</div>
                <SimpleCamera label="Payment screenshot" onCapture={p => setPaymentProof(p)} />
                {paymentProof && (
                  <div style={{ marginTop: 6, position: 'relative', display: 'inline-block' }}>
                    <img src={paymentProof.url} alt="Payment" style={{ width: '100%', height: 70, objectFit: 'cover', border: '1px solid var(--border)', display: 'block' }} />
                    <button onClick={() => setPaymentProof(null)} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, background: 'rgba(22,22,22,.7)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addBill} disabled={formSaving || !form.amount}
                className="btn btn-primary btn-full" style={{ height: 44 }}>
                {formSaving ? 'Saving…' : `Save ${activeTab?.label} Bill`}
              </button>
              <button onClick={() => { setAddOpen(false); setBillPhoto(null); setPaymentProof(null); setForm(emptyForm()); }}
                className="btn btn-ghost" style={{ height: 44, flexShrink: 0 }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
