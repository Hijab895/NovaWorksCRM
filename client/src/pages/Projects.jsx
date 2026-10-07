import { useEffect, useState } from 'react'
import { getProjects } from '../api.js'

function formatDeadline(deadline) {
  return deadline || 'No deadline'
}

export default function Projects({ user, onCreate, onExpiredSession, onOpenProject }) {
  const [projects, setProjects] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadProjects() {
      setStatus('loading')
      setError('')

      try {
        const data = await getProjects()

        if (!ignore) {
          setProjects(data.projects ?? [])
          setStatus('ready')
        }
      } catch (requestError) {
        if (!ignore) {
          if (requestError.status === 401) {
            onExpiredSession()
            return
          }

          setError(requestError.message)
          setStatus('error')
        }
      }
    }

    loadProjects()

    return () => {
      ignore = true
    }
  }, [onExpiredSession])

  const heading = user.role === 'MANAGER' ? 'My Projects' : user.role === 'AGENT' ? 'Related Projects' : 'Projects'

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Work</p>
          <h1>{heading}</h1>
          <p className="page-copy">Project access is filtered by your role.</p>
        </div>
        {user.role === 'ADMIN' ? (
          <button className="primary-button" onClick={onCreate} type="button">
            Create from Transcript
          </button>
        ) : null}
      </div>

      {status === 'loading' ? <p className="state-text">Loading projects...</p> : null}
      {status === 'error' ? <p className="error-text">{error}</p> : null}

      {status === 'ready' && projects.length === 0 ? (
        <div className="empty-state">
          <h2>No projects available</h2>
          <p>No projects match your current role access yet.</p>
        </div>
      ) : null}

      {projects.length > 0 ? (
        <div className="card-grid">
          {projects.map((project) => (
            <button
              className="project-card"
              key={project.id}
              onClick={() => onOpenProject(project.id)}
              type="button"
            >
              <span className="card-title">{project.name}</span>
              <span className="muted">{project.clientName}</span>
              <span className="detail-row">
                <span>Manager</span>
                <strong>{project.managerName ?? 'Unassigned'}</strong>
              </span>
              <span className="detail-row">
                <span>Deadline</span>
                <strong>{formatDeadline(project.deadline)}</strong>
              </span>
              <span className="detail-row">
                <span>Tasks</span>
                <strong>{project.taskCount}</strong>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}
