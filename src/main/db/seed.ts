import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import iconv from 'iconv-lite'
import { hashPassword } from '../auth/auth-service'

const DEFAULT_CODES: Array<{ category: string; values: string[] }> = [
  {
    category: '접수구분',
    values: ['국민신문고', '전화민원', '공문접수', '방문민원', '경찰청이첩', '지자체이첩', '기타']
  },
  {
    category: '구역구분',
    values: ['일반구역', '어린이보호구역', '노인보호구역', '장애인보호구역']
  },
  {
    category: '검토결과',
    values: ['검토중', '신규설치', '이설검토', '기존운영', '설치불가', '지자체이관', '수리완료', '기타']
  }
]

export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export function decodeCsvBuffer(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf-8')
  }
  const utf8Text = buf.toString('utf-8')
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text
  }
  return iconv.decode(buf, 'cp949')
}

export function loadDevicesFromCsv(db: Database.Database, csvPath: string): number {
  if (!fs.existsSync(csvPath)) return 0
  const buf = fs.readFileSync(csvPath)
  const text = decodeCsvBuffer(buf)
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length <= 1) return 0

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO devices (
      install_year, device_id, device_name, location,
      manufacturer, category, enforcement_type, speed_limit, zone_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  let inserted = 0
  const tx = db.transaction(() => {
    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i])
      if (cols.length < 9) continue
      const installYear = Number(cols[0]) || 2024
      const deviceId = cols[1]
      if (!deviceId) continue
      const deviceName = cols[2] || deviceId
      const location = cols[3] || ''
      const manufacturer = cols[4] || ''
      const category = cols[5] || '고정식'
      const enforcementType = cols[6] || '신호과속'
      const speedLimit = Number(cols[7]) || 50
      const zoneType = cols[8] || '일반구역'

      insertStmt.run(
        installYear,
        deviceId,
        deviceName,
        location,
        manufacturer,
        category,
        enforcementType,
        speedLimit,
        zoneType
      )
      inserted += 1
    }
  })

  tx()
  return inserted
}

export function seedInitialDatabase(db: Database.Database, customCsvPath?: string): void {
  const nowIso = new Date().toISOString()

  // 1. 기본 사용자 계정 시드 (admin / operator)
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, department, role, active, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `)
    insertUser.run(
      'admin',
      hashPassword('admin1234'),
      '시스템 관리자',
      '무인교통단속장비 관제센터',
      'ADMIN',
      nowIso
    )
    insertUser.run(
      'operator',
      hashPassword('oper1234'),
      '민원접수 담당자',
      '교통단속장비운영팀',
      'OPERATOR',
      nowIso
    )
    insertUser.run(
      'viewer',
      hashPassword('view1234'),
      '현황 열람자',
      '유관기관 열람용',
      'VIEWER',
      nowIso
    )
  }

  // 2. 기본 코드 항목 시드 (접수구분, 구역구분, 검토결과)
  const codeCount = (db.prepare('SELECT COUNT(*) as cnt FROM code_items').get() as { cnt: number }).cnt
  if (codeCount === 0) {
    const insertCode = db.prepare(`
      INSERT OR IGNORE INTO code_items (category, value, sort_order)
      VALUES (?, ?, ?)
    `)
    const tx = db.transaction(() => {
      for (const group of DEFAULT_CODES) {
        group.values.forEach((val, idx) => {
          insertCode.run(group.category, val, idx + 1)
        })
      }
    })
    tx()
  }

  // 3. 단속장비 마스터(device.csv, 487대) 자동 시드
  const deviceCount = (db.prepare('SELECT COUNT(*) as cnt FROM devices').get() as { cnt: number }).cnt
  if (deviceCount === 0) {
    const candidates = [
      customCsvPath,
      path.resolve(process.cwd(), '_ref_VBA', 'device.csv'),
      path.resolve(process.cwd(), 'resources', 'device.csv')
    ].filter((p): p is string => Boolean(p))

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        loadDevicesFromCsv(db, candidate)
        break
      }
    }
  }
}
