import Database from 'better-sqlite3'
import { AuditLogEntry, CreateUserPayload, UserAccount, UserRole } from '@shared/types/domain'
import { hashPassword, verifyPassword } from '../auth/auth-service'

interface UserRow {
  id: number
  username: string
  password_hash: string
  display_name: string
  job_title: string
  email: string
  contact: string
  role: UserRole
  can_toggle_server: number
  active: number
  last_login_at: string | null
  created_at: string
}

function normalizeRole(rawRole: string): UserRole {
  if (rawRole === 'SUPER_ADMIN') return 'SUPER_ADMIN'
  if (rawRole === 'ADMIN') return 'ADMIN'
  return 'USER'
}

function mapUserRow(row: UserRow): UserAccount {
  const role = normalizeRole(row.role)
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    jobTitle: row.job_title || '담당관',
    email: row.email || '',
    contact: row.contact || '',
    role,
    canToggleServer: role === 'SUPER_ADMIN' || row.can_toggle_server === 1,
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

  /**
   * admin(최고관리자) 외에 서버 기능을 켤 수 있는 지정 관리자 1명을 단독으로 설정한다.
   */
  designateServerAdmin(targetUsername: string): UserAccount | null {
    const cleanTarget = targetUsername.trim()
    const target = this.getUserByUsername(cleanTarget)
    if (!target) return null

    const tx = this.db.transaction(() => {
      // admin(SUPER_ADMIN)을 제외한 모든 사용자의 서버 제어 권한을 먼저 해제하고 일반 ADMIN은 1명만 서버 제어 권한 부여
      this.db
        .prepare("UPDATE users SET can_toggle_server = 0 WHERE role != 'SUPER_ADMIN'")
        .run()

      // 기존 지정 관리자가 ADMIN이었다면 필요 시 role은 유지하되 target을 ADMIN + can_toggle_server = 1로 승격
      this.db
        .prepare(
          "UPDATE users SET role = CASE WHEN role = 'SUPER_ADMIN' THEN 'SUPER_ADMIN' ELSE 'ADMIN' END, can_toggle_server = 1 WHERE username = ?"
        )
        .run(cleanTarget)
    })
    tx()
    return this.getUserByUsername(cleanTarget)
  }

  upsertUser(payload: CreateUserPayload): UserAccount {
    const cleanUsername = payload.username.trim()
    const existing = this.db
      .prepare('SELECT * FROM users WHERE username = ?')
      .get(cleanUsername) as UserRow | undefined

    const role: UserRole =
      cleanUsername === 'admin' ? 'SUPER_ADMIN' : normalizeRole(payload.role)

    // 만약 이 계정을 서버 지정 관리자로 체크하거나 role이 ADMIN으로 지정되면 admin 외 1명 규칙 적용
    const wantServerAdmin =
      role === 'SUPER_ADMIN' || payload.canToggleServer === true || role === 'ADMIN'

    const tx = this.db.transaction(() => {
      if (wantServerAdmin && cleanUsername !== 'admin') {
        // admin 외에 서버를 켤 수 있는 관리자는 1명만 유지
        this.db
          .prepare("UPDATE users SET can_toggle_server = 0 WHERE username != 'admin'")
          .run()
      }

      const canToggleInt = wantServerAdmin ? 1 : 0

      if (!existing) {
        const nowIso = new Date().toISOString()
        const pwHash = hashPassword(payload.password || '1234')
        this.db
          .prepare(`
            INSERT INTO users (
              username, password_hash, display_name, job_title, email, contact,
              role, can_toggle_server, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            cleanUsername,
            pwHash,
            payload.displayName.trim() || cleanUsername,
            (payload.jobTitle || '주무관').trim(),
            (payload.email || '').trim(),
            (payload.contact || '').trim(),
            role,
            canToggleInt,
            payload.active === false ? 0 : 1,
            nowIso
          )
      } else {
        const pwHash =
          payload.password && payload.password.trim()
            ? hashPassword(payload.password.trim())
            : existing.password_hash

        this.db
          .prepare(`
            UPDATE users
            SET password_hash = ?,
                display_name = ?,
                job_title = ?,
                email = ?,
                contact = ?,
                role = ?,
                can_toggle_server = ?,
                active = ?
            WHERE username = ?
          `)
          .run(
            pwHash,
            payload.displayName.trim() || existing.display_name,
            (payload.jobTitle || existing.job_title || '주무관').trim(),
            (payload.email ?? existing.email ?? '').trim(),
            (payload.contact ?? existing.contact ?? '').trim(),
            role,
            canToggleInt,
            payload.active === false ? 0 : 1,
            cleanUsername
          )
      }
    })

    tx()
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
        params.username || '시스템',
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
