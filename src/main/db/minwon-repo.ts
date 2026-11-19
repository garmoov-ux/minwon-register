import Database from 'better-sqlite3'
import {
  MinwonFilterQuery,
  MinwonRecord,
  MinwonSummaryStats,
  MinwonUpsertPayload
} from '@shared/types/domain'
import { CodeRepository } from './code-repo'

interface MinwonRow {
  id: number
  received_date: string
  reception_type: string
  reception_no: string
  complainant_name: string
  contact: string
  location: string
  zone_type: string
  content: string
  review_date: string
  review_result: string
  improvement_result: string
  note: string
  device_id: string
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
}

function mapMinwonRow(r: MinwonRow): MinwonRecord {
  return {
    id: r.id,
    receivedDate: r.received_date,
    receptionType: r.reception_type,
    receptionNo: r.reception_no,
    complainantName: r.complainant_name,
    contact: r.contact,
    location: r.location,
    zoneType: r.zone_type,
    content: r.content,
    reviewDate: r.review_date,
    reviewResult: r.review_result,
    improvementResult: r.improvement_result,
    note: r.note,
    deviceId: r.device_id,
    createdBy: r.created_by,
    updatedBy: r.updated_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }
}

export class MinwonRepository {
  private readonly codeRepo: CodeRepository

  constructor(private readonly db: Database.Database) {
    this.codeRepo = new CodeRepository(db)
  }

  getNextId(): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM minwon_records')
      .get() as { nextId: number }
    return row.nextId
  }

  getById(id: number): MinwonRecord | null {
    const row = this.db
      .prepare('SELECT * FROM minwon_records WHERE id = ?')
      .get(id) as MinwonRow | undefined
    return row ? mapMinwonRow(row) : null
  }

  listRecords(query?: MinwonFilterQuery): MinwonRecord[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (query) {
      if (query.reviewResult && query.reviewResult !== '-- 전체 --' && query.reviewResult !== '전체') {
        conditions.push('review_result = ?')
        params.push(query.reviewResult.trim())
      }

      if (query.zoneType && query.zoneType !== '-- 전체 --' && query.zoneType !== '전체') {
        conditions.push('zone_type = ?')
        params.push(query.zoneType.trim())
      }

      if (query.receivedStartDate && query.receivedEndDate) {
        conditions.push('received_date >= ? AND received_date <= ?')
        params.push(query.receivedStartDate.trim(), query.receivedEndDate.trim())
      } else if (query.receivedStartDate) {
        conditions.push('received_date >= ?')
        params.push(query.receivedStartDate.trim())
      } else if (query.receivedEndDate) {
        conditions.push('received_date <= ?')
        params.push(query.receivedEndDate.trim())
      }

      if (query.reviewStartDate && query.reviewEndDate) {
        conditions.push("review_date != '' AND review_date >= ? AND review_date <= ?")
        params.push(query.reviewStartDate.trim(), query.reviewEndDate.trim())
      } else if (query.reviewStartDate) {
        conditions.push("review_date != '' AND review_date >= ?")
        params.push(query.reviewStartDate.trim())
      } else if (query.reviewEndDate) {
        conditions.push("review_date != '' AND review_date <= ?")
        params.push(query.reviewEndDate.trim())
      }

      const kw = (query.keyword || '').trim()
      if (kw) {
        const likeVal = `%${kw}%`
        const div = query.division || '전체'
        const fieldMap: Record<string, string> = {
          접수구분: 'reception_type',
          접수번호: 'reception_no',
          이름: 'complainant_name',
          연락처: 'contact',
          위치: 'location',
          구역구분: 'zone_type',
          민원내용: 'content',
          개선결과: 'improvement_result',
          비고: 'note'
        }

        if (div !== '전체' && fieldMap[div]) {
          conditions.push(`${fieldMap[div]} LIKE ?`)
          params.push(likeVal)
        } else {
          conditions.push(
            `(reception_type LIKE ? OR reception_no LIKE ? OR complainant_name LIKE ? OR contact LIKE ? OR location LIKE ? OR zone_type LIKE ? OR content LIKE ? OR improvement_result LIKE ? OR note LIKE ? OR device_id LIKE ?)`
          )
          params.push(
            likeVal,
            likeVal,
            likeVal,
            likeVal,
            likeVal,
            likeVal,
            likeVal,
            likeVal,
            likeVal,
            likeVal
          )
        }
      }
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const sql = `SELECT * FROM minwon_records ${whereSql} ORDER BY id DESC`
    const rows = this.db.prepare(sql).all(...params) as MinwonRow[]
    return rows.map(mapMinwonRow)
  }

  upsertRecord(payload: MinwonUpsertPayload, actorUsername = 'admin'): MinwonRecord {
    const nowIso = new Date().toISOString()

    // VBA AddListboxItem 완벽 호환: 새로운 접수구분/구역구분/검토결과가 입력되면 코드 목록에 자동 추가
    if (payload.receptionType?.trim()) {
      this.codeRepo.ensureCodeItem('접수구분', payload.receptionType.trim())
    }
    if (payload.zoneType?.trim()) {
      this.codeRepo.ensureCodeItem('구역구분', payload.zoneType.trim())
    }
    if (payload.reviewResult?.trim()) {
      this.codeRepo.ensureCodeItem('검토결과', payload.reviewResult.trim())
    }

    const existing = payload.id ? this.getById(payload.id) : null

    if (existing) {
      this.db
        .prepare(`
          UPDATE minwon_records
          SET received_date = ?,
              reception_type = ?,
              reception_no = ?,
              complainant_name = ?,
              contact = ?,
              location = ?,
              zone_type = ?,
              content = ?,
              review_date = ?,
              review_result = ?,
              improvement_result = ?,
              note = ?,
              device_id = ?,
              updated_by = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(
          payload.receivedDate.trim(),
          payload.receptionType.trim(),
          payload.receptionNo.trim(),
          payload.complainantName.trim(),
          payload.contact.trim(),
          payload.location.trim(),
          payload.zoneType.trim() || '일반구역',
          payload.content.trim(),
          (payload.reviewDate || '').trim(),
          payload.reviewResult.trim() || '검토중',
          (payload.improvementResult || '').trim(),
          (payload.note || '').trim(),
          (payload.deviceId || '').trim(),
          actorUsername,
          nowIso,
          existing.id
        )
      return this.getById(existing.id)!
    }

    const targetId = payload.id && payload.id > 0 ? payload.id : this.getNextId()
    this.db
      .prepare(`
        INSERT INTO minwon_records (
          id, received_date, reception_type, reception_no,
          complainant_name, contact, location, zone_type,
          content, review_date, review_result, improvement_result,
          note, device_id, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        targetId,
        payload.receivedDate.trim(),
        payload.receptionType.trim(),
        payload.receptionNo.trim(),
        payload.complainantName.trim(),
        payload.contact.trim(),
        payload.location.trim(),
        payload.zoneType.trim() || '일반구역',
        payload.content.trim(),
        (payload.reviewDate || '').trim(),
        payload.reviewResult.trim() || '검토중',
        (payload.improvementResult || '').trim(),
        (payload.note || '').trim(),
        (payload.deviceId || '').trim(),
        actorUsername,
        actorUsername,
        nowIso,
        nowIso
      )

    return this.getById(targetId)!
  }

  deleteRecord(id: number): boolean {
    const info = this.db.prepare('DELETE FROM minwon_records WHERE id = ?').run(id)
    return info.changes > 0
  }

  resetAllRecords(): number {
    const info = this.db.prepare('DELETE FROM minwon_records').run()
    return info.changes
  }

  getSummaryStats(): MinwonSummaryStats {
    const now = new Date()
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const totalMinwonCount = (
      this.db.prepare('SELECT COUNT(*) as cnt FROM minwon_records').get() as { cnt: number }
    ).cnt

    const thisMonthCount = (
      this.db
        .prepare('SELECT COUNT(*) as cnt FROM minwon_records WHERE received_date LIKE ?')
        .get(`${thisMonthPrefix}%`) as { cnt: number }
    ).cnt

    const pendingReviewCount = (
      this.db
        .prepare(
          "SELECT COUNT(*) as cnt FROM minwon_records WHERE review_result IN ('검토중', '') OR review_date = ''"
        )
        .get() as { cnt: number }
    ).cnt

    const completedReviewCount = Math.max(0, totalMinwonCount - pendingReviewCount)

    const byReceptionType = this.db
      .prepare(
        "SELECT CASE WHEN reception_type = '' THEN '미지정' ELSE reception_type END as label, COUNT(*) as count FROM minwon_records GROUP BY label ORDER BY count DESC"
      )
      .all() as Array<{ label: string; count: number }>

    const byReviewResult = this.db
      .prepare(
        "SELECT CASE WHEN review_result = '' THEN '미검토' ELSE review_result END as label, COUNT(*) as count FROM minwon_records GROUP BY label ORDER BY count DESC"
      )
      .all() as Array<{ label: string; count: number }>

    const byZoneType = this.db
      .prepare(
        "SELECT CASE WHEN zone_type = '' THEN '일반구역' ELSE zone_type END as label, COUNT(*) as count FROM minwon_records GROUP BY label ORDER BY count DESC"
      )
      .all() as Array<{ label: string; count: number }>

    const monthlyTrend = this.db
      .prepare(`
        SELECT substr(received_date, 1, 7) as month,
               COUNT(*) as receivedCount,
               SUM(CASE WHEN review_date != '' AND review_result != '검토중' THEN 1 ELSE 0 END) as reviewedCount
        FROM minwon_records
        WHERE length(received_date) >= 7
        GROUP BY substr(received_date, 1, 7)
        ORDER BY month DESC
        LIMIT 12
      `)
      .all() as Array<{ month: string; receivedCount: number; reviewedCount: number }>

    return {
      totalMinwonCount,
      thisMonthCount,
      pendingReviewCount,
      completedReviewCount,
      byReceptionType,
      byReviewResult,
      byZoneType,
      monthlyTrend: monthlyTrend.reverse()
    }
  }
}
