import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import iconv from 'iconv-lite'
import { TrafficDevice, TrafficDeviceUpsertPayload } from '@shared/types/domain'
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
  // 1. UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf-8')
  }
  // 2. UTF-16LE BOM (엑셀 유니코드 텍스트 저장 시)
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return iconv.decode(buf.subarray(2), 'utf16-le')
  }
  // 3. UTF-16BE BOM
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return iconv.decode(buf.subarray(2), 'utf16-be')
  }
  // 4. UTF-8 무결성 검사 (깨진 문자 \uFFFD가 없으면 UTF-8, 있으면 윈도우 엑셀 기본 CP949/EUC-KR로 디코딩)
  const utf8Text = buf.toString('utf-8')
  if (!utf8Text.includes('\uFFFD')) {
    return utf8Text
  }
  return iconv.decode(buf, 'cp949')
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * 단속장비 마스터 목록을 윈도우 엑셀 한글 호환용 UTF-8 with BOM(\uFEFF) CSV 문자열로 직렬화한다.
 */
export function buildDevicesCsvContent(devices: TrafficDevice[]): string {
  const header = '설치년도,장비번호,장비명,위치,제조사,유형,단속종류,제한속도,보호구역명'
  const lines = devices.map((d) =>
    [
      d.installYear,
      d.deviceId,
      d.deviceName,
      d.location,
      d.manufacturer,
      d.category,
      d.enforcementType,
      d.speedLimit,
      d.zoneType
    ]
      .map(escapeCsvCell)
      .join(',')
  )
  return `\uFEFF${[header, ...lines].join('\r\n')}\r\n`
}

/**
 * 사용자가 수정/작성한 단속장비 CSV 버퍼의 인코딩(UTF-8/CP949)을 자동 판별하고,
 * 9개 필수 컬럼(설치년도, 장비번호, 장비명, 위치, 제조사, 유형, 단속종류, 제한속도, 보호구역명)의
 * 필드 정합성을 검증한 뒤 DB에 반영한다.
 */
export function validateAndImportDevicesCsvBuffer(
  db: Database.Database,
  buf: Buffer
): { ok: boolean; count: number; errorDetail?: string } {
  const text = decodeCsvBuffer(buf)
  const rows = parseCsvMultiline(text)

  if (rows.length < 2) {
    return {
      ok: false,
      count: 0,
      errorDetail: 'CSV 파일에 헤더(제목 행) 또는 등록할 단속장비 데이터 행이 없습니다.'
    }
  }

  const headerRow = rows[0].map((h) => h.replace(/^\uFEFF/, '').replace(/\s+/g, '').trim())
  const expectedRule: Array<{ idx: number; label: string; aliases: string[] }> = [
    { idx: 0, label: '설치년도', aliases: ['설치년도', '설치연도', '연도', '년도'] },
    { idx: 1, label: '장비번호', aliases: ['장비번호', '단속장비번호', '관리번호'] },
    { idx: 2, label: '장비명', aliases: ['장비명', '단속장비명', '교차로명'] },
    { idx: 3, label: '위치', aliases: ['위치', '설치위치', '주소'] },
    { idx: 4, label: '제조사', aliases: ['제조사', '제작사', '업체명'] },
    { idx: 5, label: '유형', aliases: ['유형', '장비유형', '구분'] },
    { idx: 6, label: '단속종류', aliases: ['단속종류', '단속유형'] },
    { idx: 7, label: '제한속도', aliases: ['제한속도', '제한속도(km)', '속도'] },
    { idx: 8, label: '보호구역명', aliases: ['보호구역명', '보호구역', '구역구분'] }
  ]

  if (headerRow.length !== 9) {
    return {
      ok: false,
      count: 0,
      errorDetail: `필드(열) 개수가 맞지 않습니다. 표준 양식은 9개 열(설치년도, 장비번호, 장비명, 위치, 제조사, 유형, 단속종류, 제한속도, 보호구역명)이어야 하나, 선택한 파일은 ${headerRow.length}개 열로 구성되어 있습니다.`
    }
  }

  for (const rule of expectedRule) {
    const actual = headerRow[rule.idx] || ''
    if (!rule.aliases.includes(actual)) {
      return {
        ok: false,
        count: 0,
        errorDetail: `${rule.idx + 1}번째 열의 필드명이 표준 양식과 다릅니다. (기대 필드명: '${rule.label}', 파일 내 필드명: '${rows[0][rule.idx] || '없음'}')`
      }
    }
  }

  const parsedDevices: TrafficDeviceUpsertPayload[] = []
  for (let rIdx = 1; rIdx < rows.length; rIdx += 1) {
    const cols = rows[rIdx]
    if (cols.every((c) => !c.trim())) continue

    if (cols.length !== 9) {
      return {
        ok: false,
        count: 0,
        errorDetail: `${rIdx + 1}번째 행의 데이터 열 개수가 9개가 아닙니다 (현재 ${cols.length}개 열). 쉼표(,)나 줄바꿈 누락 여부를 확인해 주세요.`
      }
    }

    const installYear = Number(cols[0].replace(/[^0-9]/g, ''))
    const deviceId = cols[1].trim()
    const deviceName = cols[2].trim()
    const location = cols[3].trim()
    const manufacturer = cols[4].trim()
    const category = cols[5].trim() || '고정식'
    const enforcementType = cols[6].trim() || '신호과속'
    const speedLimit = Number(cols[7].replace(/[^0-9]/g, ''))
    const zoneType = cols[8].trim() || '일반구역'

    if (!Number.isFinite(installYear) || installYear < 1990 || installYear > 2100) {
      return {
        ok: false,
        count: 0,
        errorDetail: `${rIdx + 1}번째 행의 '설치년도' 값('${cols[0]}')이 올바른 연도(4자리 숫자)가 아닙니다.`
      }
    }

    if (!deviceId || !deviceName || !location) {
      return {
        ok: false,
        count: 0,
        errorDetail: `${rIdx + 1}번째 행의 필수 항목(장비번호, 장비명, 위치) 중 비어 있는 값이 있습니다.`
      }
    }

    if (!Number.isFinite(speedLimit) || speedLimit <= 0 || speedLimit > 200) {
      return {
        ok: false,
        count: 0,
        errorDetail: `${rIdx + 1}번째 행(${deviceId})의 '제한속도' 값('${cols[7]}')이 유효한 숫자가 아닙니다.`
      }
    }

    parsedDevices.push({
      installYear,
      deviceId,
      deviceName,
      location,
      manufacturer,
      category,
      enforcementType,
      speedLimit,
      zoneType
    })
  }

  if (parsedDevices.length === 0) {
    return {
      ok: false,
      count: 0,
      errorDetail: '가져올 수 있는 유효한 단속장비 데이터가 없습니다.'
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO devices (
      install_year, device_id, device_name, location,
      manufacturer, category, enforcement_type, speed_limit, zone_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const tx = db.transaction(() => {
    for (const d of parsedDevices) {
      insertStmt.run(
        d.installYear,
        d.deviceId,
        d.deviceName,
        d.location,
        d.manufacturer,
        d.category,
        d.enforcementType,
        d.speedLimit,
        d.zoneType
      )
    }
  })
  tx()

  return { ok: true, count: parsedDevices.length }
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
 * 기존 민원 데이터의 문서(접수)번호가 단순 숫자('1', '2'...)이거나 비어 있을 경우
 * 각 민원의 접수일자(received_date)를 기준으로 'JSPD-YYYY-MM-DD-01', '02'... 관공서 문서번호로 일괄 정규화한다.
 */
export function normalizeMinwonDocumentNumbers(db: Database.Database): number {
  const rows = db
    .prepare(
      `SELECT id, received_date, reception_no FROM minwon_records ORDER BY received_date ASC, id ASC`
    )
    .all() as Array<{ id: number; received_date: string; reception_no: string }>

  if (rows.length === 0) return 0

  const dateCounter = new Map<string, number>()
  const updates: Array<{ id: number; receptionNo: string }> = []

  // 이미 JSPD-YYYY-MM-DD-XX 형식으로 부여된 번호가 있다면 해당 날짜의 최대 순번을 먼저 파악
  for (const row of rows) {
    const dateKey = (row.received_date || '').trim()
    if (!dateKey) continue
    const prefix = `JSPD-${dateKey}-`
    const currentNo = (row.reception_no || '').trim()
    if (currentNo.startsWith(prefix)) {
      const tailNum = Number(currentNo.slice(prefix.length))
      if (Number.isFinite(tailNum) && tailNum > (dateCounter.get(dateKey) || 0)) {
        dateCounter.set(dateKey, tailNum)
      }
    }
  }

  for (const row of rows) {
    const dateKey = (row.received_date || '').trim()
    if (!dateKey) continue
    const currentNo = (row.reception_no || '').trim()
    // 비어 있거나 기존 엑셀 연번('1', '2' ... '114') 형태인 경우 JSPD-접수일자-순번으로 변환
    if (!currentNo || /^\d+$/.test(currentNo)) {
      const nextSeq = (dateCounter.get(dateKey) || 0) + 1
      dateCounter.set(dateKey, nextSeq)
      const formattedNo = `JSPD-${dateKey}-${String(nextSeq).padStart(2, '0')}`
      updates.push({ id: row.id, receptionNo: formattedNo })
    }
  }

  if (updates.length > 0) {
    const updateStmt = db.prepare(`UPDATE minwon_records SET reception_no = ? WHERE id = ?`)
    const tx = db.transaction(() => {
      for (const u of updates) {
        updateStmt.run(u.receptionNo, u.id)
      }
    })
    tx()
  }

  return updates.length
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
  normalizeMinwonDocumentNumbers(db)
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
    } else {
      // 이미 적재된 DB의 문서(접수)번호도 접수일자에 맞춘 JSPD-YYYY-MM-DD-01 형식으로 자동 보정
      normalizeMinwonDocumentNumbers(db)
    }
  }
}
