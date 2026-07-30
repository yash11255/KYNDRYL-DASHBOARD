import { useState, useEffect } from 'react';
import api from '../services/api';

export default function AssessmentForm({ onSubmit, loading }) {
  const [template, setTemplate]       = useState(null);
  const [fetching, setFetching]       = useState(true);
  const [answers, setAnswers]         = useState({});   // keyed by question order

  useEffect(() => {
    api.get('/assessment-template')
      .then(r => setTemplate(r.data))
      .catch(() => setTemplate(null))
      .finally(() => setFetching(false));
  }, []);

  const setAnswer = (order, val) => setAnswers(prev => ({ ...prev, [order]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!template) return;

    const responses = template.questions.map(q => {
      const ans = answers[q.order];
      if (q.type === 'mcq') {
        const selectedOption = typeof ans === 'number' ? ans : null;
        const selectedLabel  = selectedOption !== null ? (q.options[selectedOption] || '') : '';
        return {
          question:      q.question,
          type:          'mcq',
          answer:        selectedLabel,
          selectedOption,
          selectedLabel,
          options:       q.options,
        };
      }
      return {
        question: q.question,
        type:     'text',
        answer:   ans || '',
      };
    });

    onSubmit(responses, template.version);
  };

  /* ── Pill selector for MCQ ── */
  const PillOption = ({ label, selected, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 16px',
        borderRadius: 20,
        border: selected ? '2px solid #0f2d6b' : '1.5px solid #e2e8f0',
        background: selected ? '#0f2d6b' : '#f8fafc',
        color: selected ? '#fff' : '#475569',
        fontWeight: selected ? 700 : 500,
        fontSize: 13,
        cursor: 'pointer',
        transition: 'all .15s',
      }}
    >
      {selected ? '◉' : '○'} {label}
    </button>
  );

  if (fetching) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '4px solid #e2e8f0', borderTopColor: '#0f2d6b', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
      Loading assessment template…
    </div>
  );

  if (!template) return (
    <div style={{ background: '#fff7ed', borderRadius: 12, border: '1.5px solid #fed7aa', padding: '20px', textAlign: 'center', color: '#9a3412' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Assessment template not set up yet</div>
      <div style={{ fontSize: 13 }}>Contact admin to configure the assessment questions.</div>
    </div>
  );

  const allRequired = template.questions.filter(q => q.isRequired);
  const allAnswered = allRequired.every(q => {
    const ans = answers[q.order];
    if (q.type === 'mcq') return typeof ans === 'number';
    return ans && ans.trim() !== '';
  });

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ background: '#eff6ff', borderRadius: 12, border: '1.5px solid #bfdbfe', padding: '11px 14px', fontSize: 13, color: '#1e40af', marginBottom: 20 }}>
        Assessment v{template.version} · {template.questions.length} question{template.questions.length !== 1 ? 's' : ''}
        {allRequired.length > 0 && <span style={{ marginLeft: 8, color: '#dc2626' }}>· {allRequired.length} required</span>}
      </div>

      {[...template.questions].sort((a, b) => a.order - b.order).map((q, idx) => (
        <div key={q.order} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #e2e8f0', padding: '16px 18px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, lineHeight: 1.4 }}>
            Q{idx + 1}. {q.question}
            {q.isRequired && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
          </div>

          {q.type === 'text' && (
            <textarea
              style={{ width: '100%', borderRadius: 10, border: '1.5px solid #e2e8f0', padding: '10px 12px', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', minHeight: 72 }}
              rows={3}
              placeholder="Type answer here…"
              value={answers[q.order] || ''}
              onChange={e => setAnswer(q.order, e.target.value)}
            />
          )}

          {q.type === 'mcq' && q.options && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {q.options.map((opt, optIdx) => (
                <PillOption
                  key={optIdx}
                  label={opt}
                  selected={answers[q.order] === optIdx}
                  onClick={() => setAnswer(q.order, optIdx)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      <button
        type="submit"
        disabled={loading || !allAnswered}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: 14,
          border: 'none',
          background: (loading || !allAnswered) ? '#94a3b8' : 'linear-gradient(135deg, #0f2d6b, #1a4080)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 16,
          cursor: (loading || !allAnswered) ? 'not-allowed' : 'pointer',
          boxShadow: (loading || !allAnswered) ? 'none' : '0 4px 16px rgba(15,45,107,.3)',
        }}
      >
        {loading ? 'Saving…' : 'Submit Assessment'}
      </button>
      {!allAnswered && allRequired.length > 0 && (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          Please answer all required questions to submit
        </div>
      )}
    </form>
  );
}
