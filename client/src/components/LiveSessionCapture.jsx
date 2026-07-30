/* ═══════════════════════════════════════════════════════════════════
   LiveSessionCapture
   ──────────────────────────────────────────────────────────────────
   • Floating camera button always visible during an active session
   • Tap → camera opens instantly (stream stays alive between shots)
   • GPS runs in parallel — photo is captured immediately, overlay is
     stamped in the background (never blocks the shutter)
   • If offline → photo saved to IndexedDB; badge shows pending count
   • When back online → auto-syncs all pending photos
   ═══════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getCurrentPosition } from '../utils/geo';
import { queuePhoto, getQueuedPhotos, syncQueue, removeQueuedPhoto } from '../utils/offlineQueue';
import useOnlineStatus from '../hooks/useOnlineStatus';

/* ── Tile helpers (same as GeoCamera) ─────────────────────────── */
const TILE = 256;
const lonToTileX = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
const latToTileY = (lat, z) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
};
const loadTile = (tx, ty, z) => new Promise((resolve) => {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img); img.onerror = () => resolve(null);
  const max = Math.pow(2, z);
  const sub = ['a','b','c'][Math.abs(tx + ty) % 3];
  img.src = `https://${sub}.tile.openstreetmap.org/${z}/${((tx%max)+max)%max}/${Math.max(0,Math.min(max-1,ty))}.png`;
});

const buildMapCanvas = async (lat, lon, outW, outH) => {
  const Z = 15;
  const txF = lonToTileX(lon, Z); const tyF = latToTileY(lat, Z);
  const tx = Math.floor(txF);     const ty = Math.floor(tyF);
  const px = (txF - tx) * TILE;   const py = (tyF - ty) * TILE;
  const minTX = tx + Math.floor((px-outW/2)/TILE); const maxTX = tx + Math.floor((px+outW/2)/TILE);
  const minTY = ty + Math.floor((py-outH/2)/TILE); const maxTY = ty + Math.floor((py+outH/2)/TILE);
  const tiles = await Promise.all(
    Array.from({ length: (maxTX-minTX+1)*(maxTY-minTY+1) }, (_, i) => {
      const itx = minTX + (i % (maxTX-minTX+1));
      const ity = minTY + Math.floor(i / (maxTX-minTX+1));
      return loadTile(itx, ity, Z).then(img => ({ img, itx, ity }));
    })
  );
  const stW = (maxTX-minTX+1)*TILE; const stH = (maxTY-minTY+1)*TILE;
  const st = document.createElement('canvas'); st.width = stW; st.height = stH;
  const sCtx = st.getContext('2d');
  tiles.forEach(({ img, itx, ity }) => img && sCtx.drawImage(img, (itx-minTX)*TILE, (ity-minTY)*TILE));
  const ptX = (tx-minTX)*TILE + px; const ptY = (ty-minTY)*TILE + py;
  drawPin(sCtx, ptX, ptY, 15);
  const out = document.createElement('canvas'); out.width = outW; out.height = outH;
  out.getContext('2d').drawImage(st, Math.round(ptX-outW/2), Math.round(ptY-outH/2), outW, outH, 0, 0, outW, outH);
  return out;
};

const drawPin = (ctx, cx, cy, r) => {
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy+r*2.2);
  ctx.bezierCurveTo(cx-r*.5, cy+r*1.2, cx-r, cy+r*.4, cx-r, cy);
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.bezierCurveTo(cx+r, cy+r*.4, cx+r*.5, cy+r*1.2, cx, cy+r*2.2);
  ctx.closePath(); ctx.fillStyle = '#ea4335'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(cx, cy, r*.45, 0, Math.PI*2);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent';
};

const stampOverlay = async (canvas, ctx, pos, geo) => {
  const W = canvas.width; const H = canvas.height;
  const sc = W / 1080;
  const r  = (n) => Math.round(n * sc);
  const oh = r(200); const top = H - oh; const mapW = r(280);
  const textX = mapW + r(18); const textMaxW = W - textX - r(16);

  const grad = ctx.createLinearGradient(0, top, W, top+oh);
  grad.addColorStop(0, 'rgba(8,18,40,.97)'); grad.addColorStop(1, 'rgba(15,28,55,.97)');
  ctx.fillStyle = grad; ctx.fillRect(0, top, W, oh);
  const ag = ctx.createLinearGradient(0,0,W,0);
  ag.addColorStop(0,'#1a73e8'); ag.addColorStop(.5,'#34a853'); ag.addColorStop(1,'#ea4335');
  ctx.fillStyle = ag; ctx.fillRect(0, top, W, r(3));

  if (pos) {
    try {
      const mc = await buildMapCanvas(pos.latitude, pos.longitude, mapW, oh);
      ctx.drawImage(mc, 0, top);
    } catch {}
  }

  ctx.font = `700 ${r(13)}px Arial`; ctx.fillStyle = '#34d399'; ctx.textAlign = 'right';
  ctx.fillText('GPS Map Camera', W-r(14), top+r(22)); ctx.textAlign = 'left';

  drawPin(ctx, textX-r(2), top+r(44)-r(8), r(9));
  ctx.font = `700 ${r(23)}px Arial`; ctx.fillStyle = '#fff';
  let loc = geo?.locationName || (pos ? `${pos.latitude.toFixed(5)}°, ${pos.longitude.toFixed(5)}°` : 'Location unknown');
  while (loc.length > 1 && ctx.measureText(loc).width > textMaxW-r(18)) loc = loc.slice(0,-1);
  if (loc !== (geo?.locationName || '')) loc += '…';
  ctx.fillText(loc, textX+r(18), top+r(44));

  ctx.font = `${r(13.5)}px Arial`; ctx.fillStyle = '#94a3b8';
  let addr = geo?.addressLine || '';
  while (addr.length > 1 && ctx.measureText(addr).width > textMaxW) addr = addr.slice(0,-1);
  ctx.fillText(addr + (addr !== (geo?.addressLine||'') ? '…' : ''), textX, top+r(70));

  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = r(1);
  ctx.beginPath(); ctx.moveTo(textX, top+r(82)); ctx.lineTo(W-r(14), top+r(82)); ctx.stroke();

  ctx.font = `${r(13.5)}px Arial`; ctx.fillStyle = '#cbd5e1';
  if (pos) {
    ctx.fillText(`Lat  ${pos.latitude.toFixed(5)}°`,  textX,       top+r(100));
    ctx.fillText(`Long  ${pos.longitude.toFixed(5)}°`, textX+r(200), top+r(100));
  }

  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const off = -now.getTimezoneOffset();
  ctx.font = `${r(13)}px Arial`; ctx.fillStyle = '#94a3b8';
  ctx.fillText(
    `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${String(now.getFullYear()).slice(2)}  ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}  GMT ${off>=0?'+':'-'}${pad(Math.floor(Math.abs(off)/60))}:${pad(Math.abs(off)%60)}`,
    textX, top+r(122)
  );
  ctx.font = `${r(11)}px Arial`; ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.textAlign = 'right';
  ctx.fillText('© OpenStreetMap contributors', W-r(12), top+oh-r(8));
  ctx.textAlign = 'left';
};

const reverseGeocode = async (lat, lon) => {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`, { headers: { 'User-Agent': 'BharatCares-AIPathshala/1.0' } });
    const d = await r.json(); const a = d.address || {};
    const city = a.city || a.town || a.village || a.county || a.state_district || '';
    return {
      locationName: [city, a.state, a.country].filter(Boolean).join(', '),
      addressLine: d.display_name || '',
    };
  } catch { return { locationName: '', addressLine: '' }; }
};

/* ════════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════════ */
export default function LiveSessionCapture({ sessionId, onPhotoSaved }) {
  const online = useOnlineStatus();
  const [open, setOpen]         = useState(false);
  const [stream, setStream]     = useState(null);
  const [photos, setPhotos]     = useState([]);    // captured this session (local + uploaded)
  const [pending, setPending]   = useState(0);     // offline queue count
  const [flash, setFlash]       = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [gps, setGps]           = useState(null);  // { latitude, longitude }
  const [geo, setGeo]           = useState(null);  // { locationName, addressLine }
  const videoRef  = useRef();
  const canvasRef = useRef();

  /* ── Load offline queue count on mount ── */
  useEffect(() => {
    getQueuedPhotos(sessionId).then(q => setPending(q.filter(p => p.status === 'pending').length));
  }, [sessionId]);

  /* ── When back online: auto-sync pending photos ── */
  useEffect(() => {
    if (!online) return;
    syncQueue(async (item) => {
      const fd = new FormData();
      fd.append('file', item.blob, `queued-${item.tag}-${Date.now()}.jpg`);
      const { data } = await api.post('/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onPhotoSaved?.({ ...data, latitude: item.latitude, longitude: item.longitude, locationName: item.locationName, tag: item.tag, queued: false });
      return data;
    }).then(synced => {
      if (synced.length) {
        toast.success(`${synced.length} queued photo${synced.length > 1 ? 's' : ''} uploaded`);
        setPending(0);
      }
    });
  }, [online]);

  /* ── GPS refresh loop while camera is open ── */
  useEffect(() => {
    if (!open) return;
    let active = true;
    const refresh = async () => {
      try {
        const pos = await getCurrentPosition();
        if (!active) return;
        setGps(pos);
        reverseGeocode(pos.latitude, pos.longitude).then(g => active && setGeo(g));
      } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 30000); // re-check every 30s
    return () => { active = false; clearInterval(interval); };
  }, [open]);

  /* ── Attach stream to video element ── */
  useEffect(() => {
    if (open && videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [open, stream]);

  /* ── Open camera ── */
  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      setOpen(true);
    } catch { toast.error('Camera not available'); }
  };

  const closeCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setOpen(false);
  };

  /* ── Capture ── */
  const capture = useCallback(async () => {
    if (capturing) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);

    // Snapshot immediately — don't wait for GPS
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Stamp overlay (async — fetches map + uses current GPS if available)
    const pos = gps;
    const g   = geo;
    if (pos) await stampOverlay(canvas, ctx, pos, g);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.93));
    const localPreview = URL.createObjectURL(blob);

    const photoMeta = {
      localPreview, latitude: pos?.latitude, longitude: pos?.longitude,
      locationName: g?.locationName, tag: 'session', pending: !online,
    };

    if (online) {
      /* Immediate upload */
      try {
        const fd = new FormData();
        fd.append('file', blob, `session-${Date.now()}.jpg`);
        const { data } = await api.post('/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const photo = { ...data, ...photoMeta, pending: false };
        setPhotos(prev => [...prev, photo]);
        onPhotoSaved?.(photo);
        toast.success('Photo saved!', { duration: 1500 });
      } catch {
        /* Upload failed — queue offline */
        const { queueId } = await queuePhoto({ blob, sessionId, tag: 'session', ...photoMeta });
        setPhotos(prev => [...prev, { ...photoMeta, queueId, pending: true }]);
        setPending(p => p + 1);
        toast('Saved offline — will upload when connected', { icon: '📴', duration: 2000 });
      }
    } else {
      /* Definitely offline — save to IndexedDB */
      const { queueId } = await queuePhoto({ blob, sessionId, tag: 'session', ...photoMeta });
      setPhotos(prev => [...prev, { ...photoMeta, queueId, pending: true }]);
      setPending(p => p + 1);
      toast('Saved offline — will upload when connected', { icon: '📴', duration: 2000 });
    }

    setCapturing(false);
  }, [capturing, gps, geo, online, sessionId, onPhotoSaved]);

  /* ── Keyboard shortcut: Space = capture when camera open ── */
  useEffect(() => {
    const handler = (e) => { if (open && e.code === 'Space') { e.preventDefault(); capture(); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, capture]);

  const totalCount = photos.length + pending;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── Floating Action Button ── */}
      <button
        onClick={openCamera}
        title="Take Session Photo"
        style={{
          position: 'fixed', bottom: 28, right: 24, zIndex: 900,
          width: 68, height: 68, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0f2d6b, #F4622A)',
          border: 'none', cursor: 'pointer', boxShadow: '0 6px 24px rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {/* Camera icon */}
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>

        {/* Photo count badge */}
        {totalCount > 0 && (
          <div style={{
            position: 'absolute', top: -6, right: -6,
            width: 22, height: 22, borderRadius: '50%',
            background: pending > 0 ? '#f59e0b' : '#22c55e',
            color: '#fff', fontWeight: 700, fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
          }}>
            {totalCount}
          </div>
        )}

        {/* Offline indicator dot */}
        {!online && (
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 10, height: 10, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #fff',
          }} />
        )}
      </button>

      {/* ── Full-screen camera overlay ── */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 950,
          background: '#000', display: 'flex', flexDirection: 'column',
        }}>
          {/* Flash effect */}
          {flash && <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: .85, zIndex: 10, pointerEvents: 'none', transition: 'opacity .1s' }} />}

          {/* Video */}
          <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, objectFit: 'cover', width: '100%' }} />

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,.6), transparent)',
          }}>
            <button onClick={closeCamera} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 42, height: 42, color: '#fff', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>

            {/* GPS badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.55)', borderRadius: 20, padding: '6px 14px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: gps ? '#22c55e' : '#f59e0b', flexShrink: 0, boxShadow: gps ? '0 0 6px #22c55e' : 'none' }} />
              <span style={{ color: '#fff', fontSize: 12 }}>
                {gps ? (geo?.locationName || `${gps.latitude.toFixed(4)}, ${gps.longitude.toFixed(4)}`) : 'Getting GPS…'}
              </span>
            </div>

            {/* Offline pill */}
            {!online && (
              <div style={{ background: '#ef4444', borderRadius: 14, padding: '4px 12px', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                📴 OFFLINE — photos saved locally
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,.85), transparent)',
            padding: '20px 24px 36px',
          }}>
            {/* Photo strip */}
            {photos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14, marginBottom: 4 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={p.localPreview || p.url} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(255,255,255,.4)' }} />
                    {p.pending && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#f59e0b', fontSize: 18 }}>⏳</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
              {/* Gallery placeholder */}
              <div style={{ width: 46, height: 46 }} />

              {/* Shutter */}
              <button
                onClick={capture}
                disabled={capturing}
                style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: capturing ? '#475569' : '#fff',
                  border: '5px solid rgba(255,255,255,.35)',
                  cursor: capturing ? 'wait' : 'pointer',
                  boxShadow: '0 0 0 4px rgba(255,255,255,.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background .1s, transform .1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(.92)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {capturing
                  ? <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #94a3b8', borderTopColor: '#fff', animation: 'spin 1s linear infinite' }} />
                  : <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #0f2d6b, #F4622A)' }} />
                }
              </button>

              {/* Count */}
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 15 }}>
                {photos.length}
              </div>
            </div>

            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', fontSize: 12, marginTop: 10 }}>
              Tap shutter · Photos auto-save {online ? 'to cloud' : 'offline'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
