import { initializeDatabase, openDatabase } from './db.js'
import { hashPassword } from './auth/passwords.js'

const demoPassword = 'Demo123!'

const demoUsers = [
  {
    id: 'ADMIN',
    name: 'Admin',
    email: 'admin@novaworks.example',
    role: 'ADMIN',
    specialization: 'Administrator',
    skills: ['Administration', 'operations', 'access control'],
  },
  {
    id: 'PM01',
    name: 'Ayesha Khan',
    email: 'ayesha@novaworks.example',
    role: 'MANAGER',
    specialization: 'Web PM',
    skills: ['Web delivery', 'React planning', 'frontend coordination'],
  },
  {
    id: 'PM02',
    name: 'Bilal Ahmed',
    email: 'bilal@novaworks.example',
    role: 'MANAGER',
    specialization: 'Mobile PM',
    skills: ['Mobile delivery', 'Flutter planning', 'release coordination'],
  },
  {
    id: 'PM03',
    name: 'Hina Malik',
    email: 'hina@novaworks.example',
    role: 'MANAGER',
    specialization: 'AI PM',
    skills: ['AI delivery', 'LLM workflows', 'document automation planning'],
  },
  {
    id: 'DEV01',
    name: 'Ali Raza',
    email: 'ali@novaworks.example',
    role: 'AGENT',
    specialization: 'Full-Stack',
    skills: ['React', 'frontend integration'],
  },
  {
    id: 'DEV02',
    name: 'Hamza Shah',
    email: 'hamza@novaworks.example',
    role: 'AGENT',
    specialization: 'Full-Stack',
    skills: ['Node.js', 'databases', 'APIs'],
  },
  {
    id: 'DEV03',
    name: 'Sara Noor',
    email: 'sara@novaworks.example',
    role: 'AGENT',
    specialization: 'App Developer',
    skills: ['Flutter', 'mobile UI'],
  },
  {
    id: 'DEV04',
    name: 'Usman Tariq',
    email: 'usman@novaworks.example',
    role: 'AGENT',
    specialization: 'App Developer',
    skills: ['Flutter', 'integration', 'testing'],
  },
  {
    id: 'DEV05',
    name: 'Zain Abbas',
    email: 'zain@novaworks.example',
    role: 'AGENT',
    specialization: 'AI Developer',
    skills: ['LLMs', 'extraction', 'prompts'],
  },
  {
    id: 'DEV06',
    name: 'Maryam Asif',
    email: 'maryam@novaworks.example',
    role: 'AGENT',
    specialization: 'AI Developer',
    skills: ['Retrieval', 'document processing'],
  },
]

const db = initializeDatabase(openDatabase())

try {
  const findUser = db.prepare('SELECT id FROM users WHERE id = ?')
  const insertUser = db.prepare(`
    INSERT INTO users (
      id,
      name,
      email,
      password_hash,
      role,
      specialization,
      skills_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  db.exec('BEGIN')

  try {
    for (const user of demoUsers) {
      if (findUser.get(user.id)) {
        continue
      }

      insertUser.run(
        user.id,
        user.name,
        user.email,
        await hashPassword(demoPassword),
        user.role,
        user.specialization,
        JSON.stringify(user.skills),
      )
    }

    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get()
  console.log(`Seed complete. Users in database: ${userCount.count}`)
} finally {
  db.close()
}
