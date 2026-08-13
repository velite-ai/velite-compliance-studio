import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'

// Eager: the core flow the team hits on every session
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import NewProject from './pages/NewProject'
import ProjectDetail from './pages/ProjectDetail'
import NewCheck from './pages/NewCheck'
import History from './pages/History'
import CheckDetail from './pages/CheckDetail'

// Lazy: optional / occasionally-used pages. Each becomes its own chunk that
// only loads when the user actually navigates there — cuts the initial bundle
// so the app opens faster on the packaging team's laptops.
const BatchCheck       = lazy(() => import('./pages/BatchCheck'))
const StyleGuide       = lazy(() => import('./pages/StyleGuide'))
const Regulations      = lazy(() => import('./pages/Regulations'))
const TextGenerator    = lazy(() => import('./pages/TextGenerator'))
const ExportCompliance = lazy(() => import('./pages/ExportCompliance'))
const Guidelines       = lazy(() => import('./pages/Guidelines'))
const QCDashboard      = lazy(() => import('./pages/qc/QCDashboard'))
const Specifications   = lazy(() => import('./pages/qc/Specifications'))
const NewSpecification = lazy(() => import('./pages/qc/NewSpecification'))
const Batches          = lazy(() => import('./pages/qc/Batches'))
const NewBatch         = lazy(() => import('./pages/qc/NewBatch'))
const BatchDetail      = lazy(() => import('./pages/qc/BatchDetail'))
const Deviations       = lazy(() => import('./pages/qc/Deviations'))

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PageSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <span className="spinner" />
    </div>
  )
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
        <Route path="history" element={<History />} />
        <Route path="checks/:id" element={<CheckDetail />} />

        {/* Lazy-loaded routes — wrapped in Suspense */}
        <Route path="batch-check"    element={<Suspense fallback={<PageSpinner />}><BatchCheck /></Suspense>} />
        <Route path="text-generator" element={<Suspense fallback={<PageSpinner />}><TextGenerator /></Suspense>} />
        <Route path="style-guide"    element={<Suspense fallback={<PageSpinner />}><StyleGuide /></Suspense>} />
        <Route path="regulations"    element={<Suspense fallback={<PageSpinner />}><Regulations /></Suspense>} />
        <Route path="export"         element={<Suspense fallback={<PageSpinner />}><ExportCompliance /></Suspense>} />
        <Route path="guidelines"     element={<Suspense fallback={<PageSpinner />}><Guidelines /></Suspense>} />

        {/* QC Module — all lazy */}
        <Route path="qc"             element={<Suspense fallback={<PageSpinner />}><QCDashboard /></Suspense>} />
        <Route path="qc/specs"       element={<Suspense fallback={<PageSpinner />}><Specifications /></Suspense>} />
        <Route path="qc/specs/new"   element={<Suspense fallback={<PageSpinner />}><NewSpecification /></Suspense>} />
        <Route path="qc/batches"     element={<Suspense fallback={<PageSpinner />}><Batches /></Suspense>} />
        <Route path="qc/batches/new" element={<Suspense fallback={<PageSpinner />}><NewBatch /></Suspense>} />
        <Route path="qc/batches/:id" element={<Suspense fallback={<PageSpinner />}><BatchDetail /></Suspense>} />
        <Route path="qc/deviations"  element={<Suspense fallback={<PageSpinner />}><Deviations /></Suspense>} />
      </Route>
    </Routes>
  )
}
