import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { StorageFolderItem } from '@shared/types/domain'

dotenv.config()

export interface ResolvedAppPaths {
  baseDir: string
  configPath: string
  dbPath: string
  logDir: string
  exportDir: string
  seedDeviceCsvPath: string
}

export function resolveAppPaths(): ResolvedAppPaths {
  let baseDir = process.cwd()

  try {
    if (app && app.isPackaged) {
      baseDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'))
    }
  } catch {
    baseDir = process.cwd()
  }

  const configPath = path.resolve(baseDir, 'config.json')
  const dbPath = path.resolve(
    baseDir,
    process.env.MINWON_DB_PATH || './data/minwon.db'
  )
  const logDir = path.resolve(
    baseDir,
    process.env.MINWON_LOG_DIR || './logs'
  )
  const exportDir = path.resolve(
    baseDir,
    process.env.MINWON_EXPORT_DIR || './Export'
  )

  const candidateCsvPaths = [
    path.resolve(baseDir, 'resources', 'device.csv'),
    path.resolve(baseDir, '_ref_VBA', 'device.csv'),
    path.resolve(process.cwd(), 'resources', 'device.csv'),
    path.resolve(process.cwd(), '_ref_VBA', 'device.csv')
  ]
  const seedDeviceCsvPath =
    candidateCsvPaths.find((p) => fs.existsSync(p)) || candidateCsvPaths[0]

  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.mkdirSync(logDir, { recursive: true })
  fs.mkdirSync(exportDir, { recursive: true })

  return {
    baseDir,
    configPath,
    dbPath,
    logDir,
    exportDir,
    seedDeviceCsvPath
  }
}

function inspectDirStats(dirPath: string): { fileCount: number; totalBytes: number } {
  if (!fs.existsSync(dirPath)) return { fileCount: 0, totalBytes: 0 }
  try {
    const stat = fs.statSync(dirPath)
    if (stat.isFile()) {
      return { fileCount: 1, totalBytes: stat.size }
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    let fileCount = 0
    let totalBytes = 0
    for (const entry of entries) {
      if (entry.isFile()) {
        fileCount += 1
        totalBytes += fs.statSync(path.join(dirPath, entry.name)).size
      }
    }
    return { fileCount, totalBytes }
  } catch {
    return { fileCount: 0, totalBytes: 0 }
  }
}

export function collectStorageInfo(): StorageFolderItem[] {
  const paths = resolveAppPaths()
  const dataDir = path.dirname(paths.dbPath)
  const dataStats = inspectDirStats(dataDir)
  const exportStats = inspectDirStats(paths.exportDir)
  const logStats = inspectDirStats(paths.logDir)
  const configStats = inspectDirStats(paths.configPath)

  return [
    {
      key: 'DATA',
      label: '내장 데이터베이스 폴더',
      description: '민원접수대장, 단속장비 마스터, 계정 및 감사 이력 저장소',
      resolvedPath: dataDir,
      fileCount: dataStats.fileCount,
      totalBytes: dataStats.totalBytes
    },
    {
      key: 'EXPORT',
      label: '엑셀 보고서 내보내기 폴더 (Export)',
      description: '민원접수대장 전체/조회 결과 및 단속장비 운영현황 통계 엑셀(.xlsx) 저장 폴더',
      resolvedPath: paths.exportDir,
      fileCount: exportStats.fileCount,
      totalBytes: exportStats.totalBytes
    },
    {
      key: 'LOGS',
      label: '운영 및 서버 접속 로그 폴더',
      description: '일자별 시스템 및 다중 접속 서버 운용 로그 파일',
      resolvedPath: paths.logDir,
      fileCount: logStats.fileCount,
      totalBytes: logStats.totalBytes
    },
    {
      key: 'CONFIG',
      label: '환경설정 파일 (config.json)',
      description: '서버 포트, 자동 시작, 보관 주기 및 원격 접속 설정 파일',
      resolvedPath: paths.configPath,
      fileCount: configStats.fileCount,
      totalBytes: configStats.totalBytes
    }
  ]
}
