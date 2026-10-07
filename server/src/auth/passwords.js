import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)
const keyLength = 64
const scryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = await scryptAsync(password, salt, keyLength, scryptOptions)

  return `scrypt:${scryptOptions.N}:${scryptOptions.r}:${scryptOptions.p}:${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password, passwordHash) {
  const [algorithm, n, r, p, salt, storedKey] = passwordHash.split(':')

  if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !storedKey) {
    return false
  }

  const storedBuffer = Buffer.from(storedKey, 'hex')
  const derivedKey = await scryptAsync(password, salt, storedBuffer.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  })

  return (
    storedBuffer.length === derivedKey.length &&
    timingSafeEqual(storedBuffer, derivedKey)
  )
}
