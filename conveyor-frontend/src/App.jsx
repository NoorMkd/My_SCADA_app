// App.jsx
// Controls ALL routing in the app
// ProtectedRoute makes sure only logged-in users reach pages
// RoleRoute makes sure only certain roles reach specific pages

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context/AuthContext"

// Pages
import LoginPage     from "./pages/LoginPage"
import DashboardPage from "./pages/DashboardPage"
import HistoryPage   from "./pages/HistoryPage"
import AlertsPage    from "./pages/AlertsPage"
import TechLogPage   from "./pages/TechLogPage"
import UsersPage     from "./pages/UsersPage"

// ProtectedRoute: kicks non-logged-in users back to login
function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  return children
}

// RoleRoute: kicks users who don't have the right role
// allowedRoles = array of roles that can see this page
function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth()

  // If user's role is not in the allowed list → go to dashboard
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── PUBLIC ── */}
        <Route path="/" element={<LoginPage />} />

        {/* ── PROTECTED: all logged-in users ── */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }/>

        <Route path="/history" element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }/>

        <Route path="/alerts" element={
          <ProtectedRoute>
            <AlertsPage />
          </ProtectedRoute>
        }/>

        {/* ── ROLE PROTECTED: only these roles ── */}
        <Route path="/techlog" element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin", "supervisor", "technician"]}>
              <TechLogPage />
            </RoleRoute>
          </ProtectedRoute>
        }/>

        <Route path="/users" element={
          <ProtectedRoute>
            <RoleRoute allowedRoles={["admin", "supervisor"]}>
              <UsersPage />
            </RoleRoute>
          </ProtectedRoute>
        }/>

        {/* ── CATCH ALL: unknown URL → dashboard ── */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App