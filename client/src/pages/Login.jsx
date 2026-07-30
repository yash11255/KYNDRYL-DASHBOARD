import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const AppIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome, ${user.name}`);
      navigate(['super_admin', 'manager', 'team_lead'].includes(user.role) ? '/admin' : '/trainer');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── Left panel ── */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-brand-mark">
            <div className="login-mark-box"><AppIcon /></div>
            <div className="login-mark-text">
              <h1>AI Pathshala</h1>
              <span>Bharat Cares × Kyndryl</span>
            </div>
          </div>

          <h2 className="login-hero-title">
            Field Operations<br />
            <strong>Intelligence Platform</strong>
          </h2>

          <p className="login-hero-sub">
            End-to-end session tracking, geo-verified documentation,
            and live Google Drive + Sheets sync for India's AI education program.
          </p>

          <div className="login-stats">
            <div className="login-stat-item">
              <div className="login-stat-value">5K+</div>
              <div className="login-stat-label">Students Reached</div>
            </div>
            <div className="login-stat-item">
              <div className="login-stat-value">50+</div>
              <div className="login-stat-label">Partner Schools</div>
            </div>
            <div className="login-stat-item">
              <div className="login-stat-value">100%</div>
              <div className="login-stat-label">Geo-Verified</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="login-right">
        <div className="login-form-header">
          <h2>Sign in to your account</h2>
          <p>Use your program credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="name@bharatcares.in"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-xl"
            disabled={loading}
            style={{ letterSpacing: '.03em' }}
          >
            {loading ? (
              <>
                <svg className="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" style={{ width: 16, height: 16 }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Authenticating…
              </>
            ) : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '1px solid var(--border)',
          fontSize: 12,
          color: 'var(--text-helper)',
          lineHeight: 1.7,
        }}>
          <p>Contact your program coordinator for access.</p>
          <p style={{ marginTop: 4 }}>
            <span style={{ color: 'var(--kyndryl-green)', fontWeight: 600 }}>Kyndryl</span>
            {' '}× <span style={{ color: 'var(--bharat-navy)', fontWeight: 600 }}>Bharat Cares</span>
            {' '}· AI Pathshala Program
          </p>
        </div>
      </div>
    </div>
  );
}
