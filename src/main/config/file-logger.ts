import fs from 'fs'
import path from 'path'
import { resolveAppPaths } from './app-paths'

function getTodayCompact(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export function writeSystemLog(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  try {
    const { logDir } = resolveAppPaths()
    const filePath = path.join(logDir, `${getTodayCompact()}_minwon_system.log`)
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`
    fs.appendFileSync(filePath, line, 'utf-8')
  } catch {
    // 로그 파일 기록 실패 시 앱 동작에 영향을 주지 않음
  }
}
