
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CitizenDashboard from './pages/CitizenDashboard'
import OfficerDashboard from './pages/OfficerDashboard'
import './App.css'


type Portal =
  | 'citizen'
  | 'officer'
  | 'government'
  | 'laboratory'
  | 'supervisor'

type PortalInfo = {
  id: Portal
  title: string
  description: string
}

const portals: PortalInfo[] = [
  {
    id: 'citizen',
    title: 'Citizen',
    description: 'Report food-safety concerns and track complaints.',
  },
  {
    id: 'officer',
    title: 'Food Safety Officer',
    description: 'Review complaints and manage inspections.',
  },
  {
    id: 'government',
    title: 'Government',
    description: 'Access authorized oversight and administration.',
  },
  {
    id: 'laboratory',
    title: 'Laboratory',
    description: 'Manage samples and laboratory results.',
  },
  {
    id: 'supervisor',
    title: 'Supervisor',
    description: 'Oversee cases, reviews, and officer activity.',
  },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const portalMatch = location.pathname.match(
    /^\/login\/(citizen|officer|government|laboratory|supervisor)\/?$/
  )

  const selectedPortal = (
    location.pathname === '/register'
      ? 'citizen'
      : portalMatch?.[1] ?? null
  ) as Portal | null

  const mode: 'login' | 'register' =
    location.pathname === '/register' ? 'register' : 'login'

  const [loginMenuOpen, setLoginMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selected = portals.find(
    (portal) => portal.id === selectedPortal
  )
  const isCitizen = selectedPortal === 'citizen'

  useEffect(() => {
    if (location.pathname === '/' && location.hash) {
      const targetId = location.hash.slice(1)

      window.setTimeout(() => {
        document
          .getElementById(targetId)
          ?.scrollIntoView({ behavior: 'smooth' })
      }, 0)

      return
    }

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname, location.hash])

  function openLogin(portal: Portal) {
    navigate(`/login/${portal}`)
    setLoginMenuOpen(false)
    setMobileMenuOpen(false)
    setMessage('')
    setName('')
    setEmail('')
    setPassword('')
  }

  function openCitizenRegistration() {
    navigate('/register')
    setLoginMenuOpen(false)
    setMobileMenuOpen(false)
    setMessage('')
    setName('')
    setEmail('')
    setPassword('')
  }

  function goHome() {
    navigate('/')
    setLoginMenuOpen(false)
    setMobileMenuOpen(false)
    setMessage('')
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    if (mode === 'register' && !isCitizen) {
      setMessage(
        'Public registration is available only for citizens.'
      )
      return
    }

    setIsSubmitting(true)
    setMessage('')

    try {
      const endpoint =
        mode === 'register'
          ? '/api/auth/register'
          : '/api/auth/login'

      const payload =
        mode === 'register'
          ? { name: name.trim(), email: email.trim(), password }
          : { email: email.trim(), password }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          data.message ||
            `Request failed with status ${response.status}.`
        )
      }

      if (mode === 'register') {
        setName('')
        setPassword('')
        setMessage('Registration successful! Please log in.')
        navigate('/login/citizen')
        return
      }

      if (!data.token || !data.user) {
        throw new Error(
          'The server did not return the required login information.'
        )
      }

      if (isCitizen && data.user.role !== 'CITIZEN') {
        throw new Error(
          'This account is not registered as a citizen account.'
        )
      }

      sessionStorage.setItem('foster_token', data.token)
      sessionStorage.setItem(
        'foster_user',
        JSON.stringify(data.user)
      )

      if (data.user.role === 'CITIZEN') {
  navigate('/citizen/dashboard')
  return
}

if (data.user.role === 'FOOD_SAFETY_OFFICER') {
  navigate('/officer/dashboard')
  return
}

if (data.user.role === 'LAB_OFFICER') {
  setMessage(
    'Login successful. The Laboratory Dashboard is not connected yet.'
  )
  return
}

if (data.user.role === 'SUPERVISOR') {
  setMessage(
    'Login successful. The Supervisor Dashboard is not connected yet.'
  )
  return
}

setMessage('This account does not have a supported portal.')
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to connect to the server. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const normalizedPath = location.pathname.replace(/\/+$/, '')
  if (normalizedPath === '/officer/dashboard') {
  return <OfficerDashboard />
}

  if (normalizedPath === '/citizen/dashboard') {
    return <CitizenDashboard />
  }

  return (
    <main className="site">
      <header className="navbar">
        <a
          href="/#home"
          className="brand"
          onClick={(event) => {
            event.preventDefault()
            goHome()
          }}
        >
          <span className="brand-mark">F</span>
          <span className="brand-copy">
            <strong>FOSTER AI</strong>
            <small>Food Safety Intelligence</small>
          </span>
        </a>

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          className={`nav-links ${mobileMenuOpen ? 'nav-open' : ''}`}
        >
          <a href="/#home" onClick={() => setMobileMenuOpen(false)}>
            Home
          </a>
          <a href="/#about" onClick={() => setMobileMenuOpen(false)}>
            About
          </a>
          <a
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
          >
            How It Works
          </a>
          <a
            href="/#contact"
            onClick={() => setMobileMenuOpen(false)}
          >
            Contact
          </a>

          <div className="nav-login">
            <button
              type="button"
              className="nav-login-button"
              aria-expanded={loginMenuOpen}
              onClick={() => setLoginMenuOpen((open) => !open)}
            >
              Login <span className="chevron">▾</span>
            </button>

            {loginMenuOpen && (
              <div className="login-dropdown">
                <p className="dropdown-heading">Choose your portal</p>

                {portals.map((portal) => (
                  <button
                    type="button"
                    key={portal.id}
                    onClick={() => openLogin(portal.id)}
                  >
                    <span>{portal.title}</span>
                    <span className="dropdown-arrow">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="nav-signup"
            onClick={openCitizenRegistration}
          >
            Sign Up
          </button>
        </nav>
      </header>

      {selected ? (
        <section className="auth-section" aria-labelledby="auth-title">
          <div className="auth-backdrop" />

          <div className="auth-layout">
            <div className="auth-intro">
              <button
                type="button"
                className="back-link"
                onClick={goHome}
              >
                ← Back to home
              </button>

              <span className="eyebrow">
                FOSTER AI SECURE ACCESS
              </span>

              <h1 id="auth-title">
                {mode === 'register'
                  ? 'Create your citizen account.'
                  : `Welcome to the ${selected.title} Portal.`}
              </h1>

              <p>{selected.description}</p>

              <div className="access-note">
                <span className="access-check">✓</span>
                <p>
                  <strong>Role-based access</strong>
                  <span>
                    Each account can access only the features
                    authorized for its assigned role.
                  </span>
                </p>
              </div>
            </div>

            <div className="auth-card">
              <span className="eyebrow">
                {mode === 'register'
                  ? 'CITIZEN REGISTRATION'
                  : 'ACCOUNT ACCESS'}
              </span>

              <h2>
                {mode === 'register'
                  ? 'Create an account'
                  : 'Sign in'}
              </h2>

              <p className="auth-subtitle">
                {mode === 'register'
                  ? 'Register as a citizen to submit and track food-safety complaints.'
                  : `Sign in with your authorized ${selected.title.toLowerCase()} account.`}
              </p>

              {isCitizen && (
                <div className="auth-mode-tabs">
                  <button
                    type="button"
                    className={mode === 'login' ? 'active' : ''}
                    onClick={() => {
                      navigate('/login/citizen')
                      setMessage('')
                    }}
                  >
                    Login
                  </button>

                  <button
                    type="button"
                    className={mode === 'register' ? 'active' : ''}
                    onClick={() => {
                      navigate('/register')
                      setMessage('')
                    }}
                  >
                    Register
                  </button>
                </div>
              )}

              <form className="auth-form" onSubmit={submitForm}>
                {mode === 'register' && isCitizen && (
                  <label>
                    Full name
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Enter your full name"
                      value={name}
                      onChange={(event) =>
                        setName(event.target.value)
                      }
                      required
                    />
                  </label>
                )}

                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    required
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    autoComplete={
                      mode === 'register'
                        ? 'new-password'
                        : 'current-password'
                    }
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    minLength={mode === 'register' ? 6 : undefined}
                    required
                  />
                </label>

                <button
                  type="submit"
                  className="auth-submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Please wait...'
                    : mode === 'register'
                      ? 'Create citizen account'
                      : 'Sign in securely'}
                  {!isSubmitting && <span>→</span>}
                </button>

                {message && (
                  <p className="auth-message" role="status">
                    {message}
                  </p>
                )}
              </form>

              {!isCitizen && (
                <div className="staff-warning">
                  <strong>Authorized account required</strong>
                  <p>
                    Staff accounts are created or approved by the
                    authorized administrator. Citizen registration
                    cannot create an officer, government, laboratory,
                    or supervisor account.
                  </p>
                </div>
              )}

              <div className="auth-card-footer">
                Your account role must be verified by the server.
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="hero" id="home">
            <div className="hero-content">
              <span className="eyebrow">
                SMARTER FOOD SAFETY. FASTER ACTION.
              </span>

              <h1>
                Turning food-safety complaints into{' '}
                <span>proactive action.</span>
              </h1>

              <p>
                FOSTER AI helps identify high-risk food-safety
                complaints by bringing together complaint information,
                inspection findings, and laboratory results to support
                informed decisions.
              </p>

              <div className="hero-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={openCitizenRegistration}
                >
                  Report a concern <span>→</span>
                </button>

                <a
                  className="secondary-button"
                  href="/#how-it-works"
                >
                  Explore how it works
                </a>
              </div>

              <div className="hero-trust">
                <span className="trust-dot" />
                Risk-informed prioritization
                <span className="trust-separator">•</span>
                Explainable AI insights
              </div>
            </div>

            <div
              className="hero-visual"
              aria-label="Food safety illustration"
            >
              <div className="visual-orbit orbit-one" />
              <div className="visual-orbit orbit-two" />

              <div className="visual-center">
                <span className="visual-leaf">✓</span>
                <strong>FOSTER AI</strong>
                <small>Food Safety Intelligence</small>
              </div>

              <div className="visual-tag tag-top">
                <span className="tag-dot green-dot" />
                Complaint analysis
              </div>

              <div className="visual-tag tag-right">
                <span className="tag-dot orange-dot" />
                Risk prioritization
              </div>

              <div className="visual-tag tag-bottom">
                <span className="tag-dot blue-dot" />
                Actionable insights
              </div>
            </div>
          </section>

          <section className="section about-section" id="about">
            <div className="section-heading">
              <span className="eyebrow">ABOUT FOSTER AI</span>
              <h2>From scattered information to informed action.</h2>
              <p>
                Food-safety complaints, inspection records, and lab
                findings can reveal important risks. FOSTER AI is
                designed to help authorized teams connect that
                information and decide what needs attention first.
              </p>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <span className="feature-number">01</span>
                <h3>Bring information together</h3>
                <p>
                  Organize complaints, inspection observations, and
                  laboratory findings in one workflow.
                </p>
              </article>

              <article className="feature-card">
                <span className="feature-number">02</span>
                <h3>Prioritize potential risks</h3>
                <p>
                  Use AI-supported risk assessment to help identify
                  complaints that may need earlier review.
                </p>
              </article>

              <article className="feature-card">
                <span className="feature-number">03</span>
                <h3>Support practical action</h3>
                <p>
                  Help authorized teams review evidence and plan
                  appropriate follow-up activities.
                </p>
              </article>
            </div>
          </section>

          <section
            className="section workflow-section"
            id="how-it-works"
          >
            <div className="section-heading">
              <span className="eyebrow">HOW IT WORKS</span>
              <h2>A clear path from report to response.</h2>
              <p>
                A proposed workflow for connecting public reports
                with authorized food-safety review.
              </p>
            </div>

            <div className="workflow-grid">
              <article className="workflow-step">
                <span>1</span>
                <h3>Report</h3>
                <p>A citizen submits a food-safety concern.</p>
              </article>

              <article className="workflow-step">
                <span>2</span>
                <h3>Assess</h3>
                <p>
                  Available information is reviewed for potential
                  risk.
                </p>
              </article>

              <article className="workflow-step">
                <span>3</span>
                <h3>Review</h3>
                <p>
                  Authorized personnel examine relevant evidence.
                </p>
              </article>

              <article className="workflow-step">
                <span>4</span>
                <h3>Respond</h3>
                <p>
                  Responsible teams determine suitable follow-up
                  action.
                </p>
              </article>
            </div>
          </section>

          <section className="contact-section" id="contact">
            <div>
              <span className="eyebrow">GET STARTED</span>
              <h2>
                Help make food-safety response more proactive.
              </h2>
              <p>
                Citizens can register to report concerns. Authorized
                personnel can access their assigned portal through
                Login.
              </p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={openCitizenRegistration}
            >
              Citizen Sign Up <span>→</span>
            </button>
          </section>
        </>
      )}

      <footer className="site-footer">
        <a
          href="/#home"
          className="footer-brand"
          onClick={(event) => {
            event.preventDefault()
            goHome()
          }}
        >
          FOSTER AI
        </a>

        <span>Food Safety Intelligence Platform</span>
        <span>© {new Date().getFullYear()} FOSTER AI</span>
      </footer>
    </main>
  )
}

export default App
