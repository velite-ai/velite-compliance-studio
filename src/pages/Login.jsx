import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = tab === 'signin'
        ? await signIn(email, password)
        : await signUp(email, password, fullName)
      if (err) { setError(err.message); return }
      navigate('/')
    } catch (ex) {
      setError(String(ex))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-badge">🧴</div>
          <h2>Velite Compliance Studio</h2>
          <p>Cosmetic packaging compliance checker · v2.0</p>
        </div>

        <div className="login-tabs">
          <button className={`login-tab${tab === 'signin' ? ' active' : ''}`} onClick={() => setTab('signin')}>
            Sign in
          </button>
          <button className={`login-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => setTab('signup')}>
            Create account
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          {tab === 'signup' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Your name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@velite.in"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> {tab === 'signin' ? 'Signing in…' : 'Creating account…'}</> : (tab === 'signin' ? 'Sign in to your account' : 'Create account')}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 20 }}>
          Velite Healthcare · Internal use only
        </p>
      </div>
    </div>
  )
}
