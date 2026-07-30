import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Plain photo capture — no geo-stamp, no GPS overlay.
 * Used for documents, bills, receipts, acknowledgment letters.
 */
export default function SimpleCamera({ label = 'Take Photo', onCapture, multiple = false }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const results = [];
    for (const file of files) {
      const form = new FormData();
      form.append('photo', file);
      try {
        const { data } = await api.post('/upload/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        results.push({ url: data.url, filename: data.filename });
      } catch {
        toast.error('Upload failed — check connection');
      }
    }
    setUploading(false);
    if (multiple) { onCapture(results); }
    else if (results[0]) { onCapture(results[0]); }
    e.target.value = '';
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple={multiple} onChange={handleChange} style={{ display: 'none' }} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', width: '100%',
          background: uploading ? '#f1f5f9' : '#f8fafc',
          border: '1.5px dashed #cbd5e1', borderRadius: 12,
          color: uploading ? '#94a3b8' : '#475569', fontWeight: 600, fontSize: 14, cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'background .15s',
        }}
      >
        <span style={{ fontSize: 20 }}>{uploading ? '⏳' : '📷'}</span>
        <span>{uploading ? 'Uploading…' : label}</span>
      </button>
    </div>
  );
}
