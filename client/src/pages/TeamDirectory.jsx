import { useEffect, useState } from 'react'
import { getTeam } from '../api.js'

export default function TeamDirectory({ onExpiredSession }) {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadTeam() {
      setStatus('loading')
      setError('')

      try {
        const data = await getTeam()

        if (!ignore) {
          setUsers(data.users ?? [])
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

    loadTeam()

    return () => {
      ignore = true
    }
  }, [onExpiredSession])

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">People</p>
          <h1>Team Directory</h1>
          <p className="page-copy">Read-only view of NovaWorks roles and skills.</p>
        </div>
      </div>

      {status === 'loading' ? <p className="state-text">Loading team...</p> : null}
      {status === 'error' ? <p className="error-text">{error}</p> : null}

      {status === 'ready' && users.length === 0 ? (
        <div className="empty-state">
          <h2>No team members</h2>
          <p>The team directory is empty.</p>
        </div>
      ) : null}

      {users.length > 0 ? (
        <div className="team-grid">
          {users.map((member) => (
            <article className="team-card" key={member.id}>
              <div>
                <h2>{member.name}</h2>
                <p>{member.specialization}</p>
              </div>
              <span className={`role-badge role-${member.role.toLowerCase()}`}>
                {member.role}
              </span>
              <div className="skill-list">
                {member.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
