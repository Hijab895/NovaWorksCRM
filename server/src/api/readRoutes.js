import { toSafeUser } from './users.js'

function toProject(row) {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    description: row.description,
    managerId: row.manager_id,
    managerName: row.manager_name,
    deadline: row.deadline,
    taskCount: row.task_count,
  }
}

function toTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    deadline: row.deadline,
    estimatedHours: row.estimated_hours,
  }
}

function projectAccessSql(user) {
  if (user.role === 'ADMIN') {
    return {
      where: '1 = 1',
      params: [],
      taskCount: 'COUNT(t.id)',
    }
  }

  if (user.role === 'MANAGER') {
    return {
      where: 'p.manager_id = ?',
      params: [user.id],
      taskCount: 'COUNT(t.id)',
    }
  }

  return {
    where: 'EXISTS (SELECT 1 FROM tasks at WHERE at.project_id = p.id AND at.assignee_id = ?)',
    params: [user.id],
    taskCount: 'COUNT(CASE WHEN t.assignee_id = ? THEN 1 END)',
    taskCountParams: [user.id],
  }
}

function taskAccessSql(user) {
  if (user.role === 'ADMIN') {
    return {
      where: '1 = 1',
      params: [],
    }
  }

  if (user.role === 'MANAGER') {
    return {
      where: 'p.manager_id = ?',
      params: [user.id],
    }
  }

  return {
    where: 't.assignee_id = ?',
    params: [user.id],
  }
}

export function registerReadRoutes(app, db, requireAuth) {
  app.get('/api/team', requireAuth, (req, res) => {
    const users = db
      .prepare(
        `
          SELECT id, name, email, role, specialization, skills_json
          FROM users
          ORDER BY role, name
        `,
      )
      .all()
      .map(toSafeUser)

    res.json({ users })
  })

  app.get('/api/projects', requireAuth, (req, res) => {
    const access = projectAccessSql(req.user)
    const projects = db
      .prepare(
        `
          SELECT
            p.id,
            p.name,
            p.client_name,
            p.description,
            p.manager_id,
            m.name AS manager_name,
            p.deadline,
            ${access.taskCount} AS task_count
          FROM projects p
          LEFT JOIN users m ON m.id = p.manager_id
          LEFT JOIN tasks t ON t.project_id = p.id
          WHERE ${access.where}
          GROUP BY
            p.id,
            p.name,
            p.client_name,
            p.description,
            p.manager_id,
            m.name,
            p.deadline
          ORDER BY p.deadline, p.name
        `,
      )
      .all(...(access.taskCountParams ?? []), ...access.params)
      .map(toProject)

    res.json({ projects })
  })

  app.get('/api/projects/:id', requireAuth, (req, res) => {
    const access = projectAccessSql(req.user)
    const project = db
      .prepare(
        `
          SELECT
            p.id,
            p.name,
            p.client_name,
            p.description,
            p.manager_id,
            m.name AS manager_name,
            p.deadline,
            ${access.taskCount} AS task_count
          FROM projects p
          LEFT JOIN users m ON m.id = p.manager_id
          LEFT JOIN tasks t ON t.project_id = p.id
          WHERE p.id = ? AND ${access.where}
          GROUP BY
            p.id,
            p.name,
            p.client_name,
            p.description,
            p.manager_id,
            m.name,
            p.deadline
        `,
      )
      .get(...(access.taskCountParams ?? []), req.params.id, ...access.params)

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const taskAccess = taskAccessSql(req.user)
    const tasks = db
      .prepare(
        `
          SELECT
            t.id,
            t.project_id,
            p.name AS project_name,
            t.title,
            t.description,
            t.assignee_id,
            a.name AS assignee_name,
            t.deadline,
            t.estimated_hours
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          LEFT JOIN users a ON a.id = t.assignee_id
          WHERE t.project_id = ? AND ${taskAccess.where}
          ORDER BY t.deadline, t.title
        `,
      )
      .all(req.params.id, ...taskAccess.params)
      .map(toTask)

    res.json({ project: toProject(project), tasks })
  })

  app.get('/api/tasks', requireAuth, (req, res) => {
    const access = taskAccessSql(req.user)
    const tasks = db
      .prepare(
        `
          SELECT
            t.id,
            t.project_id,
            p.name AS project_name,
            t.title,
            t.description,
            t.assignee_id,
            a.name AS assignee_name,
            t.deadline,
            t.estimated_hours
          FROM tasks t
          JOIN projects p ON p.id = t.project_id
          LEFT JOIN users a ON a.id = t.assignee_id
          WHERE ${access.where}
          ORDER BY t.deadline, p.name, t.title
        `,
      )
      .all(...access.params)
      .map(toTask)

    res.json({ tasks })
  })
}
