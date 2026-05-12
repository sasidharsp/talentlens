import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Candidate
import Registration from './pages/candidate/Registration'
import Instructions from './pages/candidate/Instructions'
import Assessment from './pages/candidate/Assessment'
import ThankYou from './pages/candidate/ThankYou'

// Admin
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import CandidateList from './pages/admin/CandidateList'
import CandidateDetail from './pages/admin/CandidateDetail'
import QuestionBank from './pages/admin/QuestionBank'
import Settings from './pages/admin/Settings'
import UserManagement from './pages/admin/UserManagement'
import AdminLayout from './components/AdminLayout'

function ProtectedRoute({ children, requireAdmin = false, requireSuperAdmin = false }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><span className="spinner" /></div>
  if (!user) return <Navigate to="/admin/login" replace />
  if (requireSuperAdmin && user.role !== 'super_admin') return <Navigate to="/admin" replace />
  if (requireAdmin && !['admin', 'super_admin'].includes(user.role)) return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1F2937', color: '#F9FAFB', border: '1px solid #374151' },
            success: { iconTheme: { primary: '#10B981', secondary: '#F9FAFB' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#F9FAFB' } },
          }}
        />
        <Routes>
          {/* Candidate Portal (no auth) */}
          <Route path="/" element={<Registration />} />
          <Route path="/instructions/:sessionToken" element={<Instructions />} />
          <Route path="/assessment/:sessionToken" element={<Assessment />} />
          <Route path="/thankyou" element={<ThankYou />} />

          {/* Admin Portal */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={
            <ProtectedRoute><AdminLayout /></ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="candidates" element={<CandidateList />} />
            <Route path="candidates/:sessionId" element={<CandidateDetail />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="settings" element={
              <ProtectedRoute requireAdmin><Settings /></ProtectedRoute>
            } />
            <Route path="users" element={
              <ProtectedRoute requireSuperAdmin><UserManagement /></ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
