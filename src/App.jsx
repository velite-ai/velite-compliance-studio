import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import NewProject from './pages/NewProject'
import ProjectDetail from './pages/ProjectDetail'
import NewCheck from './pages/NewCheck'
import History from './pages/History'
import CheckDetail from './pages/CheckDetail'
import StyleGuide from './pages/StyleGuide'
import Regulations from './pages/Regulations'
import TextGenerator from './pages/TextGenerator'
import ExportCompliance from './pages/ExportCompliance'
import Guidelines from './pages/Guidelines'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/new" element={<NewProject />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="new-check" element={<NewCheck />} />
        <Route path="text-generator" element={<TextGenerator />} />
        <Route path="history" element={<History />} />
        <Route path="checks/:id" element={<CheckDetail />} />
        <Route path="style-guide" element={<StyleGuide />} />
        <Route path="regulations" element={<Regulations />} />
        <Route path="export" element={<ExportCompliance />} />
        <Route path="guidelines" element={<Guidelines />} />
      </Route>
    </Routes>
  )
}
