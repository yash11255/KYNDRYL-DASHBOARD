import { useState } from 'react';

const CHECKLIST = [
  { key: 'venueConfirmed', label: 'Venue confirmed with school coordinator' },
  { key: 'equipmentTested', label: 'Laptop/projector/screen tested and working' },
  { key: 'materialsReady', label: 'All session materials & handouts ready' },
  { key: 'introductionDone', label: 'Introduction round completed with students' },
  { key: 'baselineAssessmentDone', label: 'Baseline assessment distributed & collected' },
  { key: 'mainContentDelivered', label: 'Main AI Pathshala content delivered' },
  { key: 'activityConducted', label: 'Interactive activity / demo conducted' },
  { key: 'qnaDone', label: 'Q&A session completed' },
  { key: 'feedbackCollected', label: 'Student feedback collected' },
  { key: 'acknowledgmentSigned', label: 'Acknowledgment letter signed by principal/teacher' },
  { key: 'photosUploaded', label: 'Session photos uploaded' },
  { key: 'reportFilled', label: 'All session details filled in the portal' },
];

export default function Checklist({ onSubmit, loading }) {
  const [checked, setChecked] = useState({});

  const toggle = (key) => setChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const doneCount = Object.values(checked).filter(Boolean).length;
  const pct = Math.round((doneCount / CHECKLIST.length) * 100);

  const handleSubmit = () => onSubmit(checked);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="section-title">Session Checklist</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: pct === 100 ? 'var(--green)' : 'var(--navy)' }}>{pct}% done</span>
      </div>
      <div className="progress-bar" style={{ marginBottom: 20 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="card" style={{ padding: 0 }}>
        {CHECKLIST.map(item => (
          <div key={item.key} className="checklist-item" style={{ padding: '12px 16px' }}>
            <input type="checkbox" id={item.key} checked={!!checked[item.key]} onChange={() => toggle(item.key)} />
            <label htmlFor={item.key} style={{ textDecoration: checked[item.key] ? 'line-through' : 'none', color: checked[item.key] ? 'var(--gray-400)' : 'var(--gray-800)' }}>
              {item.label}
            </label>
          </div>
        ))}
      </div>

      <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 20 }} onClick={handleSubmit} disabled={loading}>
        {loading ? 'Saving...' : 'Save Checklist'}
      </button>
    </div>
  );
}
