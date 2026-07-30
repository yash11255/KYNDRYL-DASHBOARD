import { useState, useEffect } from 'react';
import api from '../services/api';

const ACTION_LABELS = {
  edit_school: '✏️ School data edited',
  edit_session: '✏️ Session data edited',
  session_review_submitted: '📋 Review submitted',
  add_note: '📝 Note added',
};

const fmtDT = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function AuditLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filters, setFilters]   = useState({ from: '', to: '', entityType: '' });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.entityType) params.set('entityType', filters.entityType);
      const { data } = await api.get(`/audit?${params}`);
      setLogs(data);
    } catch {}
    setLoading(false);
  };

  const markRead = async () => {
    await api.put('/audit/mark-read');
    load();
  };

  useEffect(() => { load(); }, []);

  const unread = logs.filter(l => !l.read).length;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f2d6b', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            Audit Logs
            {unread > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 14, fontWeight: 700 }}>{unread}</span>}
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Track all trainer data modifications and reviewer actions</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {unread > 0 && <button className="btn-secondary" onClick={markRead}>Mark all read</button>}
          <button className="btn-primary" onClick={load}>Refresh</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><label className="form-label">From</label><input className="form-input" type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} /></div>
          <div><label className="form-label">To</label><input className="form-input" type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} /></div>
          <div>
            <label className="form-label">Type</label>
            <select className="form-input" value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value }))}>
              <option value="">All</option>
              <option>School</option>
              <option>Session</option>
            </select>
          </div>
          <button className="btn-primary" style={{ marginBottom: 1 }} onClick={load}>Apply</button>
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading…</div>}

      {!loading && logs.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48 }}>📋</div>
          <p style={{ color: '#64748b', marginTop: 12 }}>No audit events found.</p>
        </div>
      )}

      {!loading && logs.map(log => (
        <div key={log._id} onClick={() => setExpanded(expanded === log._id ? null : log._id)} className="card" style={{
          marginBottom: 10, cursor: 'pointer',
          border: log.read ? '1px solid #e2e8f0' : '2px solid #fbbf24',
          background: log.read ? '#fff' : '#fffbeb',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
              {log.action === 'session_review_submitted' ? '📋' : '✏️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                {ACTION_LABELS[log.action] || log.action}
                {!log.read && <span style={{ marginLeft: 8, fontSize: 11, background: '#fbbf24', color: '#fff', borderRadius: 10, padding: '1px 8px' }}>NEW</span>}
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                <strong>{log.actorName}</strong> ({log.actorRole?.replace('_', ' ')})
                {log.entityName && <> → <em>{log.entityName}</em></>}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
              {fmtDT(log.createdAt)}
            </div>
          </div>

          {/* Expanded: show changes */}
          {expanded === log._id && log.changes && Object.keys(log.changes).length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 8 }}>What changed:</div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#64748b' }}>Field</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#ef4444' }}>Before</th>
                    <th style={{ padding: '6px 12px', textAlign: 'left', color: '#22c55e' }}>After</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(log.changes).map(([field, diff]) => (
                    <tr key={field} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 600 }}>{field}</td>
                      <td style={{ padding: '6px 12px', color: '#ef4444' }}>{String(diff.old || '—')}</td>
                      <td style={{ padding: '6px 12px', color: '#22c55e' }}>{String(diff.new || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
