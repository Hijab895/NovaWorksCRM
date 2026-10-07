import { useState } from 'react'
import { createProjectsFromTranscript } from '../api.js'

export default function CreateFromTranscript({ onExpiredSession, onViewProjects }) {
  const [transcript, setTranscript] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [details, setDetails] = useState([])
  const [result, setResult] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!transcript.trim() || status === 'loading') return

    setStatus('loading')
    setError('')
    setDetails([])
    setResult(null)

    try {
      const data = await createProjectsFromTranscript(transcript)
      setResult(data)
      setTranscript('')
      setStatus('success')
    } catch (requestError) {
      if (requestError.status === 401) {
        onExpiredSession()
        return
      }
      setError(requestError.message)
      setDetails(Array.isArray(requestError.data?.details) ? requestError.data.details : [])
      setStatus('error')
    }
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Create from Transcript</h1>
          <p className="page-copy">
            Paste finalized meeting notes to create projects and assigned tasks.
          </p>
        </div>
      </div>

      {status === 'success' ? (
        <div className="notice-panel success-panel">
          <strong>Projects created</strong>
          <p>
            Created {result.createdProjectCount} project{result.createdProjectCount === 1 ? '' : 's'} and{' '}
            {result.createdTaskCount} task{result.createdTaskCount === 1 ? '' : 's'}.
          </p>
          <button className="secondary-button" onClick={onViewProjects} type="button">
            View Projects
          </button>
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="notice-panel error-panel" role="alert">
          <strong>{error}</strong>
          {details.length > 0 ? (
            <ul className="correction-list">
              {details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}

      <form className="transcript-form" onSubmit={handleSubmit}>
        <label className="transcript-field">
          Transcript
          <textarea
            disabled={status === 'loading'}
            maxLength="50000"
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Paste transcript notes here..."
            rows="12"
            value={transcript}
          />
        </label>

        <button
          className="primary-button"
          disabled={!transcript.trim() || status === 'loading'}
          type="submit"
        >
          {status === 'loading' ? 'Creating...' : 'Create'}
        </button>
      </form>
    </section>
  )
}
