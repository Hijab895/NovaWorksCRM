import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const envPath = resolve(serverRoot, '.env')

function ensureSessionSecret() {
  if (!existsSync(envPath)) {
    writeFileSync(envPath, `SESSION_SECRET=${randomBytes(48).toString('hex')}\n`)
    return
  }

  const envContent = readFileSync(envPath, 'utf8')

  if (!/^SESSION_SECRET=/m.test(envContent)) {
    const separator = envContent.endsWith('\n') || envContent.length === 0 ? '' : '\n'
    appendFileSync(
      envPath,
      `${separator}SESSION_SECRET=${randomBytes(48).toString('hex')}\n`,
    )
  }
}

ensureSessionSecret()
dotenv.config({ path: envPath, quiet: true })

export const sessionSecret = process.env.SESSION_SECRET
