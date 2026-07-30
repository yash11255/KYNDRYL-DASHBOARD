import { useAuth } from '../context/AuthContext';

export default function Navbar({ title, onMenuClick }) {
  const { user } = useAuth();
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="hamburger" onClick={onMenuClick} aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.75" strokeLinecap="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="topbar-breadcrumb">
          <span style={{ color: 'var(--text-helper)', fontSize: 12 }}>AI Pathshala</span>
          <span className="sep">›</span>
          <span className="topbar-title">{title}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div
          className="avatar"
          title={user?.name}
          style={{ cursor: 'default' }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
