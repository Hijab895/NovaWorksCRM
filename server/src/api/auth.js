import { verifyPassword } from '../auth/passwords.js'
import { toSafeUser } from './users.js'

const invalidCredentials = { error: 'Invalid email or password' }

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

export function getUserById(db, id) {
  return db
    .prepare(
      `
        SELECT id, name, email, role, specialization, skills_json
        FROM users
        WHERE id = ?
      `,
    )
    .get(id)
}

export function requireAuth(db) {
  return (req, res, next) => {
    const userId = req.session?.userId

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    const user = getUserById(db, userId)

    if (!user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    req.user = user
    next()
  }
}

export function registerAuthRoutes(app, db, sessionCookieName, sessionCookieOptions) {
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const email = String(req.body?.email ?? '').trim().toLowerCase()
      const password = String(req.body?.password ?? '')

      if (!email || !password) {
        res.status(401).json(invalidCredentials)
        return
      }

      const user = db
        .prepare(
          `
            SELECT id, name, email, password_hash, role, specialization, skills_json
            FROM users
            WHERE email = ?
          `,
        )
        .get(email)

      if (!user || !(await verifyPassword(password, user.password_hash))) {
        res.status(401).json(invalidCredentials)
        return
      }

      await regenerateSession(req)
      req.session.userId = user.id

      res.json({ user: toSafeUser(user) })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/auth/me', requireAuth(db), (req, res) => {
    res.json({ user: toSafeUser(req.user) })
  })

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      if (req.session) {
        await destroySession(req)
      }

      res.clearCookie(sessionCookieName, sessionCookieOptions)
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  })
}
