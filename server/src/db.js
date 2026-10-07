import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const databasePath = resolve(
  serverRoot,
  'data',
  'novaworks.sqlite',
)

export function openDatabase() {
  mkdirSync(dirname(databasePath), { recursive: true })

  const db = new DatabaseSync(databasePath)
  db.exec('PRAGMA foreign_keys = ON')

  return db
}

export function initializeDatabase(db = openDatabase()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MANAGER', 'AGENT')),
      specialization TEXT NOT NULL,
      skills_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT NOT NULL,
      description TEXT,
      manager_id TEXT REFERENCES users(id),
      deadline TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      assignee_id TEXT REFERENCES users(id),
      deadline TEXT,
      estimated_hours REAL CHECK (estimated_hours > 0)
    );
  `)

  return db
}
