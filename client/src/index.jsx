import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

/* ── Register service worker for offline support ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-center"
      toastOptions={{ duration: 3500, style: { borderRadius: '10px', fontSize: '14px' } }}
    />
    <OfflineBanner />
  </React.StrictMode>
);

/* ── Inline offline banner (no extra file needed) ── */
function OfflineBanner() {
  const [offline, setOffline] = React.useState(!navigator.onLine);
  React.useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#dc2626', color: '#fff',
      padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      fontSize: 13, fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,.3)',
    }}>
      <span>📴</span>
      <span>You're offline — photos save to device and upload automatically when connected</span>
    </div>
  );
}
