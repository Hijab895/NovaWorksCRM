import express from 'express'
import session from 'express-session'
import { sessionSecret } from './config/session.js'
import { registerAuthRoutes, requireAuth } from './api/auth.js'
import { registerCreateProjectRoutes } from './api/createProjectRoutes.js'
import { registerReadRoutes } from './api/readRoutes.js'
import { initializeDatabase } from './db.js'

const app = express()
const port = 3001
const sessionCookieName = 'novaworks.sid'
const sessionCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
}

const db = initializeDatabase()

app.use(express.json())
app.use(
  session({
    name: sessionCookieName,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: sessionCookieOptions,
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

registerAuthRoutes(app, db, sessionCookieName, sessionCookieOptions)
registerCreateProjectRoutes(app, db, requireAuth(db))
registerReadRoutes(app, db, requireAuth(db))

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`NovaWorks CRM API listening on http://localhost:${port}`)
  console.log(`Gemini model: ${process.env.GEMINI_MODEL ?? 'not configured'}`)
})
