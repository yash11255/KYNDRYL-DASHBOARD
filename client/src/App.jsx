import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

import Login             from './pages/Login';
import AdminDashboard    from './pages/AdminDashboard';
import TrainerDashboard  from './pages/TrainerDashboard';
import TrainerSessions   from './pages/TrainerSessions';
import SessionFlow       from './pages/SessionFlow';
import SchoolManager     from './pages/SchoolManager';
import AssignmentManager from './pages/AssignmentManager';
import Reports           from './pages/Reports';
import HierarchyManager  from './pages/HierarchyManager';
import AuditLogs         from './pages/AuditLogs';
import BaseStay            from './pages/BaseStay';
import DailyExpenses       from './pages/DailyExpenses';
import AssessmentBuilder   from './pages/AssessmentBuilder';
import IGWFAnalytics       from './pages/IGWFAnalytics';

const ADMIN_ROLES    = ['super_admin', 'manager', 'team_lead'];
const TRAINER_ROLES  = ['trainer', 'reviewer'];
const ALL_ROLES      = [...ADMIN_ROLES, ...TRAINER_ROLES];

function AppShell({ children, title }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content" style={{ marginLeft: 240 }}>
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        {children}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const home = user ? (ADMIN_ROLES.includes(user.role) ? '/admin' : '/trainer') : '/login';

  const adminShell = (title, el) => (
    <ProtectedRoute roles={ADMIN_ROLES}>
      <AppShell title={title}>{el}</AppShell>
    </ProtectedRoute>
  );
  const trainerShell = (title, el) => (
    <ProtectedRoute roles={TRAINER_ROLES}>
      <AppShell title={title}>{el}</AppShell>
    </ProtectedRoute>
  );
  const fieldShell = (title, el) => (
    <ProtectedRoute roles={ALL_ROLES}>
      <AppShell title={title}>{el}</AppShell>
    </ProtectedRoute>
  );

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} /> : <Login />} />

      {/* ── Admin / Manager / Team Lead ── */}
      <Route path="/admin"             element={adminShell('Dashboard',     <AdminDashboard />)} />
      <Route path="/admin/hierarchy"   element={adminShell('Team Hierarchy', <HierarchyManager />)} />
      <Route path="/admin/schools"     element={adminShell('Schools',       <SchoolManager />)} />
      <Route path="/admin/assignments" element={adminShell('Assignments',   <AssignmentManager />)} />
      <Route path="/admin/sessions"    element={adminShell('Session Reports', <Reports />)} />
      <Route path="/admin/audit"       element={adminShell('Audit Logs',    <AuditLogs />)} />
      <Route path="/admin/assessment-builder" element={adminShell('Assessment Builder', <AssessmentBuilder />)} />
      <Route path="/admin/igwf"             element={adminShell('IGWF Analytics',    <IGWFAnalytics />)} />

      {/* ── Trainer / Reviewer ── */}
      <Route path="/trainer"              element={trainerShell('My Schedule',    <TrainerDashboard />)} />
      <Route path="/trainer/sessions"     element={trainerShell('My Sessions',    <TrainerSessions />)} />
      <Route path="/trainer/session/:id"  element={trainerShell('Session',        <SessionFlow />)} />
      <Route path="/trainer/basestay"     element={trainerShell('Base Stay',      <BaseStay />)} />
      <Route path="/trainer/expenses"     element={trainerShell('Daily Expenses', <DailyExpenses />)} />

      <Route path="/"  element={<Navigate to={home} replace />} />
      <Route path="*"  element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
