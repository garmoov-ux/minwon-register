import crypto from 'crypto'
import { AuthSession, UserAccount } from '@shared/types/domain'

const TOKEN_SECRET =
  process.env.MINWON_AUTH_SECRET || 'inno-minwon-register-secret-key-2026'

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':')
  if (parts.length !== 2) return false
  const [salt, keyHex] = parts
  const derived = crypto.scryptSync(password, salt, 64)
  const keyBuf = Buffer.from(keyHex, 'hex')
  if (derived.length !== keyBuf.length) return false
  return crypto.timingSafeEqual(derived, keyBuf)
}

export interface TokenPayload {
  userId: number
  username: string
  displayName: string
  jobTitle: string
  email: string
  contact: string
  role: UserAccount['role']
  canToggleServer: boolean
  exp: number
}

export function issueAuthSession(user: UserAccount, ttlHours = 24): AuthSession {
  const expiresAtDate = new Date(Date.now() + ttlHours * 3600 * 1000)
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    jobTitle: user.jobTitle,
    email: user.email,
    contact: user.contact,
    role: user.role,
    canToggleServer: user.canToggleServer,
    exp: expiresAtDate.getTime()
  }

  const base64Payload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url')

  return {
    token: `${base64Payload}.${signature}`,
    user,
    expiresAt: expiresAtDate.toISOString()
  }
}

export function verifyAuthToken(token?: string | null): TokenPayload | null {
  if (!token) return null
  const clean = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim()
  const parts = clean.split('.')
  if (parts.length !== 2) return null

  const [base64Payload, signature] = parts
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url')

  if (signature !== expectedSig) return null

  try {
    const parsed = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf-8')
    ) as TokenPayload
    if (!parsed.exp || Date.now() > parsed.exp) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
