export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function parseResponse(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { error: text }
  }
}

export async function apiRequest(path, options = {}) {
  let response

  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      ...options,
    })
  } catch {
    throw new ApiError('Unable to reach the server. Check that the backend is running.')
  }

  const data = await parseResponse(response)

  if (!response.ok) {
    const message =
      data?.error ??
      (response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'Something went wrong.')

    throw new ApiError(message, { status: response.status, data })
  }

  return data
}

export function getMe() {
  return apiRequest('/auth/me')
}

export function login(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST' })
}

export function getProjects() {
  return apiRequest('/projects')
}

export function getProject(projectId) {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}`)
}

export function getTasks() {
  return apiRequest('/tasks')
}

export function getTeam() {
  return apiRequest('/team')
}

export function createProjectsFromTranscript(transcript) {
  return apiRequest('/projects/from-transcript', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  })
}
