import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import {
  getEmployeeDirectory,
  maxTranscriptLength,
  registerCreateProjectRoutes,
  saveExtraction,
  validateExtraction,
} from '../src/api/createProjectRoutes.js'
import { initializeDatabase } from '../src/db.js'

function createTestDatabase() {
  const db = initializeDatabase(new DatabaseSync(':memory:'))
  const insertUser = db.prepare(`
    INSERT INTO users (
      id, name, email, password_hash, role, specialization, skills_json
    ) VALUES (?, ?, ?, 'unused', ?, ?, '[]')
  `)
  insertUser.run('ADMIN', 'Admin', 'admin@test.example', 'ADMIN', 'Administrator')
  insertUser.run('PM01', 'Manager', 'manager@test.example', 'MANAGER', 'Web PM')
  insertUser.run('DEV01', 'Agent', 'agent@test.example', 'AGENT', 'Full-Stack')
  return db
}

function validOutput() {
  return {
    unresolvedFields: [],
    projects: [{
      name: 'Test Project',
      clientName: 'Example Client',
      description: 'A test project.',
      managerId: 'PM01',
      deadline: '2026-11-30',
      tasks: [{
        title: 'Build feature',
        description: 'Implement the agreed feature.',
        assigneeId: 'DEV01',
        deadline: '2026-11-20',
        estimatedHours: 8,
      }],
    }],
  }
}

function captureRoute(db, extract) {
  let handlers
  const app = {
    post(_path, ...routeHandlers) {
      handlers = routeHandlers
    },
  }
  registerCreateProjectRoutes(app, db, (_req, _res, next) => next(), extract)
  return handlers.at(-1)
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

async function invoke(handler, { user, body }) {
  const response = responseRecorder()
  let nextError
  await handler({ user, body }, response, (error) => { nextError = error })
  return { response, nextError }
}

test('rejects non-admin users before extraction', async () => {
  const db = createTestDatabase()
  let called = false
  const handler = captureRoute(db, async () => { called = true })
  const { response } = await invoke(handler, {
    user: { id: 'PM01', role: 'MANAGER' },
    body: { transcript: 'Complete notes' },
  })
  assert.equal(response.statusCode, 403)
  assert.equal(called, false)
  db.close()
})

test('rejects blank and oversized transcripts', async () => {
  const db = createTestDatabase()
  const handler = captureRoute(db, async () => validOutput())
  const blank = await invoke(handler, {
    user: { id: 'ADMIN', role: 'ADMIN' },
    body: { transcript: '   ' },
  })
  const oversized = await invoke(handler, {
    user: { id: 'ADMIN', role: 'ADMIN' },
    body: { transcript: 'x'.repeat(maxTranscriptLength + 1) },
  })
  assert.equal(blank.response.statusCode, 400)
  assert.equal(oversized.response.statusCode, 413)
  db.close()
})

test('prevents overlapping requests from the same admin', async () => {
  const db = createTestDatabase()
  let releaseExtraction
  const extraction = new Promise((resolve) => { releaseExtraction = resolve })
  const handler = captureRoute(db, () => extraction)
  const firstResponse = responseRecorder()
  const firstRequest = handler(
    { user: { id: 'ADMIN', role: 'ADMIN' }, body: { transcript: 'First request' } },
    firstResponse,
    () => {},
  )
  const second = await invoke(handler, {
    user: { id: 'ADMIN', role: 'ADMIN' },
    body: { transcript: 'Second request' },
  })
  assert.equal(second.response.statusCode, 409)
  releaseExtraction(validOutput())
  await firstRequest
  assert.equal(firstResponse.statusCode, 201)
  db.close()
})

test('returns correction details and writes nothing for invalid extraction', async () => {
  const db = createTestDatabase()
  const output = validOutput()
  output.unresolvedFields.push('Project deadline needs confirmation.')
  output.projects[0].tasks[0].deadline = '2026-12-01'
  const handler = captureRoute(db, async () => output)
  const { response } = await invoke(handler, {
    user: { id: 'ADMIN', role: 'ADMIN' },
    body: { transcript: 'Incomplete notes' },
  })
  assert.equal(response.statusCode, 422)
  assert.equal(response.body.error, 'Correction required')
  assert.ok(response.body.details.length >= 2)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count, 0)
  db.close()
})

test('validates roles, real dates, hours, and task deadlines', () => {
  const db = createTestDatabase()
  const directory = getEmployeeDirectory(db)
  const output = validOutput()
  output.projects[0].managerId = 'DEV01'
  output.projects[0].deadline = '2026-02-30'
  output.projects[0].tasks[0].assigneeId = 'PM01'
  output.projects[0].tasks[0].estimatedHours = Number.NaN
  const details = validateExtraction(output, directory)
  assert.ok(details.some((detail) => detail.includes('manager ID')))
  assert.ok(details.some((detail) => detail.includes('valid deadline')))
  assert.ok(details.some((detail) => detail.includes('agent ID')))
  assert.ok(details.some((detail) => detail.includes('positive estimated hours')))
  db.close()
})

test('saves a complete extraction in one transaction', () => {
  const db = createTestDatabase()
  const result = saveExtraction(db, validOutput())
  assert.equal(result.createdProjectCount, 1)
  assert.equal(result.createdTaskCount, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 1)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count, 1)
  db.close()
})

test('rolls back the project when a task insert fails', () => {
  const db = createTestDatabase()
  db.exec(`
    CREATE TRIGGER reject_test_tasks
    BEFORE INSERT ON tasks
    BEGIN
      SELECT RAISE(ABORT, 'test task failure');
    END;
  `)
  assert.throws(() => saveExtraction(db, validOutput()), /test task failure/)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 0)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM tasks').get().count, 0)
  db.close()
})
