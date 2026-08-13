import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Nav items marked `optional: true` render dimmer with a tooltip — they still
// work fully. This nudges the team toward the core compliance flow (Projects →
// New Check) without hiding capability the team may need occasionally.
const NAV = [
  { to: '/',           label: 'Dashboard',    icon: '◈',  end: true },
  { to: '/projects',   label: 'Projects',     icon: '📁' },
  { section: 'Quality Control' },
  { to: '/qc',             label: 'QC Dashboard',   icon: '🔬', end: true },
  { to: '/qc/batches',     label: 'Batches',        icon: '🧫' },
  { to: '/qc/specs',       label: 'Specifications', icon: '📐' },
  { to: '/qc/deviations',  label: 'Deviations & CAPA', icon: '⚠️' },
  { section: 'Compliance' },
  { to: '/new-check',      label: 'New Check',      icon: '＋' },
  { to: '/batch-check',    label: 'Batch Check',    icon: '📚' },
  { to: '/text-generator', label: 'Text Generator', icon: '✏️',
    optional: true, hint: 'Use only when drafting label copy from scratch — the main New Check flow is usually enough.' },
  { to: '/export',         label: 'Export Module',  icon: '🌍',
    optional: true, hint: 'Use only for products going to EU / US / GCC etc. Export rules are AI-inferred — verify with the target-market regulator before print.' },
  { to: '/history',        label: 'History',        icon: '◷' },
  { to: '/guidelines',     label: 'Guidelines',     icon: '📚' },
  { to: '/style-guide',    label: 'Style Guide',    icon: '◉' },
  { to: '/regulations',    label: 'Regulations',    icon: '📋' },
]

const PAGE_TITLES = {
  '/':               'Dashboard',
  '/projects':       'Projects',
  '/projects/new':   'New Project',
  '/qc':              'QC Dashboard',
  '/qc/batches':      'Batches',
  '/qc/batches/new':  'New Batch',
  '/qc/specs':        'QC Specifications',
  '/qc/specs/new':    'New Specification',
  '/qc/deviations':   'Deviations & CAPA',
  '/new-check':       'New Compliance Check',
  '/batch-check':     'Batch Compliance Check',
  '/text-generator':  'Label Text Generator',
  '/history':         'Check History',
  '/style-guide':    'Style Guide',
  '/regulations':    'Regulation Library',
  '/export':         'Export Compliance',
  '/guidelines':     'Internal Guidelines',
}

export default function Layout() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email?.[0] || '?').toUpperCase()

  const pageTitle =
    PAGE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/checks/') ? 'Check Detail' :
     location.pathname.startsWith('/qc/batches/') ? 'Batch QC' :
     location.pathname.startsWith('/projects/') ? 'Project Detail' : '')

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🧴</div>
          <h1>Velite Compliance Studio</h1>
          <p>v2.0 · Velite Healthcare</p>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) => (
            item.section ? (
              <div key={`sec-${i}`} style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,.35)', padding: '14px 12px 4px',
              }}>
                {item.section}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.hint || undefined}
                className={({ isActive }) =>
                  'nav-item' + (isActive ? ' active' : '') + (item.optional ? ' nav-optional' : '')
                }
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.optional && (
                  <span className="nav-optional-badge" title={item.hint}>?</span>
                )}
              </NavLink>
            )
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="user-name">{profile?.full_name || 'User'}</div>
              <div className="user-email">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="nav-item"
            style={{ marginTop: 4, color: 'rgba(255,255,255,.4)' }}
          >
            <span className="nav-icon">→</span>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <span className="topbar-title">{pageTitle}</span>
          <NavLink to="/new-check" className="btn btn-primary btn-sm">
            ＋ New Check
          </NavLink>
        </header>

        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
