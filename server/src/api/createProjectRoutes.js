import { randomUUID } from 'node:crypto'
import {
  extractProjectsFromTranscript,
  GeminiError,
} from '../ai/transcript.js'

export const maxTranscriptLength = 50_000
const processingAdmins = new Set()

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function label(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function getEmployeeDirectory(db) {
  return db
    .prepare(
      `
        SELECT id, name, role, specialization, skills_json
        FROM users
        WHERE role IN ('MANAGER', 'AGENT')
        ORDER BY role, name
      `,
    )
    .all()
    .map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      specialization: user.specialization,
      skills: JSON.parse(user.skills_json),
    }))
}

export function validateExtraction(output, directory) {
  const details = []
  const people = new Map(directory.map((person) => [person.id, person]))

  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return ['AI output was not a valid project extraction.']
  }

  if (!Array.isArray(output.unresolvedFields)) {
    details.push('The unresolved fields list is missing or invalid.')
  } else {
    if (output.unresolvedFields.some((item) => typeof item !== 'string')) {
      details.push('The unresolved fields list contains an invalid entry.')
    }
    details.push(
      ...output.unresolvedFields
        .filter((item) => typeof item === 'string' && item.trim())
        .map((item) => item.trim()),
    )
  }

  if (!Array.isArray(output.projects) || output.projects.length === 0) {
    details.push('At least one complete project is required.')
    return details
  }

  output.projects.forEach((project, projectIndex) => {
    const projectLabel = label(project?.name, `Project ${projectIndex + 1}`)
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      details.push(`Project ${projectIndex + 1} is invalid.`)
      return
    }
    if (typeof project.name !== 'string' || !project.name.trim()) {
      details.push(`Project ${projectIndex + 1} needs a name.`)
    }
    if (typeof project.clientName !== 'string' || !project.clientName.trim()) {
      details.push(`${projectLabel} needs a client name.`)
    }
    if (typeof project.description !== 'string') {
      details.push(`${projectLabel} needs a valid description.`)
    }
    const manager = people.get(project.managerId)
    if (!manager || manager.role !== 'MANAGER') {
      details.push(`${projectLabel} needs a valid existing manager ID.`)
    }
    if (typeof project.deadline !== 'string' || !isValidDate(project.deadline)) {
      details.push(`${projectLabel} needs a valid deadline in YYYY-MM-DD format.`)
    }
    if (!Array.isArray(project.tasks) || project.tasks.length === 0) {
      details.push(`${projectLabel} needs at least one complete task.`)
      return
    }

    project.tasks.forEach((task, taskIndex) => {
      const taskLabel = label(task?.title, `Task ${taskIndex + 1} in ${projectLabel}`)
      if (!task || typeof task !== 'object' || Array.isArray(task)) {
        details.push(`Task ${taskIndex + 1} in ${projectLabel} is invalid.`)
        return
      }
      if (typeof task.title !== 'string' || !task.title.trim()) {
        details.push(`Task ${taskIndex + 1} in ${projectLabel} needs a title.`)
      }
      if (typeof task.description !== 'string') {
        details.push(`${taskLabel} needs a valid description.`)
      }
      const assignee = people.get(task.assigneeId)
      if (!assignee || assignee.role !== 'AGENT') {
        details.push(`${taskLabel} needs a valid existing agent ID.`)
      }
      if (typeof task.deadline !== 'string' || !isValidDate(task.deadline)) {
        details.push(`${taskLabel} needs a valid deadline in YYYY-MM-DD format.`)
      } else if (isValidDate(project.deadline) && task.deadline > project.deadline) {
        details.push(`${taskLabel} cannot be due after its project deadline.`)
      }
      if (
        typeof task.estimatedHours !== 'number' ||
        !Number.isFinite(task.estimatedHours) ||
        task.estimatedHours <= 0
      ) {
        details.push(`${taskLabel} needs positive estimated hours.`)
      }
    })
  })

  return [...new Set(details)]
}

export function saveExtraction(db, output) {
  const insertProject = db.prepare(`
    INSERT INTO projects (id, name, client_name, description, manager_id, deadline)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id, project_id, title, description, assignee_id, deadline, estimated_hours
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  const projectIds = []
  let createdTaskCount = 0

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const project of output.projects) {
      const projectId = randomUUID()
      projectIds.push(projectId)
      insertProject.run(
        projectId,
        project.name.trim(),
        project.clientName.trim(),
        project.description?.trim() ?? '',
        project.managerId,
        project.deadline,
      )

      for (const task of project.tasks) {
        insertTask.run(
          randomUUID(),
          projectId,
          task.title.trim(),
          task.description?.trim() ?? '',
          task.assigneeId,
          task.deadline,
          task.estimatedHours,
        )
        createdTaskCount += 1
      }
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return {
    createdProjectCount: projectIds.length,
    createdTaskCount,
    projectIds,
  }
}

function sendGeminiError(res, error) {
  const upstream = typeof error.status === 'number'
    ? {
        status: error.status,
        ...(error.code ? { code: error.code } : {}),
        ...(error.upstreamMessage ? { message: error.upstreamMessage } : {}),
      }
    : undefined
  const send = (status, message) => res
    .status(status)
    .json({ error: message, ...(upstream ? { upstream } : {}) })

  console.error('Gemini request failed:', {
    status: error.status ?? null,
    code: error.code ?? error.kind,
    message: error.upstreamMessage ?? error.kind,
  })

  if (error.kind === 'timeout') {
    send(504, 'AI request timed out. Please try again.')
    return
  }
  if (error.kind === 'configuration') {
    send(503, 'AI service is not configured.')
    return
  }
  if (error.kind === 'blocked') {
    send(422, 'The AI provider could not process this transcript.')
    return
  }
  if (error.kind === 'malformed' || error.kind === 'truncated') {
    send(502, 'The AI provider returned an incomplete response.')
    return
  }
  if (error.status === 429) {
    send(503, 'AI service quota is currently unavailable.')
    return
  }
  if (error.status === 400) {
    send(502, 'The AI provider rejected the extraction request.')
    return
  }
  if (error.status === 401 || error.status === 403) {
    send(502, 'AI provider authentication failed.')
    return
  }
  if (error.status === 404) {
    send(502, 'The configured AI model is unavailable.')
    return
  }
  if (typeof error.status === 'number' && error.status >= 500) {
    send(502, 'The AI provider is temporarily unavailable.')
    return
  }
  send(502, 'Unable to complete the AI request.')
}

export function registerCreateProjectRoutes(
  app,
  db,
  requireAuth,
  extract = extractProjectsFromTranscript,
) {
  app.post('/api/projects/from-transcript', requireAuth, async (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' })
      return
    }

    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript : ''
    if (!transcript.trim()) {
      res.status(400).json({ error: 'Transcript is required' })
      return
    }
    if (transcript.length > maxTranscriptLength) {
      res.status(413).json({ error: `Transcript must be ${maxTranscriptLength} characters or fewer` })
      return
    }
    if (processingAdmins.has(req.user.id)) {
      res.status(409).json({ error: 'A transcript is already being processed' })
      return
    }

    processingAdmins.add(req.user.id)
    try {
      const directory = getEmployeeDirectory(db)
      const output = await extract(transcript, directory)
      const details = validateExtraction(output, directory)

      if (details.length > 0) {
        res.status(422).json({ error: 'Correction required', details })
        return
      }

      res.status(201).json(saveExtraction(db, output))
    } catch (error) {
      if (error instanceof GeminiError) {
        sendGeminiError(res, error)
        return
      }
      next(error)
    } finally {
      processingAdmins.delete(req.user.id)
    }
  })
}
