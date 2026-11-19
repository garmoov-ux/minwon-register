import fs from 'fs'
import { AppConfig } from '@shared/types/domain'
import { resolveAppPaths } from './app-paths'

export const DEFAULT_APP_CONFIG: AppConfig = {
  server: {
    enabled: false,
    port: Number(process.env.MINWON_SERVER_PORT || 8090),
    host: '0.0.0.0',
    autoStartOnBoot: false,
    allowRemoteWrite: true
  },
  system: {
    minimizeToTray: true,
    startMinimized: false,
    requireLoginOnStart: true,
    autoBackupDaily: true,
    retentionDays: 365
  },
  remoteClient: {
    mode: 'LOCAL',
    remoteServerUrl: 'http://127.0.0.1:8090'
  }
}

export function normalizeConfig(partial?: Partial<AppConfig>): AppConfig {
  return {
    server: {
      ...DEFAULT_APP_CONFIG.server,
      ...(partial?.server || {}),
      port: Math.max(1024, Math.min(65535, Number(partial?.server?.port || DEFAULT_APP_CONFIG.server.port)))
    },
    system: {
      ...DEFAULT_APP_CONFIG.system,
      ...(partial?.system || {}),
      retentionDays: Math.max(30, Number(partial?.system?.retentionDays || DEFAULT_APP_CONFIG.system.retentionDays))
    },
    remoteClient: {
      ...DEFAULT_APP_CONFIG.remoteClient,
      ...(partial?.remoteClient || {})
    }
  }
}

export function loadConfig(customPath?: string): AppConfig {
  const targetPath = customPath || resolveAppPaths().configPath
  if (!fs.existsSync(targetPath)) {
    saveConfigAtomic(DEFAULT_APP_CONFIG, targetPath)
    return structuredClone(DEFAULT_APP_CONFIG)
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return normalizeConfig(parsed)
  } catch {
    return structuredClone(DEFAULT_APP_CONFIG)
  }
}

export function saveConfigAtomic(config: AppConfig, customPath?: string): AppConfig {
  const normalized = normalizeConfig(config)
  const targetPath = customPath || resolveAppPaths().configPath
  const tmpPath = `${targetPath}.tmp`

  const serialized = JSON.stringify(normalized, null, 2)
  fs.writeFileSync(tmpPath, serialized, { encoding: 'utf-8', flag: 'w' })
  fs.renameSync(tmpPath, targetPath)
  return normalized
}
