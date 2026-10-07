import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, getMe, login, logout } from './api.js'
import './App.css'
import Layout from './components/Layout.jsx'
import CreateFromTranscript from './pages/CreateFromTranscript.jsx'
import Login from './pages/Login.jsx'
import MyTasks from './pages/MyTasks.jsx'
import ProjectDetail from './pages/ProjectDetail.jsx'
import Projects from './pages/Projects.jsx'
import TeamDirectory from './pages/TeamDirectory.jsx'

function defaultPageForRole(role) {
  return role === 'AGENT' ? 'tasks' : 'projects'
}

const allowedPagesByRole = {
  ADMIN: ['projects', 'create', 'team'],
  MANAGER: ['projects', 'team'],
  AGENT: ['tasks', 'projects', 'team'],
}

function getAllowedPages(role) {
  return allowedPagesByRole[role] ?? []
}

function App() {
  const [user, setUser] = useState(null)
  const [authStatus, setAuthStatus] = useState('checking')
  const [loginError, setLoginError] = useState('')
  const [page, setPage] = useState('projects')
  const [selectedProjectId, setSelectedProjectId] = useState(null)

  useEffect(() => {
    let ignore = false

    async function checkSession() {
      try {
        const data = await getMe()

        if (!ignore) {
          setUser(data.user)
          setPage(defaultPageForRole(data.user.role))
          setAuthStatus('authenticated')
        }
      } catch (error) {
        if (!ignore) {
          setUser(null)
          setSelectedProjectId(null)
          setAuthStatus(error.status === 401 ? 'unauthenticated' : 'error')
        }
      }
    }

    checkSession()

    return () => {
      ignore = true
    }
  }, [])

  const allowedPages = useMemo(() => getAllowedPages(user?.role), [user?.role])

  const clearSessionState = useCallback(() => {
    setUser(null)
    setPage('projects')
    setSelectedProjectId(null)
    setLoginError('')
    setAuthStatus('unauthenticated')
  }, [])

  async function handleLogin(email, password) {
    setLoginError('')

    try {
      const data = await login(email, password)
      setUser(data.user)
      setSelectedProjectId(null)
      setPage(defaultPageForRole(data.user.role))
      setAuthStatus('authenticated')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setLoginError('Invalid email or password.')
        return
      }

      setLoginError(error.message)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } finally {
      clearSessionState()
    }
  }

  function handleNavigate(nextPage) {
    if (!allowedPages.includes(nextPage)) {
      return
    }

    setSelectedProjectId(null)
    setPage(nextPage)
  }

  function handleOpenProject(projectId) {
    setSelectedProjectId(projectId)
    setPage('projectDetail')
  }

  if (authStatus === 'checking') {
    return (
      <main className="centered-shell">
        <p className="state-text">Checking your session...</p>
      </main>
    )
  }

  if (authStatus === 'error') {
    return (
      <main className="centered-shell">
        <section className="empty-state">
          <h1>Unable to reach NovaWorks CRM</h1>
          <p>Start the backend server, then refresh this page.</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <Login error={loginError} onLogin={handleLogin} />
  }

  const restrictedPage =
    page !== 'projectDetail' && !allowedPages.includes(page)

  return (
    <Layout
      onLogout={handleLogout}
      onNavigate={handleNavigate}
      page={page === 'projectDetail' ? 'projects' : page}
      user={user}
    >
      {restrictedPage ? (
        <section className="empty-state">
          <h1>Page unavailable</h1>
          <p>This page is not available for your role.</p>
        </section>
      ) : null}

      {!restrictedPage && page === 'projects' ? (
        <Projects
          onCreate={() => handleNavigate('create')}
          onExpiredSession={clearSessionState}
          onOpenProject={handleOpenProject}
          user={user}
        />
      ) : null}

      {!restrictedPage && page === 'projectDetail' ? (
        <ProjectDetail
          onBack={() => handleNavigate('projects')}
          onExpiredSession={clearSessionState}
          projectId={selectedProjectId}
        />
      ) : null}

      {!restrictedPage && page === 'tasks' ? (
        <MyTasks
          onExpiredSession={clearSessionState}
          onOpenProject={handleOpenProject}
        />
      ) : null}

      {!restrictedPage && page === 'team' ? (
        <TeamDirectory onExpiredSession={clearSessionState} />
      ) : null}

      {!restrictedPage && page === 'create' && user.role === 'ADMIN' ? (
        <CreateFromTranscript
          onExpiredSession={clearSessionState}
          onViewProjects={() => handleNavigate('projects')}
        />
      ) : null}
    </Layout>
  )
}

export default App
