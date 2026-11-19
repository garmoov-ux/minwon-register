import Database from 'better-sqlite3'
import {
  DeviceOperationStats,
  DeviceYearlyStatRow,
  TrafficDevice,
  TrafficDeviceUpsertPayload
} from '@shared/types/domain'

interface DeviceRow {
  id: number
  install_year: number
  device_id: string
  device_name: string
  location: string
  manufacturer: string
  category: string
  enforcement_type: string
  speed_limit: number
  zone_type: string
}

function mapDeviceRow(r: DeviceRow): TrafficDevice {
  return {
    id: r.id,
    installYear: r.install_year,
    deviceId: r.device_id,
    deviceName: r.device_name,
    location: r.location,
    manufacturer: r.manufacturer,
    category: r.category,
    enforcementType: r.enforcement_type,
    speedLimit: r.speed_limit,
    zoneType: r.zone_type
  }
}

export class DeviceRepository {
  constructor(private readonly db: Database.Database) {}

  getTotalCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM devices').get() as { cnt: number }
    return row.cnt
  }

  listDevices(keyword?: string, zoneType?: string, enforcementType?: string): TrafficDevice[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (zoneType && zoneType !== '전체' && zoneType !== '-- 전체 --') {
      conditions.push('zone_type = ?')
      params.push(zoneType.trim())
    }

    if (enforcementType && enforcementType !== '전체' && enforcementType !== '-- 전체 --') {
      conditions.push('enforcement_type = ?')
      params.push(enforcementType.trim())
    }

    const kw = (keyword || '').trim()
    if (kw) {
      const likeVal = `%${kw}%`
      conditions.push(
        '(device_id LIKE ? OR device_name LIKE ? OR location LIKE ? OR manufacturer LIKE ?)'
      )
      params.push(likeVal, likeVal, likeVal, likeVal)
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const rows = this.db
      .prepare(`SELECT * FROM devices ${whereSql} ORDER BY install_year DESC, device_id ASC`)
      .all(...params) as DeviceRow[]

    return rows.map(mapDeviceRow)
  }

  upsertDevice(payload: TrafficDeviceUpsertPayload): TrafficDevice {
    const cleanId = payload.deviceId.trim().toUpperCase()
    this.db
      .prepare(`
        INSERT INTO devices (
          install_year, device_id, device_name, location,
          manufacturer, category, enforcement_type, speed_limit, zone_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET
          install_year = excluded.install_year,
          device_name = excluded.device_name,
          location = excluded.location,
          manufacturer = excluded.manufacturer,
          category = excluded.category,
          enforcement_type = excluded.enforcement_type,
          speed_limit = excluded.speed_limit,
          zone_type = excluded.zone_type
      `)
      .run(
        Number(payload.installYear) || new Date().getFullYear(),
        cleanId,
        payload.deviceName.trim() || cleanId,
        payload.location.trim(),
        (payload.manufacturer || '').trim(),
        (payload.category || '고정식').trim(),
        (payload.enforcementType || '신호과속').trim(),
        Number(payload.speedLimit) || 50,
        (payload.zoneType || '일반구역').trim()
      )

    const saved = this.db
      .prepare('SELECT * FROM devices WHERE device_id = ?')
      .get(cleanId) as DeviceRow
    return mapDeviceRow(saved)
  }

  deleteDevice(deviceId: string): boolean {
    const info = this.db
      .prepare('DELETE FROM devices WHERE device_id = ?')
      .run(deviceId.trim())
    return info.changes > 0
  }

  /**
   * 기존 VBA modMain.Analysis() 및 operator-status.xlsx 100% 일치 통계 매트릭스 계산
   */
  computeOperationStats(): DeviceOperationStats {
    const rawRows = this.db
      .prepare(`
        SELECT
          install_year as installYear,
          SUM(CASE WHEN zone_type = '일반구역' THEN 1 ELSE 0 END) as zoneGeneral,
          SUM(CASE WHEN zone_type = '어린이보호구역' THEN 1 ELSE 0 END) as zoneChild,
          SUM(CASE WHEN zone_type = '노인보호구역' THEN 1 ELSE 0 END) as zoneElder,
          SUM(CASE WHEN zone_type = '장애인보호구역' THEN 1 ELSE 0 END) as zoneDisabled,
          SUM(CASE WHEN category = '고정식' AND enforcement_type = '신호과속' THEN 1 ELSE 0 END) as fixedSignalSpeed,
          SUM(CASE WHEN category = '고정식' AND enforcement_type = '과속' THEN 1 ELSE 0 END) as fixedSpeed,
          SUM(CASE WHEN category = '고정식' AND enforcement_type = '구간' THEN 1 ELSE 0 END) as fixedSection,
          SUM(CASE WHEN category = '고정식' AND enforcement_type = '운행제한' THEN 1 ELSE 0 END) as fixedRestriction,
          SUM(CASE WHEN category = '고정식' AND enforcement_type = '진입금지' THEN 1 ELSE 0 END) as fixedNoEntry,
          SUM(CASE WHEN category = '이동식' AND enforcement_type = '과속' THEN 1 ELSE 0 END) as mobileSpeed
        FROM devices
        GROUP BY install_year
        ORDER BY install_year ASC
      `)
      .all() as Array<Omit<DeviceYearlyStatRow, 'seq' | 'totalCount'>>

    const totals = {
      zoneGeneral: 0,
      zoneChild: 0,
      zoneElder: 0,
      zoneDisabled: 0,
      fixedSignalSpeed: 0,
      fixedSpeed: 0,
      fixedSection: 0,
      fixedRestriction: 0,
      fixedNoEntry: 0,
      mobileSpeed: 0,
      totalCount: 0
    }

    const rows: DeviceYearlyStatRow[] = rawRows.map((r, idx) => {
      const totalCount =
        r.zoneGeneral + r.zoneChild + r.zoneElder + r.zoneDisabled

      totals.zoneGeneral += r.zoneGeneral
      totals.zoneChild += r.zoneChild
      totals.zoneElder += r.zoneElder
      totals.zoneDisabled += r.zoneDisabled
      totals.fixedSignalSpeed += r.fixedSignalSpeed
      totals.fixedSpeed += r.fixedSpeed
      totals.fixedSection += r.fixedSection
      totals.fixedRestriction += r.fixedRestriction
      totals.fixedNoEntry += r.fixedNoEntry
      totals.mobileSpeed += r.mobileSpeed
      totals.totalCount += totalCount

      return {
        seq: idx + 1,
        installYear: r.installYear,
        zoneGeneral: r.zoneGeneral,
        zoneChild: r.zoneChild,
        zoneElder: r.zoneElder,
        zoneDisabled: r.zoneDisabled,
        fixedSignalSpeed: r.fixedSignalSpeed,
        fixedSpeed: r.fixedSpeed,
        fixedSection: r.fixedSection,
        fixedRestriction: r.fixedRestriction,
        fixedNoEntry: r.fixedNoEntry,
        mobileSpeed: r.mobileSpeed,
        totalCount
      }
    })

    return { rows, totals }
  }
}
