import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { resolveAppPaths } from '../config/app-paths'
import { initializeDatabaseSchema } from './schema'
import { seedInitialDatabase } from './seed'

let dbInstance: Database.Database | null = null

function resolveNativeAddonOption(): { nativeBinding?: string } {
  // Node.js(Vitest) 환경에서 Electron이 better_sqlite3.node를 잠그고 있을 때 캐시된 Node용 바이너리 사용
  if (!process.versions.electron) {
    const cachedNodeBinding = path.resolve(
      process.cwd(),
      'node_modules/.cache/better-sqlite3-prebuilds/node-v127.node'
    )
    if (fs.existsSync(cachedNodeBinding)) {
      return { nativeBinding: cachedNodeBinding }
    }
  }
  return {}
}

export function createDatabaseConnection(
  dbFilePath: string,
  options?: {
    seed?: boolean
    customCsvPath?: string
    customMinwonCsvPath?: string
    seedMinwon?: boolean
  }
): Database.Database {
  const db = new Database(dbFilePath, resolveNativeAddonOption())
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  initializeDatabaseSchema(db)

  if (options?.seed !== false) {
    seedInitialDatabase(db, {
      customDeviceCsvPath: options?.customCsvPath,
      customMinwonCsvPath: options?.customMinwonCsvPath,
      seedMinwon: options?.seedMinwon
    })
  }
  return db
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    const { dbPath, seedDeviceCsvPath, seedMinwonCsvPath } = resolveAppPaths()
    dbInstance = createDatabaseConnection(dbPath, {
      seed: true,
      customCsvPath: seedDeviceCsvPath,
      customMinwonCsvPath: seedMinwonCsvPath,
      seedMinwon: true
    })
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
