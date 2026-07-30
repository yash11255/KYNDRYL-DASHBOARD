import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getCurrentPosition, haversineKm } from '../utils/geo';
import { saveDraft, loadDraft } from '../utils/offlineQueue';
import GeoCamera from '../components/GeoCamera';
import SimpleCamera from '../components/SimpleCamera';
import LiveSessionCapture from '../components/LiveSessionCapture';
import AssessmentForm from '../components/AssessmentForm';
import Checklist from '../components/Checklist';
import useOnlineStatus from '../hooks/useOnlineStatus';

const STEPS = [
  { id: 'checkin',        label: 'Check-In' },
  { id: 'photos',         label: 'Photos' },
  { id: 'students',       label: 'Students' },
  { id: 'assessment',     label: 'Assessment' },
  { id: 'acknowledgment', label: 'Ack. Letter' },
  { id: 'checkout',       label: 'Check-Out' },
  { id: 'travel',         label: 'Travel' },
  { id: 'checklist',      label: 'Checklist' },
  { id: 'submit',         label: 'Submit' },
];

/* SVG icon paths */
const IC = {
  pin:      'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10a2 2 0 100-4 2 2 0 000 4',
  camera:   'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8',
  check:    'M20 6L9 17l-5-5',
  pen:      'M12 20h9 M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  door:     'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z M13 2v7h7',
  rocket:   'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  hotel:    'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  clock:    'M12 22a10 10 0 100-20 10 10 0 000 20z M12 6v6l4 2',
  warn:     'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  info:     'M12 22a10 10 0 100-20 10 10 0 000 20z M12 8v4 M12 16h.01',
  gps:      'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10a2 2 0 100-4 2 2 0 000 4',
  pdf:      'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  drive:    'M22 12A10 10 0 1012 2a10 10 0 0110 10z M8 12l4-7 4 7 M3.27 9h17.46 M12 19v-7',
  offline:  'M1 1l22 22 M16.72 11.06A10.94 10.94 0 0119 12.55 M5 12.55a10.94 10.94 0 015.17-2.39 M10.71 5.05A16 16 0 0122.56 9 M1.42 9a15.91 15.91 0 014.7-2.88 M8.53 16.11a6 6 0 016.95 0 M12 20h.01',
  school:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
};

const Ico = ({ d, size = 16, stroke = 'currentColor', strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth}
    style={{ width: size, height: size, flexShrink: 0, display: 'inline-block' }}>
    <path d={d} />
  </svg>
);

/* ── Flat design tokens ── */
const CARD = { background: 'var(--surface)', border: '1px solid var(--border)', padding: '20px' };
const LBL  = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 };
const BACK = { padding: '12px 20px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' };
const NEXT = { padding: '14px 24px', border: 'none', background: 'var(--bharat-navy)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', flex: 1, fontFamily: 'inherit' };

/* ── Counter ── */
const Counter = ({ label: lbl, value, onChange, accent = 'var(--bharat-navy)' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
    <div style={LBL}>{lbl}</div>
    <div style={{ display: 'flex', alignItems: 'center', border: `2px solid ${accent}`, overflow: 'hidden' }}>
      <button onClick={() => onChange(Math.max(0, value - 1))}
        style={{ width: 50, height: 54, fontSize: 24, fontWeight: 300, color: accent, background: 'var(--c-10)', border: 'none', borderRight: `1px solid ${accent}`, cursor: 'pointer' }}>−</button>
      <div style={{ minWidth: 64, textAlign: 'center', fontSize: 36, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', background: 'var(--surface)' }}>{value}</div>
      <button onClick={() => onChange(value + 1)}
        style={{ width: 50, height: 54, fontSize: 20, color: '#fff', background: accent, border: 'none', borderLeft: `1px solid ${accent}`, cursor: 'pointer' }}>+</button>
    </div>
  </div>
);

/* ── Photo grid ── */
const PhotoGrid = ({ photos, onRemove }) => {
  if (!photos.length) return (
    <div style={{ border: '2px dashed var(--border)', padding: '28px 16px', textAlign: 'center', color: 'var(--text-helper)', background: 'var(--c-10)' }}>
      <Ico d={IC.camera} size={28} stroke="var(--c-30)" />
      <div style={{ fontSize: 12, marginTop: 8 }}>Photos taken via the camera button appear here automatically</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))', gap: 6 }}>
      {photos.map((p, i) => (
        <div key={p.url || i} style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--c-20)' }}>
          <img src={p.url || p.localPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {p.pending && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%' }} /></div>}
          {onRemove && <button onClick={() => onRemove(i)} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, background: 'rgba(22,22,22,.7)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>}
        </div>
      ))}
    </div>
  );
};

/* ── Time at school ── */
const TimeAtSchool = ({ checkIn, checkOut }) => {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!checkIn) return;
    const update = () => {
      const end = checkOut ? new Date(checkOut.time) : new Date();
      const ms  = end - new Date(checkIn.time);
      const h   = Math.floor(ms / 3600000);
      const m   = Math.floor((ms % 3600000) / 60000);
      setElapsed(h ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    if (!checkOut) { const t = setInterval(update, 60000); return () => clearInterval(t); }
  }, [checkIn, checkOut]);
  if (!checkIn || !elapsed) return null;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: checkOut ? '#d1fae5' : '#dbeafe', padding: '5px 12px', fontSize: 13, color: checkOut ? '#065f46' : '#1e40af', fontWeight: 600, borderLeft: `3px solid ${checkOut ? 'var(--kyndryl-green)' : '#2563eb'}` }}>
      <Ico d={IC.clock} size={13} stroke="currentColor" />
      {checkOut ? `At school: ${elapsed}` : `In school for ${elapsed}`}
    </div>
  );
};

/* ── Status chip ── */
const Chip = ({ children, color, bg, borderColor }) => (
  <span style={{ fontSize: 11, background: bg, color, border: `1px solid ${borderColor || color}`, padding: '3px 8px', fontWeight: 700, whiteSpace: 'nowrap', fontFamily: "'IBM Plex Mono',monospace" }}>
    {children}
  </span>
);

const Spinner = () => (
  <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
);

/* ═══════════════════════════════════════════════════════════════════════ */
export default function SessionFlow() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const online   = useOnlineStatus();

  const [session, setSession]     = useState(null);
  const [school,  setSchool]      = useState(null);
  const [step, setStep]           = useState(0);
  const [loading, setLoading]     = useState(true);
  const [saving,  setSaving]      = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [editMode, setEditMode]   = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [atlStatus,      setAtlStatus]      = useState('NA');
  const [feedback,       setFeedback]       = useState('');
  const [teacherWilling, setTeacherWilling] = useState('NO');

  const [checkinPhoto,   setCheckinPhoto]   = useState(null);
  const [checkinPos,     setCheckinPos]     = useState(null);
  const [sessionPhotos,  setSessionPhotos]  = useState([]);
  const [students, setStudents] = useState({ male: 0, female: 0, grades: [] });
  const [ackData,  setAckData]  = useState({ photo: null, signedBy: '', designation: '' });
  const [travel,   setTravel]   = useState({
    baseStayId: null, baseLocation: '', baseLatitude: null, baseLongitude: null,
    kmBaseToSchool: null, kmRoundTrip: null, kmTravelled: '',
    transportMode: 'bike', fuelBills: [], fuelAmount: '', travelNotes: '',
  });
  const [baseStay, setBaseStay] = useState(null);

  const draftTimer = useRef(null);
  const autosave = useCallback((patch) => {
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { saveDraft(id, patch); }, 600);
  }, [id]);

  useEffect(() => {
    autosave({
      step, students,
      ackSignedBy: ackData.signedBy, ackDesignation: ackData.designation,
      travelBaseLocation: travel.baseLocation, travelKm: travel.kmTravelled,
      travelMode: travel.transportMode, travelFuelAmount: travel.fuelAmount, travelNotes: travel.travelNotes,
    });
  }, [step, students, ackData.signedBy, ackData.designation, travel.baseLocation, travel.kmTravelled, travel.transportMode, travel.fuelAmount, travel.travelNotes]);

  useEffect(() => {
    const init = async () => {
      const draft = await loadDraft(id);
      if (draft) {
        if (draft.step !== undefined) setStep(draft.step);
        if (draft.students)           setStudents(draft.students);
        if (draft.ackSignedBy)        setAckData(a => ({ ...a, signedBy: draft.ackSignedBy, designation: draft.ackDesignation || '' }));
        if (draft.travelBaseLocation) setTravel(t => ({ ...t, baseLocation: draft.travelBaseLocation, kmTravelled: draft.travelKm || '', transportMode: draft.travelMode || 'bike', fuelAmount: draft.travelFuelAmount || '', travelNotes: draft.travelNotes || '' }));
      }
      try {
        const { data: s } = await api.get(`/sessions/${id}`);
        setSession(s);
        setSchool(s.school);
        if (s.sessionPhotos?.length) setSessionPhotos(s.sessionPhotos);
        let maxStep = draft?.step || 0;
        if (s.checkIn?.time)            { maxStep = Math.max(maxStep, 1); setCheckinPos({ latitude: s.checkIn.latitude, longitude: s.checkIn.longitude }); }
        if (s.sessionPhotos?.length)    maxStep = Math.max(maxStep, 2);
        if (s.students?.total)          { maxStep = Math.max(maxStep, 3); setStudents({ male: s.students.male || 0, female: s.students.female || 0, grades: s.students.grades || [] }); }
        if (s.assessment?.submitted)    maxStep = Math.max(maxStep, 4);
        if (s.acknowledgment?.uploaded) { maxStep = Math.max(maxStep, 5); setAckData(a => ({ ...a, signedBy: s.acknowledgment.signedBy || a.signedBy, designation: s.acknowledgment.designation || a.designation })); }
        if (s.checkOut?.time)           maxStep = Math.max(maxStep, 6);
        if (s.travel?.baseLocation)     { maxStep = Math.max(maxStep, 7); setTravel(t => ({ ...t, ...s.travel, kmTravelled: s.travel.kmTravelled || t.kmTravelled || '', fuelBills: s.travel.fuelBills || [] })); }
        if (s.checklist)                maxStep = Math.max(maxStep, 8);
        setStep(maxStep);
      } catch { toast.error('Session not found'); }
      setLoading(false);
    };
    init();
  }, [id]);

  useEffect(() => {
    if (step !== 5 || travel.baseLocation) return;
    api.get('/basestay/mine').then(r => {
      const stays = r.data || [];
      const active = stays.find(s => !s.checkOutDate) || stays[0];
      if (active) {
        setBaseStay(active);
        if (active.latitude) {
          setTravel(t => ({ ...t, baseStayId: active._id, baseLocation: active.hotelName, baseLatitude: active.latitude, baseLongitude: active.longitude }));
          toast.success(`Base loaded: ${active.hotelName}`, { duration: 2000 });
        }
      }
    }).catch(() => {});
  }, [step]);

  useEffect(() => {
    if (!travel.baseLatitude || !school?.latitude) return;
    const km = parseFloat(haversineKm(travel.baseLatitude, travel.baseLongitude, school.latitude, school.longitude));
    setTravel(t => ({ ...t, kmBaseToSchool: km, kmRoundTrip: parseFloat((km * 2).toFixed(1)), kmTravelled: t.kmTravelled || parseFloat((km * 2).toFixed(1)) }));
  }, [travel.baseLatitude, travel.baseLongitude, school]);

  const save = async (endpoint, data) => {
    setSaving(true);
    try {
      const { data: updated } = await api.put(`/sessions/${id}/${endpoint}`, data);
      setSession(updated);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed — will retry');
      return false;
    } finally { setSaving(false); }
  };

  const handleFabPhoto = useCallback((photo) => {
    setSessionPhotos(prev => {
      const next = [...prev, photo];
      api.put(`/sessions/${id}/photos`, { photos: [{ url: photo.url, filename: photo.filename, latitude: photo.latitude, longitude: photo.longitude }] }).catch(() => {});
      return next;
    });
  }, [id]);

  const handleCheckin = async () => {
    setGpsLoading(true);
    let pos;
    try { pos = await getCurrentPosition(); setCheckinPos(pos); }
    catch { toast.error('Enable GPS and try again'); setGpsLoading(false); return; }
    finally { setGpsLoading(false); }
    const ok = await save('checkin', { latitude: pos.latitude, longitude: pos.longitude, locationName: `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}`, photoUrl: checkinPhoto?.url, photoFilename: checkinPhoto?.filename });
    if (ok) { toast.success('Checked in!'); setStep(1); }
  };

  const handlePhotos = () => { toast.success('Photos saved'); setStep(2); };

  const handleStudents = async () => {
    const total = (students.male || 0) + (students.female || 0);
    if (!total) { toast.error('Enter at least one student'); return; }
    const ok = await save('students', { male: students.male, female: students.female, grades: students.grades.filter(g => g.grade) });
    if (ok) { toast.success(`${total} students saved`); setStep(3); }
  };

  const handleAssessment = async (responses, templateVersion) => {
    const ok = await save('assessment', { responses, templateVersion });
    if (ok) { toast.success('Assessment saved'); setStep(4); }
  };

  const handleAcknowledgment = async () => {
    if (!ackData.photo) { toast.error('Take a photo of the signed letter'); return; }
    const ok = await save('acknowledgment', { photoUrl: ackData.photo.url, photoFilename: ackData.photo.filename, signedBy: ackData.signedBy, designation: ackData.designation });
    if (ok) { toast.success('Acknowledgment saved — converting to PDF…'); setStep(5); }
  };

  const handleSchoolCheckout = async (skipGps = false) => {
    setCheckoutLoading(true);
    try {
      if (!skipGps) {
        const pos = await getCurrentPosition();
        const { data: updated } = await api.put(`/sessions/${id}/journey/checkout`, { latitude: pos.latitude, longitude: pos.longitude });
        setSession(updated);
        const mins = Math.round((new Date(updated.checkOut.time) - new Date(updated.checkIn.time)) / 60000);
        toast.success(`Checked out — ${mins >= 60 ? `${Math.floor(mins/60)}h ${mins%60}m` : `${mins}m`} at school`);
      } else {
        toast('Checkout skipped — travel details next', { icon: '⏩' });
      }
      setStep(6);
    } catch { toast.error('Could not record checkout'); }
    setCheckoutLoading(false);
  };

  const handleTravel = async () => {
    const km = travel.kmTravelled || travel.kmRoundTrip || travel.kmBaseToSchool;
    const ok = await save('travel', {
      baseStayId: travel.baseStayId, baseLocation: travel.baseLocation, baseLatitude: travel.baseLatitude, baseLongitude: travel.baseLongitude,
      kmBaseToSchool: travel.kmBaseToSchool, kmRoundTrip: travel.kmRoundTrip, kmTravelled: parseFloat(km) || 0,
      transportMode: travel.transportMode, fuelAmount: parseFloat(travel.fuelAmount) || 0, travelNotes: travel.travelNotes,
      fuelBills: travel.fuelBills.map(f => ({ url: f.url, filename: f.filename })),
    });
    if (ok) { toast.success('Travel saved'); setStep(7); }
  };

  const handleChecklist = async (checked) => {
    const ok = await save('checklist', checked);
    if (ok) { toast.success('Checklist saved'); setStep(8); }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await api.put(`/sessions/${id}/meta`, { atlLabStatus: atlStatus, trainerFeedback: feedback, teacherTrainingWillingness: teacherWilling });
      await api.post(`/sessions/${id}/submit`);
      toast.success('Submitted!');
      navigate('/trainer/sessions');
    }
    catch (err) { toast.error(err.response?.data?.message || 'Submit failed'); }
    finally { setSaving(false); }
  };

  const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
      <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="var(--c-30)" strokeWidth="2" style={{ width: 28, height: 28 }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.07em' }}>Resuming session…</div>
    </div>
  );
  if (!session) return <div className="page"><p>Session not found</p></div>;

  const isSubmitted   = session.status === 'submitted';
  const hasCheckin    = !!session.checkIn?.time;
  const hasCheckout   = !!session.checkOut?.time;
  const totalStudents = (students.male || 0) + (students.female || 0);
  const showFlow      = !isSubmitted || editMode;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 120px' }}>

      {/* ─── Sticky header ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 200, background: 'var(--surface)', padding: '12px 0 10px', borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--bharat-navy)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{school?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, fontFamily: "'IBM Plex Mono',monospace" }}>
              {school?.district} · {new Date(session.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!online && <Chip color="var(--red)" bg="#fff1f2" borderColor="var(--red)">Offline</Chip>}
            {sessionPhotos.length > 0 && <Chip color="var(--kyndryl-green)" bg="#d1fae5" borderColor="var(--kyndryl-green)">{sessionPhotos.length} photos</Chip>}
            {isSubmitted && <Chip color="#fff" bg="var(--kyndryl-green)" borderColor="var(--kyndryl-green)">Submitted</Chip>}
          </div>
        </div>
        {hasCheckin && !isSubmitted && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TimeAtSchool checkIn={session.checkIn} checkOut={session.checkOut} />
            {hasCheckout && <Chip color="var(--text-secondary)" bg="var(--c-10)" borderColor="var(--border)">Left {fmtTime(session.checkOut.time)}</Chip>}
          </div>
        )}
      </div>

      {/* ─── Submitted banner ── */}
      {isSubmitted && !editMode && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '4px solid var(--kyndryl-green)', padding: '28px 24px', textAlign: 'center', marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, background: 'var(--kyndryl-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Ico d={IC.check} size={24} stroke="#fff" strokeWidth={2.5} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Session Submitted</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13, marginBottom: 24 }}>
            {new Date(session.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {session.driveFolderUrl && (
              <a href={session.driveFolderUrl} target="_blank" rel="noreferrer"
                style={{ padding: '10px 20px', background: 'var(--bharat-navy)', color: '#fff', fontWeight: 700, textDecoration: 'none', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Ico d={IC.drive} size={14} stroke="#fff" /> Drive Folder
              </a>
            )}
            <button onClick={() => setEditMode(true)}
              style={{ padding: '10px 20px', background: 'var(--surface)', border: '1px solid var(--bharat-navy)', color: 'var(--bharat-navy)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Ico d={IC.pen} size={14} stroke="var(--bharat-navy)" /> Edit / Add Data
            </button>
            <button onClick={() => navigate('/trainer/sessions')}
              style={{ padding: '10px 20px', background: 'var(--c-10)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              ← Sessions
            </button>
          </div>
        </div>
      )}

      {isSubmitted && editMode && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #f1c21b', padding: '11px 16px', fontSize: 13, color: '#92400e', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ico d={IC.pen} size={13} stroke="#92400e" />
            Editing submitted session — changes will update the record
          </div>
          <button onClick={() => setEditMode(false)} style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 700, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ─── Step flow ── */}
      {showFlow && (
        <>
          {/* IBM Carbon step bar */}
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <div style={{ display: 'flex', minWidth: 'max-content', borderBottom: '1px solid var(--border)' }}>
              {STEPS.map((s, i) => {
                const done   = i < step;
                const active = i === step;
                return (
                  <button key={s.id} onClick={() => i <= step && setStep(i)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 14px', border: 'none', background: 'transparent', cursor: i <= step ? 'pointer' : 'default', fontFamily: 'inherit', borderBottom: `2px solid ${active ? 'var(--bharat-navy)' : done ? 'var(--kyndryl-green)' : 'transparent'}`, marginBottom: -1, transition: 'border-color .15s' }}>
                    <div style={{ width: 24, height: 24, background: done ? 'var(--kyndryl-green)' : active ? 'var(--bharat-navy)' : 'var(--c-20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {done
                        ? <Ico d={IC.check} size={13} stroke="#fff" strokeWidth={2.5} />
                        : <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff' : 'var(--text-helper)', fontFamily: "'IBM Plex Mono',monospace" }}>{i + 1}</span>
                      }
                    </div>
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? 'var(--bharat-navy)' : done ? 'var(--kyndryl-green)' : 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 32, height: 32, background: 'var(--bharat-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'IBM Plex Mono',monospace" }}>{step + 1}</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>Step {step + 1}: {STEPS[step].label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-helper)', fontFamily: "'IBM Plex Mono',monospace" }}>Step {step + 1} of {STEPS.length}</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--kyndryl-green)', fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace" }}>Auto-saved ✓</div>
          </div>

          {/* ══ STEP 0: CHECK-IN ══ */}
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {school?.googleMapsLink && (
                <a href={school.googleMapsLink} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--bharat-navy)', textDecoration: 'none', color: 'var(--bharat-navy)' }}>
                  <Ico d={IC.pin} size={20} stroke="var(--bharat-navy)" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Open School in Maps</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{school.address}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 16, color: 'var(--text-helper)' }}>›</span>
                </a>
              )}
              {school?.spokeContactName && (
                <div style={{ background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--kyndryl-green)', padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginBottom: 4 }}>School Contact</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{school.spokeContactName}</div>
                  {school.spokeContactPhone && <div style={{ color: 'var(--kyndryl-green)', fontSize: 14, marginTop: 2 }}>{school.spokeContactPhone}</div>}
                </div>
              )}
              <div style={CARD}>
                <div style={LBL}>Check-In Photo (optional)</div>
                <GeoCamera tag="checkin" label="Take Check-In Photo" onCapture={p => setCheckinPhoto(p)} />
                {checkinPhoto && <img src={checkinPhoto.url} alt="" style={{ width: '100%', marginTop: 10, maxHeight: 180, objectFit: 'cover', display: 'block' }} />}
              </div>
              {checkinPos && (
                <div style={{ background: '#d1fae5', border: '1px solid var(--kyndryl-green)', padding: '8px 14px', fontSize: 12, color: '#065f46', fontWeight: 600, fontFamily: "'IBM Plex Mono',monospace", display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ico d={IC.gps} size={13} stroke="#065f46" /> GPS: {checkinPos.latitude.toFixed(5)}, {checkinPos.longitude.toFixed(5)}
                </div>
              )}
              <button onClick={handleCheckin} disabled={saving || gpsLoading}
                style={{ padding: '16px', border: 'none', background: gpsLoading ? 'var(--c-40)' : 'var(--bharat-navy)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
                {gpsLoading ? <><Spinner />Getting GPS…</> : saving ? 'Saving…' : <><Ico d={IC.pin} size={18} stroke="#fff" /> Check In Now</>}
              </button>
            </div>
          )}

          {/* ══ STEP 1: PHOTOS ══ */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #f1c21b', padding: '11px 14px', fontSize: 13, color: '#92400e', display: 'flex', gap: 8 }}>
                <Ico d={IC.info} size={14} stroke="#92400e" />
                Use the <b>camera button</b> (bottom-right) anytime — photos save automatically and appear here.
              </div>
              {sessionPhotos.length > 0 && (
                <div style={CARD}>
                  <div style={LBL}>{sessionPhotos.length} Photo{sessionPhotos.length !== 1 ? 's' : ''} Taken</div>
                  <PhotoGrid photos={sessionPhotos} onRemove={i => setSessionPhotos(p => p.filter((_, idx) => idx !== i))} />
                </div>
              )}
              <div style={CARD}>
                <div style={LBL}>Add More Photos</div>
                <GeoCamera tag="session" label="Capture Session Photos" multiple={true} onCapture={photos => {
                  const arr = Array.isArray(photos) ? photos : [photos];
                  setSessionPhotos(prev => [...prev, ...arr]);
                  api.put(`/sessions/${id}/photos`, { photos: arr.map(p => ({ url: p.url, filename: p.filename, latitude: p.latitude, longitude: p.longitude })) }).catch(() => {});
                }} />
              </div>
              {sessionPhotos.length === 0 && <PhotoGrid photos={[]} />}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(0)} style={BACK}>← Back</button>
                <button onClick={handlePhotos} style={NEXT}>Continue with {sessionPhotos.length} photo{sessionPhotos.length !== 1 ? 's' : ''} →</button>
              </div>
            </div>
          )}

          {/* ══ STEP 2: STUDENTS ══ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {totalStudents > 0 && (
                <div style={{ background: 'var(--bharat-navy)', borderLeft: '4px solid var(--kyndryl-green)', padding: '22px 20px', textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: 56, fontWeight: 300, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{totalStudents}</div>
                  <div style={{ fontSize: 13, opacity: .7, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.07em' }}>Total Students</div>
                  <div style={{ fontSize: 11, opacity: .5, marginTop: 3, fontFamily: "'IBM Plex Mono',monospace" }}>{students.male}M · {students.female}F</div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
                <div style={{ ...CARD, display: 'flex', justifyContent: 'center' }}><Counter label="Male"   value={students.male}   onChange={v => setStudents(s => ({ ...s, male: v }))}   accent="var(--bharat-navy)" /></div>
                <div style={{ ...CARD, display: 'flex', justifyContent: 'center' }}><Counter label="Female" value={students.female} onChange={v => setStudents(s => ({ ...s, female: v }))} accent="#be185d" /></div>
              </div>
              <div style={CARD}>
                <div style={LBL}>Grade-wise Breakdown (optional)</div>
                {students.grades.map((g, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input className="form-input" placeholder="Class/Grade" value={g.grade}
                      onChange={e => { const gs = [...students.grades]; gs[i] = { ...gs[i], grade: e.target.value }; setStudents(s => ({ ...s, grades: gs })); }} style={{ flex: 2 }} />
                    <input className="form-input" type="number" placeholder="Count" value={g.count}
                      onChange={e => { const gs = [...students.grades]; gs[i] = { ...gs[i], count: e.target.value }; setStudents(s => ({ ...s, grades: gs })); }} style={{ flex: 1 }} />
                    <button onClick={() => setStudents(s => ({ ...s, grades: s.grades.filter((_, idx) => idx !== i) }))}
                      style={{ background: '#fff1f2', border: '1px solid var(--red)', color: 'var(--red)', width: 36, cursor: 'pointer', fontWeight: 700 }}>×</button>
                  </div>
                ))}
                <button onClick={() => setStudents(s => ({ ...s, grades: [...s.grades, { grade: '', count: '' }] }))}
                  style={{ fontSize: 13, color: 'var(--bharat-navy)', background: 'var(--c-10)', border: '1px solid var(--border)', padding: '7px 14px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                  + Add Grade Row
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(1)} style={BACK}>← Back</button>
                <button onClick={handleStudents} disabled={saving || !totalStudents} style={{ ...NEXT, opacity: totalStudents ? 1 : .5 }}>
                  {saving ? 'Saving…' : `Save ${totalStudents} students →`}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 3: ASSESSMENT ══ */}
          {step === 3 && (
            <div>
              <div style={{ background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--bharat-navy)', padding: '11px 14px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, display: 'flex', gap: 8 }}>
                <Ico d={IC.info} size={14} stroke="var(--bharat-navy)" />
                Fill on behalf of a representative student to gauge baseline AI literacy.
              </div>
              <AssessmentForm onSubmit={handleAssessment} loading={saving} />
              <button onClick={() => setStep(2)} style={{ ...BACK, marginTop: 16 }}>← Back</button>
            </div>
          )}

          {/* ══ STEP 4: ACKNOWLEDGMENT ══ */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #f1c21b', padding: '11px 14px', fontSize: 13, color: '#92400e', display: 'flex', gap: 8 }}>
                <Ico d={IC.warn} size={14} stroke="#92400e" />
                Get the principal to sign the letter, then photograph it.
              </div>
              <div style={CARD}>
                <div style={LBL}>Signed Letter Photo *</div>
                <SimpleCamera label="Photograph Signed Letter" onCapture={p => setAckData(a => ({ ...a, photo: p }))} />
                {ackData.photo && <img src={ackData.photo.url} alt="Ack" style={{ width: '100%', marginTop: 10, maxHeight: 180, objectFit: 'cover', display: 'block' }} />}
              </div>
              <div style={{ ...CARD, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div style={LBL}>Signed By</div><input className="form-input" placeholder="Name" value={ackData.signedBy} onChange={e => setAckData(a => ({ ...a, signedBy: e.target.value }))} /></div>
                <div><div style={LBL}>Designation</div><input className="form-input" placeholder="Principal" value={ackData.designation} onChange={e => setAckData(a => ({ ...a, designation: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(3)} style={BACK}>← Back</button>
                <button onClick={handleAcknowledgment} disabled={saving || !ackData.photo} style={{ ...NEXT, opacity: ackData.photo ? 1 : .5 }}>
                  {saving ? 'Saving…' : 'Save & Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 5: CHECK-OUT ══ */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {session.checkIn?.time && (
                <div style={{ background: 'var(--bharat-navy)', borderLeft: '4px solid var(--kyndryl-green)', padding: '22px 20px', textAlign: 'center', color: '#fff' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'rgba(255,255,255,.5)', marginBottom: 6 }}>Arrived at School</div>
                  <div style={{ fontSize: 28, fontWeight: 300, fontVariantNumeric: 'tabular-nums' }}>{fmtTime(session.checkIn.time)}</div>
                  <div style={{ marginTop: 10 }}><TimeAtSchool checkIn={session.checkIn} checkOut={session.checkOut} /></div>
                </div>
              )}
              {session.checkOut?.time ? (
                <div style={{ background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--kyndryl-green)', padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--kyndryl-green)', marginBottom: 4 }}>Already Checked Out</div>
                  <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(session.checkOut.time)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-helper)', marginTop: 4, fontFamily: "'IBM Plex Mono',monospace" }}>GPS: {session.checkOut.latitude?.toFixed(4)}, {session.checkOut.longitude?.toFixed(4)}</div>
                </div>
              ) : (
                <div style={CARD}>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Record when you leave the school. Used to calculate time spent and trip distance.
                  </div>
                  <button onClick={() => handleSchoolCheckout(false)} disabled={checkoutLoading}
                    style={{ padding: '16px', border: 'none', background: checkoutLoading ? 'var(--c-40)' : 'var(--bharat-navy)', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%' }}>
                    {checkoutLoading ? <><Spinner />Getting GPS…</> : <><Ico d={IC.door} size={18} stroke="#fff" /> Check Out of School (with GPS)</>}
                  </button>
                </div>
              )}
              {session.acknowledgment?.pdfUrl && (
                <div style={{ background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--bharat-navy)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Ico d={IC.pdf} size={18} stroke="var(--bharat-navy)" />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>Acknowledgment PDF ready</div>
                    <a href={session.acknowledgment.pdfUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: 12, color: 'var(--bharat-navy)', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid var(--bharat-navy)' }}>View PDF ↗</a>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(4)} style={BACK}>← Back</button>
                <button onClick={() => handleSchoolCheckout(!!session.checkOut?.time)} style={NEXT}>
                  {session.checkOut?.time ? 'Continue to Travel →' : 'Skip & Continue →'}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 6: TRAVEL ══ */}
          {step === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ ...CARD, background: 'var(--c-10)' }}>
                <div style={LBL}>Today's Journey</div>
                <JourneyChain
                  baseLabel={travel.baseLocation || 'Base Hotel'}
                  schoolLabel={school?.name || 'School'}
                  kmOneWay={travel.kmBaseToSchool}
                  kmRoundTrip={travel.kmRoundTrip}
                  checkInTime={session.checkIn?.time}
                  checkOutTime={session.checkOut?.time}
                />
                {!travel.kmBaseToSchool && !travel.baseLatitude && (
                  <div style={{ fontSize: 12, color: '#d97706', marginTop: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Ico d={IC.warn} size={13} stroke="#d97706" />
                    Distance auto-calculates once hotel GPS is loaded
                  </div>
                )}
              </div>

              <div style={CARD}>
                {baseStay ? (
                  <div style={{ background: 'var(--c-10)', border: '1px solid var(--border)', borderLeft: '3px solid var(--kyndryl-green)', padding: '12px 14px', marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-helper)', marginBottom: 4 }}>Base Stay (Auto-Loaded)</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Ico d={IC.hotel} size={14} stroke="var(--bharat-navy)" /> {baseStay.hotelName}
                    </div>
                    {baseStay.district && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{baseStay.district}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-helper)', marginTop: 4, fontFamily: "'IBM Plex Mono',monospace" }}>
                      Check-in: {new Date(baseStay.checkInDate).toLocaleDateString('en-IN')}
                      {!baseStay.latitude && <span style={{ color: '#d97706' }}> · No GPS — add in Base Stay for auto-distance</span>}
                    </div>
                    <button onClick={() => { setBaseStay(null); setTravel(t => ({ ...t, baseLocation: '', baseLatitude: null, baseLongitude: null, baseStayId: null })); }}
                      style={{ marginTop: 6, fontSize: 11, color: 'var(--text-helper)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      Use a different location
                    </button>
                  </div>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    <div style={LBL}>Base Location (hotel name)</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" style={{ flex: 1 }} placeholder="Hotel / Village name" value={travel.baseLocation} onChange={e => setTravel(t => ({ ...t, baseLocation: e.target.value }))} />
                      <button onClick={async () => {
                        setGpsLoading(true);
                        try { const pos = await getCurrentPosition(); setTravel(t => ({ ...t, baseLatitude: pos.latitude, baseLongitude: pos.longitude, baseLocation: t.baseLocation || `${pos.latitude.toFixed(5)}, ${pos.longitude.toFixed(5)}` })); toast.success('GPS captured'); }
                        catch { toast.error('GPS failed'); }
                        setGpsLoading(false);
                      }} disabled={gpsLoading} style={{ background: 'var(--c-10)', border: '1px solid var(--border)', color: 'var(--bharat-navy)', padding: '0 14px', cursor: 'pointer', fontWeight: 700, fontSize: 13, flexShrink: 0, fontFamily: 'inherit' }}>
                        {gpsLoading ? '…' : 'GPS Pin'}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <div style={LBL}>Transport Mode</div>
                    <select className="form-input" value={travel.transportMode} onChange={e => setTravel(t => ({ ...t, transportMode: e.target.value }))}>
                      {[['bike','Bike'],['car','Car'],['bus','Bus'],['train','Train'],['auto','Auto'],['other','Other']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={LBL}>Total km (round trip)</div>
                    {travel.kmBaseToSchool && (
                      <div style={{ background: 'var(--c-10)', border: '1px solid var(--border)', padding: '10px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-helper)', fontFamily: "'IBM Plex Mono',monospace" }}>
                          <div>One way: {travel.kmBaseToSchool} km</div>
                          <div>Round: {travel.kmRoundTrip} km</div>
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--kyndryl-green)', fontVariantNumeric: 'tabular-nums' }}>{travel.kmRoundTrip}</div>
                      </div>
                    )}
                    <input className="form-input" type="number" step="0.1"
                      placeholder={travel.kmRoundTrip ? `Auto: ${travel.kmRoundTrip} km` : 'Enter total km'}
                      value={travel.kmTravelled}
                      onChange={e => setTravel(t => ({ ...t, kmTravelled: e.target.value }))} />
                    {travel.kmRoundTrip && travel.kmTravelled && parseFloat(travel.kmTravelled) !== travel.kmRoundTrip && (
                      <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>Manual override — auto was {travel.kmRoundTrip} km</div>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 14, marginBottom: 14 }}>
                  <div style={LBL}>Fuel Bills Today</div>
                  <input className="form-input" type="number" placeholder="₹ 0 (leave blank if none)" value={travel.fuelAmount} onChange={e => setTravel(t => ({ ...t, fuelAmount: e.target.value }))} style={{ marginBottom: 10 }} />
                  {travel.fuelAmount > 0 && (
                    <>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Attach fuel bill photo + payment proof:</div>
                      <SimpleCamera label="Fuel Bill Photo" multiple={true}
                        onCapture={photos => setTravel(t => ({ ...t, fuelBills: [...t.fuelBills, ...(Array.isArray(photos) ? photos : [photos])] }))} />
                      {travel.fuelBills.length > 0 && <div style={{ marginTop: 10 }}><PhotoGrid photos={travel.fuelBills} /></div>}
                    </>
                  )}
                </div>

                <div>
                  <div style={LBL}>Travel Notes</div>
                  <textarea className="form-input" rows={2} placeholder="Any notes about the journey…" value={travel.travelNotes} onChange={e => setTravel(t => ({ ...t, travelNotes: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(5)} style={BACK}>← Back</button>
                <button onClick={handleTravel} disabled={saving} style={NEXT}>{saving ? 'Saving…' : 'Save & Continue →'}</button>
              </div>
            </div>
          )}

          {/* ══ STEP 7: CHECKLIST ══ */}
          {step === 7 && (
            <div>
              <Checklist onSubmit={handleChecklist} loading={saving} />
              <button onClick={() => setStep(6)} style={{ ...BACK, marginTop: 14 }}>← Back</button>
            </div>
          )}

          {/* ══ STEP 8: SUBMIT ══ */}
          {step === 8 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--bharat-navy)', borderLeft: '4px solid var(--bharat-orange)', padding: '24px', textAlign: 'center', color: '#fff' }}>
                <div style={{ width: 44, height: 44, background: 'var(--bharat-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Ico d={IC.rocket} size={22} stroke="#fff" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Ready to Submit</div>
                <div style={{ fontSize: 12, opacity: .6, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.07em' }}>Review details below before submitting</div>
              </div>

              <div style={CARD}>
                <div style={LBL}>Session Details</div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>ATL Lab Status</div>
                  <div style={{ display: 'flex', gap: 1, background: 'var(--border)' }}>
                    {['YES', 'NO', 'NA'].map(opt => (
                      <button key={opt} onClick={() => setAtlStatus(opt)}
                        style={{ flex: 1, padding: '10px', border: 'none', background: atlStatus === opt ? 'var(--bharat-navy)' : 'var(--surface)', color: atlStatus === opt ? '#fff' : 'var(--text-secondary)', fontWeight: atlStatus === opt ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Trainer Feedback</div>
                  <textarea className="form-input" rows={3} placeholder="How was the session? Student engagement, observations…" value={feedback} onChange={e => setFeedback(e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>Teacher Training Willingness</div>
                  <div style={{ display: 'flex', gap: 1, background: 'var(--border)' }}>
                    {['YES', 'NO', 'MAYBE'].map(opt => (
                      <button key={opt} onClick={() => setTeacherWilling(opt)}
                        style={{ flex: 1, padding: '10px', border: 'none', background: teacherWilling === opt ? 'var(--bharat-navy)' : 'var(--surface)', color: teacherWilling === opt ? '#fff' : 'var(--text-secondary)', fontWeight: teacherWilling === opt ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={CARD}>
                <div style={LBL}>Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
                  {[
                    ['School',   school?.name],
                    ['Students', `${session.students?.total || 0} (${session.students?.male || 0}M + ${session.students?.female || 0}F)`],
                    ['Photos',   sessionPhotos.length],
                    ['Check-in', fmtTime(session.checkIn?.time) || '—'],
                    ['Check-out',fmtTime(session.checkOut?.time) || '—'],
                    ['Distance', travel.kmRoundTrip ? `${travel.kmRoundTrip} km` : `${session.travel?.kmTravelled || 0} km`],
                    ['Fuel',     `₹${session.travel?.fuelAmount || 0}`],
                    ['Base',     travel.baseLocation || session.travel?.baseLocation || '—'],
                    ['ATL Lab',  atlStatus],
                    ['Teacher Training', teacherWilling],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: 'var(--surface)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
                    </div>
                  ))}
                </div>
                {feedback && (
                  <div style={{ marginTop: 1, background: 'var(--c-10)', padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Feedback</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{feedback}</div>
                  </div>
                )}
              </div>

              {!online && (
                <div style={{ background: '#fff1f2', border: '1px solid var(--red)', borderLeft: '3px solid var(--red)', padding: '11px 14px', fontSize: 13, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Ico d={IC.offline} size={14} stroke="var(--red)" />
                  Offline — data will sync when connected
                </div>
              )}
              <button onClick={handleSubmit} disabled={saving}
                style={{ padding: '18px', border: 'none', background: saving ? 'var(--c-40)' : 'var(--bharat-orange)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {saving ? 'Submitting…' : <><Ico d={IC.rocket} size={18} stroke="#fff" /> Submit Session Report</>}
              </button>
              <button onClick={() => setStep(7)} style={BACK}>← Back</button>
            </div>
          )}

          <LiveSessionCapture sessionId={id} onPhotoSaved={handleFabPhoto} />
        </>
      )}
    </div>
  );
}

/* ── Journey chain ── */
function JourneyChain({ baseLabel, schoolLabel, kmOneWay, kmRoundTrip, checkInTime, checkOutTime }) {
  const fmtT = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;
  const timeAtSchool = () => {
    if (!checkInTime) return null;
    const end = checkOutTime ? new Date(checkOutTime) : new Date();
    const ms  = end - new Date(checkInTime);
    const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
    return h ? `${h}h ${m}m` : `${m}m`;
  };

  const IC_HOTEL  = 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10';
  const IC_SCHOOL = 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z';

  const Node = ({ icon, label: lbl, sub, active }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1, maxWidth: 110 }}>
      <div style={{ width: 40, height: 40, background: active ? 'var(--bharat-navy)' : 'var(--c-20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : 'var(--text-helper)'} strokeWidth="1.75" style={{ width: 18, height: 18 }}><path d={icon} /></svg>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.2 }}>{lbl}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-helper)', textAlign: 'center', fontFamily: "'IBM Plex Mono',monospace" }}>{sub}</div>}
    </div>
  );

  const Arrow = ({ label: lbl }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, paddingTop: 14 }}>
      {lbl && <div style={{ fontSize: 10, color: 'var(--kyndryl-green)', fontWeight: 700, marginBottom: 4, fontFamily: "'IBM Plex Mono',monospace" }}>{lbl}</div>}
      <div style={{ height: 2, width: '100%', background: 'var(--border)', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -4, top: -4, width: 10, height: 10, borderTop: '2px solid var(--c-40)', borderRight: '2px solid var(--c-40)', transform: 'rotate(45deg)' }} />
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <Node icon={IC_HOTEL}  label={baseLabel}   sub="Base"   active />
        <Arrow label={kmOneWay ? `${kmOneWay} km` : '—'} />
        <Node icon={IC_SCHOOL} label={schoolLabel} sub={fmtT(checkInTime) ? `In: ${fmtT(checkInTime)}${fmtT(checkOutTime) ? ` · Out: ${fmtT(checkOutTime)}` : ''}` : null} active={!!checkInTime} />
        <Arrow label={kmOneWay ? `${kmOneWay} km` : '—'} />
        <Node icon={IC_HOTEL}  label={baseLabel}   sub="Return" />
      </div>
      {(kmRoundTrip || timeAtSchool()) && (
        <div style={{ display: 'flex', gap: 1, marginTop: 14, background: 'var(--border)' }}>
          {kmRoundTrip && (
            <div style={{ textAlign: 'center', flex: 1, background: 'var(--surface)', padding: '10px' }}>
              <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--bharat-navy)', fontVariantNumeric: 'tabular-nums' }}>{kmRoundTrip}</div>
              <div style={{ fontSize: 10, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total km</div>
            </div>
          )}
          {timeAtSchool() && (
            <div style={{ textAlign: 'center', flex: 1, background: 'var(--surface)', padding: '10px' }}>
              <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--kyndryl-green)', fontVariantNumeric: 'tabular-nums' }}>{timeAtSchool()}</div>
              <div style={{ fontSize: 10, color: 'var(--text-helper)', textTransform: 'uppercase', letterSpacing: '.05em' }}>At School</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
