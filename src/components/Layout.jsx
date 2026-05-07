import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',           label: 'Dashboard',    icon: '◈',  end: true },
  { to: '/projects',   label: 'Projects',     icon: '📁' },
  { to: '/new-check',      label: 'New Check',      icon: '＋' },
  { to: '/text-generator', label: 'Text Generator', icon: '✏️' },
  { to: '/export',         label: 'Export Module',  icon: '🌍' },
  { to: '/history',        label: 'History',        icon: '◷' },
  { to: '/style-guide',    label: 'Style Guide',    icon: '◉' },
  { to: '/regulations',    label: 'Regulations',    icon: '📋' },
]

const PAGE_TITLES = {
  '/':               'Dashboard',
  '/projects':       'Projects',
  '/projects/new':   'New Project',
  '/new-check':       'New Compliance Check',
  '/text-generator':  'Label Text Generator',
  '/history':         'Check History',
  '/style-guide':    'Style Guide',
  '/regulations':    'Regulation Library',
  '/export':         'Export Compliance',
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
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </NavLink>
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
