import Database from 'better-sqlite3'
import { AuditLogEntry, CreateUserPayload, UserAccount, UserRole } from '@shared/types/domain'
import { hashPassword, verifyPassword } from '../auth/auth-service'

interface UserRow {
  id: number
  username: string
  password_hash: string
  display_name: string
  department: string
  role: UserRole
  active: number
  last_login_at: string | null
  created_at: string
}

function mapUserRow(row: UserRow): UserAccount {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    department: row.department,
    role: row.role,
    active: row.active === 1,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at
  }
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  listUsers(): UserAccount[] {
    const rows = this.db
      .prepare('SELECT * FROM users ORDER BY id ASC')
      .all() as UserRow[]
    return rows.map(mapUserRow)
  }

  getUserByUsername(username: string): UserAccount | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username.trim()) as UserRow | undefined
    return row ? mapUserRow(row) : null
  }

  authenticate(username: string, password?: string): UserAccount | null {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ? AND active = 1')
      .get(username.trim()) as UserRow | undefined

    if (!row || !password) return null
    if (!verifyPassword(password, row.password_hash)) return null

    const nowIso = new Date().toISOString()
    this.db
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .run(nowIso, row.id)

    return mapUserRow({ ...row, last_login_at: nowIso })
  }

  upsertUser(payload: CreateUserPayload): UserAccount {
    const cleanUsername = payload.username.trim()
    const existing = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(cleanUsername) as UserRow | undefined

    if (!existing) {
      const nowIso = new Date().toISOString()
      const pwHash = hashPassword(payload.password || '1234')
      this.db
        .prepare(`
          INSERT INTO users (username, password_hash, display_name, department, role, active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          cleanUsername,
          pwHash,
          payload.displayName.trim() || cleanUsername,
          payload.department.trim() || '교통단속장비운영팀',
          payload.role,
          payload.active === false ? 0 : 1,
          nowIso
        )
    } else {
      const pwHash = payload.password && payload.password.trim()
        ? hashPassword(payload.password.trim())
        : existing.password_hash

      this.db
        .prepare(`
          UPDATE users
          SET password_hash = ?, display_name = ?, department = ?, role = ?, active = ?
          WHERE username = ?
        `)
        .run(
          pwHash,
          payload.displayName.trim() || existing.display_name,
          payload.department.trim() || existing.department,
          payload.role,
          payload.active === false ? 0 : 1,
          cleanUsername
        )
    }

    return this.getUserByUsername(cleanUsername)!
  }

  changePassword(username: string, oldPassword: string, newPassword: string): boolean {
    const row = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(username.trim()) as UserRow | undefined
    if (!row) return false
    if (!verifyPassword(oldPassword, row.password_hash)) return false

    this.db
      .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(hashPassword(newPassword), row.id)
    return true
  }

  deleteUser(username: string): boolean {
    if (username.trim() === 'admin') return false
    const info = this.db
      .prepare('DELETE FROM users WHERE username = ?')
      .run(username.trim())
    return info.changes > 0
  }

  recordAudit(params: {
    username: string
    action: string
    targetType: string
    targetId?: string
    detail?: string
    clientIp?: string
  }): void {
    this.db
      .prepare(`
        INSERT INTO audit_logs (timestamp, username, action, target_type, target_id, detail, client_ip)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        new Date().toISOString(),
        params.username || 'system',
        params.action,
        params.targetType,
        params.targetId || '',
        params.detail || '',
        params.clientIp || '127.0.0.1'
      )
  }

  listRecentAuditLogs(limit = 100): AuditLogEntry[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?')
      .all(limit) as Array<{
      id: number
      timestamp: string
      username: string
      action: string
      target_type: string
      target_id: string
      detail: string
      client_ip: string
    }>

    return rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp,
      username: r.username,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      detail: r.detail,
      clientIp: r.client_ip
    }))
  }
}
