import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ADMIN_ROLES = ['super_admin', 'manager', 'team_lead'];
const FIELD_ROLES = ['trainer', 'reviewer'];

const homeFor = (role) => {
  if (ADMIN_ROLES.includes(role)) return '/admin';
  return '/trainer';
};

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', color: '#64748b' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
