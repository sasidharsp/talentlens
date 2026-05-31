import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'

// Candidate
import Landing from './pages/candidate/Landing'
import Registration from './pages/candidate/Registration'
import Instructions from './pages/candidate/Instructions'
import Assessment from './pages/candidate/Assessment'
import ThankYou from './pages/candidate/ThankYou'
import Round2Entry from './pages/candidate/Round2Entry'
import Round2Instructions from './pages/candidate/Round2Instructions'
import Round2Assessment from './pages/candidate/Round2Assessment'
import Round2ThankYou from './pages/candidate/Round2ThankYou'

// Admin
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'
import CandidateList from './pages/admin/CandidateList'
import CandidateDetail from './pages/admin/CandidateDetail'
import QuestionBank from './pages/admin/QuestionBank'
import Round2Questions from './pages/admin/Round2Questions'
import Round2Candidates from './pages/admin/Round2Candidates'
import LiveMonitor from './pages/admin/LiveMonitor'
import Requisitions from './pages/admin/Requisitions'
import Analytics from './pages/admin/Analytics'
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
          {/* Candidate Portal */}
          <Route path="/" element={<Landing />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/instructions/:sessionToken" element={<Instructions />} />
          <Route path="/assessment/:sessionToken" element={<Assessment />} />
          <Route path="/thankyou" element={<ThankYou />} />

          {/* Round 2 Candidate Portal */}
          <Route path="/round2" element={<Round2Entry />} />
          <Route path="/round2/instructions/:token" element={<Round2Instructions />} />
          <Route path="/round2/assessment/:token" element={<Round2Assessment />} />
          <Route path="/round2/thankyou" element={<Round2ThankYou />} />

          {/* Admin Portal */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="live" element={<LiveMonitor />} />
            <Route path="candidates" element={<CandidateList />} />
            <Route path="candidates/:sessionId" element={<CandidateDetail />} />
            <Route path="r2/candidates" element={<Round2Candidates />} />
            <Route path="r2/questions" element={<Round2Questions />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="requisitions" element={<Requisitions />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />
            <Route path="users" element={<ProtectedRoute requireSuperAdmin><UserManagement /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
