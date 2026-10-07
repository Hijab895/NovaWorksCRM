import { useEffect, useState } from 'react'
import { getProject } from '../api.js'

function formatDeadline(deadline) {
  return deadline || 'No deadline'
}

export default function ProjectDetail({ projectId, onBack, onExpiredSession }) {
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadProject() {
      setStatus('loading')
      setError('')

      try {
        const data = await getProject(projectId)

        if (!ignore) {
          setProject(data.project)
          setTasks(data.tasks ?? [])
          setStatus('ready')
        }
      } catch (requestError) {
        if (!ignore) {
          if (requestError.status === 401) {
            onExpiredSession()
            return
          }

          setProject(null)
          setTasks([])
          setError(
            requestError.status === 404
              ? 'This project is not available to your account.'
              : requestError.message,
          )
          setStatus('error')
        }
      }
    }

    loadProject()

    return () => {
      ignore = true
    }
  }, [onExpiredSession, projectId])

  return (
    <section className="page-section">
      <button className="text-button" onClick={onBack} type="button">
        Back to projects
      </button>

      {status === 'loading' ? <p className="state-text">Loading project...</p> : null}
      {status === 'error' ? <p className="error-text">{error}</p> : null}

      {status === 'ready' && project ? (
        <>
          <div className="page-header">
            <div>
              <p className="eyebrow">Project</p>
              <h1>{project.name}</h1>
              <p className="page-copy">{project.description || 'No description yet.'}</p>
            </div>
          </div>

          <div className="facts-grid">
            <div>
              <span>Client</span>
              <strong>{project.clientName}</strong>
            </div>
            <div>
              <span>Manager</span>
              <strong>{project.managerName ?? 'Unassigned'}</strong>
            </div>
            <div>
              <span>Deadline</span>
              <strong>{formatDeadline(project.deadline)}</strong>
            </div>
          </div>

          <div className="section-heading">
            <h2>Tasks</h2>
            <p>{tasks.length} returned by the backend</p>
          </div>

          {tasks.length === 0 ? (
            <div className="empty-state">
              <h2>No tasks visible</h2>
              <p>There are no tasks returned for this project and role.</p>
            </div>
          ) : (
            <div className="list-stack">
              {tasks.map((task) => (
                <article className="list-card" key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.description || 'No description yet.'}</p>
                  </div>
                  <dl className="meta-list">
                    <div>
                      <dt>Assignee</dt>
                      <dd>{task.assigneeName ?? 'Unassigned'}</dd>
                    </div>
                    <div>
                      <dt>Deadline</dt>
                      <dd>{formatDeadline(task.deadline)}</dd>
                    </div>
                    <div>
                      <dt>Estimated hours</dt>
                      <dd>{task.estimatedHours}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  )
}
