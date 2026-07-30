import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getCurrentPosition } from '../utils/geo';

/* ── OSM Tile helpers ──────────────────────────────────────────────── */
const TILE_SIZE = 256;

const lonToTileX = (lon, z) => (lon + 180) / 360 * Math.pow(2, z);
const latToTileY = (lat, z) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z);
};

const loadTile = (tx, ty, z) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);          // graceful fail
  const maxT = Math.pow(2, z);
  const wtx = ((tx % maxT) + maxT) % maxT;
  const wty = Math.max(0, Math.min(maxT - 1, ty));
  // use subdomains a/b/c to spread load (OSM usage policy)
  const sub = ['a', 'b', 'c'][Math.abs(tx + ty) % 3];
  img.src = `https://${sub}.tile.openstreetmap.org/${z}/${wtx}/${wty}.png`;
});

/* Build a mini-map canvas (outW × outH) centred on lat/lon */
const buildMapCanvas = async (lat, lon, outW, outH) => {
  const Z = 15;
  const txF = lonToTileX(lon, Z);
  const tyF = latToTileY(lat, Z);
  const tx = Math.floor(txF);
  const ty = Math.floor(tyF);
  const px = (txF - tx) * TILE_SIZE;        // pixel within centre tile
  const py = (tyF - ty) * TILE_SIZE;

  // Which tiles are needed to cover outW × outH around that pixel?
  const minTX = tx + Math.floor((px - outW / 2) / TILE_SIZE);
  const maxTX = tx + Math.floor((px + outW / 2) / TILE_SIZE);
  const minTY = ty + Math.floor((py - outH / 2) / TILE_SIZE);
  const maxTY = ty + Math.floor((py + outH / 2) / TILE_SIZE);

  // Fetch all tiles in parallel
  const jobs = [];
  for (let ity = minTY; ity <= maxTY; ity++)
    for (let itx = minTX; itx <= maxTX; itx++)
      jobs.push(loadTile(itx, ity, Z).then(img => ({ img, itx, ity })));
  const tiles = await Promise.all(jobs);

  // Stitch tiles onto offscreen canvas
  const stW = (maxTX - minTX + 1) * TILE_SIZE;
  const stH = (maxTY - minTY + 1) * TILE_SIZE;
  const st = document.createElement('canvas');
  st.width = stW; st.height = stH;
  const sCtx = st.getContext('2d');
  for (const { img, itx, ity } of tiles)
    if (img) sCtx.drawImage(img, (itx - minTX) * TILE_SIZE, (ity - minTY) * TILE_SIZE);

  // Point in the stitched canvas
  const ptX = (tx - minTX) * TILE_SIZE + px;
  const ptY = (ty - minTY) * TILE_SIZE + py;

  // Draw red location pin
  drawLocationPin(sCtx, ptX, ptY, 15);

  // Crop outW × outH centred on the point
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  out.getContext('2d').drawImage(st, Math.round(ptX - outW / 2), Math.round(ptY - outH / 2), outW, outH, 0, 0, outW, outH);
  return out;
};

/* Draw a Google-style red map pin */
const drawLocationPin = (ctx, cx, cy, r) => {
  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;

  // Pin body (teardrop)
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 2.2);
  ctx.bezierCurveTo(cx - r * 0.5, cy + r * 1.2, cx - r, cy + r * 0.4, cx - r, cy);
  ctx.arc(cx, cy, r, Math.PI, 0);
  ctx.bezierCurveTo(cx + r, cy + r * 0.4, cx + r * 0.5, cy + r * 1.2, cx, cy + r * 2.2);
  ctx.closePath();
  ctx.fillStyle = '#ea4335';
  ctx.fill();

  // Inner white dot
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
};

/* ── Reverse geocode ───────────────────────────────────────────────── */
const reverseGeocode = async (lat, lon) => {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`,
      { headers: { 'User-Agent': 'BharatCares-AIPathshala/1.0' } }
    );
    const d = await r.json();
    const a = d.address || {};
    const city  = a.city || a.town || a.village || a.county || a.state_district || '';
    const state = a.state || '';
    const country = a.country || '';
    const road  = [a.road, a.suburb, a.neighbourhood].filter(Boolean).join(', ');
    return {
      locationName: [city, state, country].filter(Boolean).join(', '),
      addressLine: d.display_name || [road, city, state, country].filter(Boolean).join(', '),
    };
  } catch { return { locationName: '', addressLine: '' }; }
};

/* ── Canvas text helper ────────────────────────────────────────────── */
const fillTruncated = (ctx, text, x, y, maxW) => {
  if (!text) return;
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1);
  if (t !== text) t = t.slice(0, -1) + '…';
  ctx.fillText(t, x, y);
};

/* ── Main stamp function (async — fetches map tile) ───────────────── */
const stampOverlay = async (canvas, ctx, position, geo) => {
  const W = canvas.width;
  const H = canvas.height;
  const sc = W / 1080;                              // scale factor
  const r = (n) => Math.round(n * sc);

  const overlayH = r(200);
  const top      = H - overlayH;
  const mapW     = r(280);
  const mapH     = overlayH;
  const textX    = mapW + r(18);
  const textMaxW = W - textX - r(16);

  /* ── Dark background ── */
  const grad = ctx.createLinearGradient(0, top, W, top + overlayH);
  grad.addColorStop(0, 'rgba(8, 18, 40, 0.97)');
  grad.addColorStop(1, 'rgba(15, 28, 55, 0.97)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, W, overlayH);

  /* ── Thin top accent line ── */
  const accentGrad = ctx.createLinearGradient(0, 0, W, 0);
  accentGrad.addColorStop(0, '#1a73e8');
  accentGrad.addColorStop(0.5, '#34a853');
  accentGrad.addColorStop(1, '#ea4335');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, top, W, r(3));

  /* ── Map thumbnail ── */
  let mapDrawn = false;
  if (position) {
    try {
      const mapCanvas = await buildMapCanvas(position.latitude, position.longitude, mapW, mapH);
      ctx.drawImage(mapCanvas, 0, top);
      // White border on right edge of map
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = r(1.5);
      ctx.beginPath();
      ctx.moveTo(mapW, top);
      ctx.lineTo(mapW, top + mapH);
      ctx.stroke();
      mapDrawn = true;
    } catch { /* skip map on error */ }
  }

  /* Fallback: grey placeholder if map failed */
  if (!mapDrawn) {
    ctx.fillStyle = '#1a2744';
    ctx.fillRect(0, top, mapW, mapH);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = `${r(13)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('Map unavailable', mapW / 2, top + mapH / 2);
    ctx.textAlign = 'left';
  }

  /* ── "GPS Map Camera" branding — top right ── */
  ctx.font = `700 ${r(13)}px Arial, sans-serif`;
  ctx.fillStyle = '#34d399';   // green
  ctx.textAlign = 'right';
  ctx.fillText('GPS Map Camera', W - r(14), top + r(22));
  ctx.textAlign = 'left';

  /* ── Location pin icon next to text ── */
  const pinX = textX - r(2);
  const pinCY = top + r(44);
  drawLocationPin(ctx, pinX, pinCY - r(8), r(9));

  /* ── Location name ── */
  const nameFz = r(23);
  ctx.font = `700 ${nameFz}px Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  const locName = geo?.locationName || (position ? `${position.latitude.toFixed(5)}°, ${position.longitude.toFixed(5)}°` : 'Unknown Location');
  fillTruncated(ctx, locName, textX + r(18), top + r(44), textMaxW - r(18));

  /* ── Address ── */
  ctx.font = `${r(13.5)}px Arial, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  fillTruncated(ctx, geo?.addressLine || '', textX, top + r(70), textMaxW);

  /* ── Separator line ── */
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = r(1);
  ctx.beginPath();
  ctx.moveTo(textX, top + r(82));
  ctx.lineTo(W - r(14), top + r(82));
  ctx.stroke();

  /* ── Coordinates ── */
  const coordFz = r(13.5);
  ctx.font = `${coordFz}px Arial, sans-serif`;
  ctx.fillStyle = '#cbd5e1';
  if (position) {
    ctx.fillText(`Lat  ${position.latitude.toFixed(5)}°`, textX, top + r(100));
    ctx.fillText(`Long  ${position.longitude.toFixed(5)}°`, textX + r(200), top + r(100));
  }

  /* ── Date / time / timezone ── */
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${String(now.getFullYear()).slice(2)}`;
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const off = -now.getTimezoneOffset();
  const tz  = `GMT ${off >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  ctx.font = `${r(13)}px Arial, sans-serif`;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${dateStr}  ${timeStr}  ${tz}`, textX, top + r(122));

  /* ── OSM attribution (required by OSM licence) ── */
  ctx.font = `${r(11)}px Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.textAlign = 'right';
  ctx.fillText('© OpenStreetMap contributors', W - r(12), top + overlayH - r(8));
  ctx.textAlign = 'left';
};

/* ══════════════════════════════════════════════════════════════════ */
/*  GeoCamera Component                                               */
/* ══════════════════════════════════════════════════════════════════ */
export default function GeoCamera({ onCapture, tag = 'photo', label = 'Take Photo', multiple = false }) {
  const [mode, setMode]         = useState('idle');   // idle | camera | uploading
  const [stream, setStream]     = useState(null);
  const [position, setPosition] = useState(null);
  const [geo, setGeo]           = useState(null);
  const [gpsStatus, setGpsStatus] = useState('waiting');
  const [previews, setPreviews] = useState([]);
  const [flash, setFlash]       = useState(false);
  const videoRef = useRef();
  const canvasRef = useRef();
  const fileRef   = useRef();

  /* Fetch GPS + reverse geocode */
  const fetchGps = async () => {
    setGpsStatus('waiting');
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      setGpsStatus('ok');
      reverseGeocode(pos.latitude, pos.longitude).then(setGeo);
    } catch { setGpsStatus('error'); }
  };

  const openCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(s);
      setMode('camera');
      fetchGps();
    } catch {
      toast('Camera blocked — using file upload', { icon: '📁' });
      fileRef.current.click();
    }
  };

  useEffect(() => {
    if (mode === 'camera' && videoRef.current && stream)
      videoRef.current.srcObject = stream;
  }, [mode, stream]);

  const stopCamera = () => {
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setMode('idle');
  };

  /* ── Capture from live camera ── */
  const capturePhoto = async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    /* Refresh GPS at shutter moment */
    let pos     = position;
    let geoData = geo;
    if (!pos || gpsStatus !== 'ok') {
      try {
        pos     = await getCurrentPosition();
        setPosition(pos);
        setGpsStatus('ok');
        geoData = await reverseGeocode(pos.latitude, pos.longitude);
        setGeo(geoData);
      } catch {}
    }

    /* Draw video frame */
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    setMode('uploading');

    /* Stamp overlay (async — fetches map) */
    if (pos) await stampOverlay(canvas, ctx, pos, geoData);

    await uploadCanvas(canvas, pos, geoData);
  };

  /* ── Upload canvas content ── */
  const uploadCanvas = (canvas, pos, geoData) =>
    new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        const localPreview = URL.createObjectURL(blob);
        try {
          const fd = new FormData();
          fd.append('file', blob, `geo-${tag}-${Date.now()}.jpg`);
          const { data } = await api.post('/upload/photo', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const photo = {
            filename: data.filename, url: data.url,
            latitude: pos?.latitude, longitude: pos?.longitude,
            locationName: geoData?.locationName,
            tag, capturedAt: new Date().toISOString(), localPreview,
          };
          setPreviews(prev => multiple ? [...prev, photo] : [photo]);
          onCapture(multiple ? [photo] : photo, pos);
          toast.success('Photo captured!');
          setMode(multiple ? 'camera' : 'idle');
          if (!multiple) stopCamera();
        } catch {
          toast.error('Upload failed. Retry.');
          setMode('camera');
        }
        resolve();
      }, 'image/jpeg', 0.93);
    });

  /* ── File / gallery fallback ── */
  const handleFileInput = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setMode('uploading');

    let pos     = position;
    let geoData = geo;
    try {
      pos     = await getCurrentPosition();
      setPosition(pos);
      geoData = await reverseGeocode(pos.latitude, pos.longitude);
      setGeo(geoData);
    } catch {}

    const canvas = canvasRef.current;
    const results = [];

    for (const file of files) {
      try {
        const img = await createImageBitmap(file);
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        if (pos) await stampOverlay(canvas, ctx, pos, geoData);

        const stamped = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.93));
        const fd = new FormData();
        fd.append('file', stamped, `geo-${tag}-${Date.now()}.jpg`);
        const { data } = await api.post('/upload/photo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        results.push({
          filename: data.filename, url: data.url,
          latitude: pos?.latitude, longitude: pos?.longitude,
          locationName: geoData?.locationName,
          tag, capturedAt: new Date().toISOString(),
          localPreview: URL.createObjectURL(stamped),
        });
      } catch { toast.error(`Failed: ${file.name}`); }
    }

    if (results.length) {
      setPreviews(prev => multiple ? [...prev, ...results] : results);
      onCapture(multiple ? results : results[0], pos);
      toast.success(`${results.length} photo${results.length > 1 ? 's' : ''} saved!`);
    }
    setMode('idle');
    fileRef.current.value = '';
  };

  const removePhoto = (idx) => setPreviews(prev => prev.filter((_, i) => i !== idx));

  const GPS_DOT   = { waiting: '#f59e0b', ok: '#22c55e', error: '#ef4444' };
  const GPS_LABEL = {
    waiting: 'Getting GPS…',
    ok: geo?.locationName || (position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'GPS ready'),
    error: 'GPS unavailable',
  };

  return (
    <div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <input ref={fileRef} type="file" accept="image/*" multiple={multiple}
        style={{ display: 'none' }} onChange={handleFileInput} />

      {/* ── IDLE ── */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={openCamera} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            padding: '28px 16px', border: '2px dashed #cbd5e1', borderRadius: 12,
            background: '#f8fafc', cursor: 'pointer', transition: 'all .2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0f2d6b'; e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
          >
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#0f2d6b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, color: '#0f2d6b', fontSize: 15 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Map + GPS stamped on photo</div>
            </div>
          </button>

          <button type="button" onClick={() => fileRef.current.click()} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: '20px 14px', border: '2px dashed #cbd5e1', borderRadius: 12,
            background: '#f8fafc', cursor: 'pointer', color: '#64748b', fontSize: 12, minWidth: 72,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Gallery
          </button>
        </div>
      )}

      {/* ── LIVE CAMERA ── */}
      {(mode === 'camera' || mode === 'uploading') && (
        <div style={{ position: 'relative', background: '#000', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
          {flash && <div style={{ position: 'absolute', inset: 0, background: 'white', zIndex: 30, opacity: 0.85, pointerEvents: 'none', transition: 'opacity .15s' }} />}

          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxHeight: 460, objectFit: 'cover', display: 'block' }} />

          {/* GPS badge */}
          <div style={{
            position: 'absolute', top: 10, left: 10, right: '40%',
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(0,0,0,0.65)', borderRadius: 20, padding: '6px 12px',
          }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: GPS_DOT[gpsStatus], flexShrink: 0, boxShadow: `0 0 6px ${GPS_DOT[gpsStatus]}` }} />
            <span style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{GPS_LABEL[gpsStatus]}</span>
          </div>

          {/* Branding */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(52,211,153,0.9)', borderRadius: 6, padding: '3px 9px' }}>
            <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>GPS Map Camera</span>
          </div>

          {/* Preview of overlay at bottom of viewfinder */}
          <div style={{
            position: 'absolute', bottom: 80, left: 0, right: 0, height: 52,
            background: 'rgba(8,18,40,0.88)',
            display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10,
          }}>
            <div style={{ width: 44, height: 44, background: '#1a2744', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b8bf4" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {geo?.locationName || (position ? `${position.latitude.toFixed(5)}°, ${position.longitude.toFixed(5)}°` : 'Locating…')}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {geo?.addressLine || 'Fetching address…'}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.85)', padding: '12px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28,
          }}>
            <button type="button" onClick={stopCamera} style={{
              background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.35)',
              borderRadius: '50%', width: 46, height: 46, color: '#fff', fontSize: 20,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>✕</button>

            <button type="button" onClick={capturePhoto} disabled={mode === 'uploading'} style={{
              width: 76, height: 76, borderRadius: '50%',
              background: mode === 'uploading' ? '#475569' : '#fff',
              border: '5px solid rgba(255,255,255,0.4)',
              cursor: mode === 'uploading' ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 0 4px rgba(255,255,255,0.18)',
            }}>
              {mode === 'uploading'
                ? <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                : <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg, #0f2d6b, #F4622A)' }} />
              }
            </button>

            {multiple && previews.length > 0
              ? <button type="button" onClick={stopCamera} style={{
                  background: '#22c55e', border: 'none', borderRadius: 22,
                  padding: '10px 18px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>Done ({previews.length})</button>
              : <div style={{ width: 46 }} />
            }
          </div>
        </div>
      )}

      {/* ── PREVIEWS ── */}
      {previews.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
            {previews.length} photo{previews.length > 1 ? 's' : ''} captured
            {multiple && mode === 'idle' && (
              <button type="button" onClick={openCamera} style={{ color: '#0f2d6b', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>
                + Add more
              </button>
            )}
          </div>
          <div className="photo-grid">
            {previews.map((p, i) => (
              <div key={i} className="photo-thumb" style={{ borderRadius: 10, overflow: 'hidden' }}>
                <img src={p.localPreview || p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {p.locationName && <div className="geo-tag" style={{ fontSize: 9 }}>📍 {p.locationName}</div>}
                <button className="remove-btn" type="button" onClick={() => removePhoto(i)}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
