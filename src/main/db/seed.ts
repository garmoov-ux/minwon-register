import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import iconv from 'iconv-lite'
import { hashPassword } from '../auth/auth-service'

const DEFAULT_CODES: Array<{ category: string; values: string[] }> = [
  {
    category: '접수구분',
    values: ['국민신문고', '전화민원', '공문', '방문민원', '도지사에바란다', '자치도에 바란다', '기타']
  },
  {
    category: '구역구분',
    values: ['일반구역', '어린이보호구역', '노인보호구역', '장애인보호구역']
  },
  {
    category: '검토결과',
    values: ['대기중', '적합', '조건부 적합', '부적합', '불합리', '검토완료', '검토불필요', '설치불가']
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

/**
 * 멀티라인 따옴표("...\n...")를 포함한 전체 CSV 텍스트를 행/열 2차원 배열로 파싱한다.
 */
export function parseCsvMultiline(csvText: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i]
    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        currentCell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && csvText[i + 1] === '\n') {
        i += 1
      }
      currentRow.push(currentCell.trim())
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentCell = ''
    } else {
      currentCell += ch
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

/**
 * Excel 일련번호 날짜(예: 46027 -> 2026-01-05)를 YYYY-MM-DD 문자열로 변환한다.
 */
export function convertExcelSerialToIsoDate(val: string): string {
  const trimmed = (val || '').trim()
  if (!trimmed) return ''
  if (/^\d{5}$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (serial >= 30000 && serial <= 65000) {
      // Excel 기준일 1899-12-30 UTC
      const utcMs = Date.UTC(1899, 11, 30) + serial * 86400 * 1000
      const d = new Date(utcMs)
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }
  return trimmed
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

/**
 * 기존에 사용하던 민원접수대장 CSV(datadb.csv, 114건)를 읽어 minwon_records에 적재한다.
 */
export function loadMinwonFromCsv(db: Database.Database, csvPath: string): number {
  if (!fs.existsSync(csvPath)) return 0
  const buf = fs.readFileSync(csvPath)
  const text = decodeCsvBuffer(buf)
  const rows = parseCsvMultiline(text)
  if (rows.length <= 1) return 0

  const nowIso = new Date().toISOString()
  const deleteAllMinwon = db.prepare('DELETE FROM minwon_records')
  const insertMinwon = db.prepare(`
    INSERT INTO minwon_records (
      id, received_date, reception_type, reception_no,
      complainant_name, contact, location, zone_type,
      content, review_date, review_result, improvement_result,
      note, device_id, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'admin', 'admin', ?, ?)
  `)

  const insertCode = db.prepare(`
    INSERT OR IGNORE INTO code_items (category, value, sort_order)
    VALUES (?, ?, 99)
  `)

  let inserted = 0
  const tx = db.transaction(() => {
    deleteAllMinwon.run()
    for (let i = 1; i < rows.length; i += 1) {
      const r = rows[i]
      if (r.length < 11) continue
      // datadb.csv 내부 중복 연번(예: 90번 중복)으로 인해 레코드가 유실되지 않도록 순차 연번(1 ~ 114) 부여
      const id = i
      const receivedDate = convertExcelSerialToIsoDate(r[1])
      const receptionType = (r[2] || '').trim()
      const receptionNo = (r[3] || '').trim()
      const complainantName = (r[4] || '').trim()
      const contact = (r[5] || '').trim()
      const location = (r[6] || '').replace(/\r?\n/g, ' ').trim()
      const zoneType = (r[7] || '일반구역').trim()
      const content = (r[8] || '').replace(/\r?\n/g, ' ').trim()
      const reviewDate = convertExcelSerialToIsoDate(r[9] || '')
      const reviewResult = (r[10] || '대기중').trim()
      const improvementResult = (r[11] || '').replace(/\r?\n/g, ' ').trim()
      const note = (r[12] || '').replace(/\r?\n/g, ' ').trim()

      insertMinwon.run(
        id,
        receivedDate,
        receptionType,
        receptionNo,
        complainantName,
        contact,
        location,
        zoneType,
        content,
        reviewDate,
        reviewResult,
        improvementResult,
        note,
        nowIso,
        nowIso
      )

      if (receptionType) insertCode.run('접수구분', receptionType)
      if (zoneType) insertCode.run('구역구분', zoneType)
      if (reviewResult) insertCode.run('검토결과', reviewResult)

      inserted += 1
    }
  })

  tx()
  return inserted
}

export function seedInitialDatabase(
  db: Database.Database,
  options?: { customDeviceCsvPath?: string; customMinwonCsvPath?: string; seedMinwon?: boolean }
): void {
  const nowIso = new Date().toISOString()

  // 1. 기본 사용자 계정 시드: 최고관리자(admin), 지정 관리자 1명(manager), 일반 사용자(user1)
  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt
  if (userCount === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (
        username, password_hash, display_name, job_title, email, contact,
        role, can_toggle_server, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `)
    // 최고관리자 (admin)
    insertUser.run(
      'admin',
      hashPassword('admin1234'),
      '강홍선',
      '최고관리자',
      's_gain@naver.com',
      '010-0000-0000',
      'SUPER_ADMIN',
      1,
      nowIso
    )
    // 서버 구동 권한이 지정된 관리자 1명 (manager)
    insertUser.run(
      'manager',
      hashPassword('manager1234'),
      '김자치',
      '교통시설관리 팀장',
      'manager@jeju.go.kr',
      '064-710-0001',
      'ADMIN',
      1,
      nowIso
    )
    // 일반 사용자 (user1)
    insertUser.run(
      'user1',
      hashPassword('user1234'),
      '이민원',
      '민원접수 주무관',
      'minwon@jeju.go.kr',
      '064-710-0002',
      'USER',
      0,
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
      options?.customDeviceCsvPath,
      path.resolve(process.cwd(), 'resources', 'device.csv'),
      path.resolve(process.cwd(), '_ref_VBA', 'device.csv')
    ].filter((p): p is string => Boolean(p))

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        loadDevicesFromCsv(db, candidate)
        break
      }
    }
  }

  // 4. 기존 민원접수대장 데이터(datadb.csv, 114건) 자동 시드
  if (options?.seedMinwon !== false) {
    const minwonCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM minwon_records').get() as { cnt: number }
    ).cnt
    if (minwonCount === 0) {
      const candidates = [
        options?.customMinwonCsvPath,
        path.resolve(process.cwd(), 'resources', 'datadb.csv'),
        path.resolve(process.cwd(), '_ref_VBA', 'datadb.csv')
      ].filter((p): p is string => Boolean(p))

      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          loadMinwonFromCsv(db, candidate)
          break
        }
      }
    }
  }
}
