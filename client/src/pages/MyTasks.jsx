import { useEffect, useState } from 'react'
import { getTasks } from '../api.js'

function formatDeadline(deadline) {
  return deadline || 'No deadline'
}

export default function MyTasks({ onExpiredSession, onOpenProject }) {
  const [tasks, setTasks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadTasks() {
      setStatus('loading')
      setError('')

      try {
        const data = await getTasks()

        if (!ignore) {
          setTasks(data.tasks ?? [])
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

    loadTasks()

    return () => {
      ignore = true
    }
  }, [onExpiredSession])

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h1>My Tasks</h1>
          <p className="page-copy">Only tasks returned for your account are shown.</p>
        </div>
      </div>

      {status === 'loading' ? <p className="state-text">Loading tasks...</p> : null}
      {status === 'error' ? <p className="error-text">{error}</p> : null}

      {status === 'ready' && tasks.length === 0 ? (
        <div className="empty-state">
          <h2>No tasks available</h2>
          <p>No tasks are assigned or visible to your account yet.</p>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div className="list-stack">
          {tasks.map((task) => (
            <article className="list-card" key={task.id}>
              <div>
                <h3>{task.title}</h3>
                <p>{task.description || 'No description yet.'}</p>
                <button
                  className="text-button inline"
                  onClick={() => onOpenProject(task.projectId)}
                  type="button"
                >
                  {task.projectName}
                </button>
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
      ) : null}
    </section>
  )
}
