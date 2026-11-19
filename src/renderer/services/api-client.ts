import {
  ActionResult,
  AppConfig,
  AppSnapshot,
  AuthSession,
  CodeCategory,
  CreateUserPayload,
  LoginPayload,
  MinwonFilterQuery,
  MinwonRecord,
  MinwonUpsertPayload,
  TrafficDevice,
  TrafficDeviceUpsertPayload
} from '@shared/types/domain'

const SESSION_STORAGE_KEY = 'minwon_auth_session_v1'
const REMOTE_MODE_STORAGE_KEY = 'minwon_remote_mode_v1'
const REMOTE_URL_STORAGE_KEY = 'minwon_remote_url_v1'

export function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && Boolean(window.minwonApi)
}

export function getSavedAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    }
  } catch {
    // ignore
  }
}

export function getClientConnectionConfig(): {
  mode: 'LOCAL' | 'REMOTE'
  remoteServerUrl: string
} {
  if (!isElectronEnvironment()) {
    return {
      mode: 'REMOTE',
      remoteServerUrl: window.location.origin
    }
  }
  const mode = (localStorage.getItem(REMOTE_MODE_STORAGE_KEY) as 'LOCAL' | 'REMOTE') || 'LOCAL'
  const remoteServerUrl =
    localStorage.getItem(REMOTE_URL_STORAGE_KEY) || 'http://127.0.0.1:8090'
  return { mode, remoteServerUrl }
}

export function setClientConnectionConfig(
  mode: 'LOCAL' | 'REMOTE',
  remoteServerUrl: string
): void {
  const cleanUrl = remoteServerUrl.trim().replace(/\/+$/, '') || 'http://127.0.0.1:8090'
  localStorage.setItem(REMOTE_MODE_STORAGE_KEY, mode)
  localStorage.setItem(REMOTE_URL_STORAGE_KEY, cleanUrl)
}

function shouldUseRestApi(): boolean {
  if (!isElectronEnvironment()) return true
  return getClientConnectionConfig().mode === 'REMOTE'
}

function getBaseApiUrl(): string {
  if (!isElectronEnvironment()) {
    return window.location.origin
  }
  return getClientConnectionConfig().remoteServerUrl.replace(/\/+$/, '')
}

async function fetchJson<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ActionResult<T>> {
  const session = getSavedAuthSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {})
  }
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`
  }

  try {
    const res = await fetch(`${getBaseApiUrl()}${endpoint}`, {
      ...options,
      headers
    })
    const data = (await res.json()) as ActionResult<T>
    return data
  } catch (err) {
    return {
      ok: false,
      message: `원격 서버(${getBaseApiUrl()}) 통신 실패: ${(err as Error).message}`
    }
  }
}

export function normalizeRemoteServerUrl(rawInput: string, defaultPort = 8090): {
  isLocal: boolean
  url: string
} {
  const trimmed = (rawInput || '').trim()
  if (
    !trimmed ||
    trimmed === '내 컴퓨터' ||
    trimmed === '로컬' ||
    trimmed.includes('내 컴퓨터') ||
    trimmed === '127.0.0.1' ||
    trimmed === `127.0.0.1:${defaultPort}` ||
    trimmed === `http://127.0.0.1:${defaultPort}` ||
    trimmed === 'localhost' ||
    trimmed === `localhost:${defaultPort}` ||
    trimmed === `http://localhost:${defaultPort}`
  ) {
    return { isLocal: true, url: `http://127.0.0.1:${defaultPort}` }
  }

  let withProto = trimmed.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(withProto)) {
    withProto = `http://${withProto}`
  }

  try {
    const parsed = new URL(withProto)
    if (!parsed.port) {
      parsed.port = String(defaultPort)
    }
    return { isLocal: false, url: parsed.origin }
  } catch {
    return { isLocal: false, url: withProto }
  }
}

export const unifiedApiClient = {
  async getSnapshot(): Promise<AppSnapshot | null> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.getSnapshot()
    }
    const res = await fetchJson<AppSnapshot>('/api/v1/snapshot')
    return res.ok && res.data ? res.data : null
  },

  async login(
    payload: LoginPayload & { serverAddress?: string }
  ): Promise<ActionResult<AuthSession>> {
    // 1. 웹 브라우저에서 직접 서버에 접속한 경우: 항상 해당 서버 REST API로 로그인
    if (!isElectronEnvironment()) {
      const res = await fetchJson<AuthSession>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      if (res.ok && res.data) saveAuthSession(res.data)
      return res
    }

    // 2. 데스크톱 프로그램에서 사용자가 원격 서버 주소(예: 192.168.0.9:8090)를 입력해 로그인한 경우
    const rawAddr = (payload.serverAddress || '').trim()
    const normalized = normalizeRemoteServerUrl(rawAddr)

    if (rawAddr && !normalized.isLocal) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 2500)
        const remoteRes = await fetch(`${normalized.url}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: payload.username,
            password: payload.password
          }),
          signal: controller.signal
        })
        clearTimeout(timer)
        const remoteData = (await remoteRes.json()) as ActionResult<AuthSession>
        if (remoteData.ok && remoteData.data) {
          setClientConnectionConfig('REMOTE', normalized.url)
          saveAuthSession(remoteData.data)
          return {
            ...remoteData,
            message: `${remoteData.data.user.displayName}님 다중 접속 서버(${normalized.url})에 연결되었습니다.`
          }
        }
        return {
          ok: false,
          message: remoteData.message || `서버(${normalized.url}) 로그인에 실패했습니다.`
        }
      } catch {
        return {
          ok: false,
          message: `입력하신 서버 주소(${normalized.url})에 연결할 수 없습니다. 서버 PC에서 [서버 켜기]가 활성화되어 있는지 확인해 주세요.`
        }
      }
    }

    // 3. 내 컴퓨터(로컬) 또는 주소 미입력 시: 로컬 DB 즉시 로그인 (내 PC 서버가 꺼져 있고 주소가 공란이면 사내망 서버 자동 탐색 병행)
    if (window.minwonApi) {
      if (!rawAddr) {
        try {
          const snap = await window.minwonApi.getSnapshot()
          const isLocalHostServer = snap.serverStatus.running
          if (!isLocalHostServer && typeof window.minwonApi.discoverServers === 'function') {
            const discovered = await Promise.race([
              window.minwonApi.discoverServers(),
              new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 450))
            ])
            if (discovered.length > 0) {
              const remoteTargetUrl = discovered[0].url
              const controller = new AbortController()
              const timer = setTimeout(() => controller.abort(), 800)
              const remoteRes = await fetch(`${remoteTargetUrl}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: controller.signal
              })
              clearTimeout(timer)
              const remoteData = (await remoteRes.json()) as ActionResult<AuthSession>
              if (remoteData.ok && remoteData.data) {
                setClientConnectionConfig('REMOTE', remoteTargetUrl)
                saveAuthSession(remoteData.data)
                return {
                  ...remoteData,
                  message: `${remoteData.data.user.displayName}님 사내망 다중 접속 서버(${discovered[0].serverName} · ${remoteTargetUrl})에 자동 연결되었습니다.`
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      const localRes = await window.minwonApi.login(payload)
      if (localRes.ok && localRes.data) {
        setClientConnectionConfig('LOCAL', 'http://127.0.0.1:8090')
        saveAuthSession(localRes.data)
      }
      return localRes
    }

    const res = await fetchJson<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (res.ok && res.data) saveAuthSession(res.data)
    return res
  },

  async discoverServers() {
    if (window.minwonApi) {
      return window.minwonApi.discoverServers()
    }
    return []
  },

  async logout(): Promise<ActionResult> {
    saveAuthSession(null)
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.logout()
    }
    return { ok: true, message: '로그아웃되었습니다.' }
  },

  async changePassword(params: {
    username: string
    oldPassword: string
    newPassword: string
  }): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.changePassword(params)
    }
    return fetchJson('/api/v1/auth/password', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  },

  async upsertUser(payload: CreateUserPayload): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.upsertUser(payload)
    }
    return fetchJson('/api/v1/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  async designateServerAdmin(username: string): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.designateServerAdmin(username)
    }
    return fetchJson('/api/v1/users/designate-server-admin', {
      method: 'POST',
      body: JSON.stringify({ username })
    })
  },

  async deleteUser(username: string): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.deleteUser(username)
    }
    return fetchJson(`/api/v1/users/${encodeURIComponent(username)}`, {
      method: 'DELETE'
    })
  },

  async listMinwon(query?: MinwonFilterQuery): Promise<MinwonRecord[]> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.listMinwon(query)
    }
    const qs = new URLSearchParams()
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v) qs.set(k, String(v))
      })
    }
    const res = await fetchJson<MinwonRecord[]>(`/api/v1/minwon?${qs.toString()}`)
    return res.ok && res.data ? res.data : []
  },

  async upsertMinwon(payload: MinwonUpsertPayload): Promise<ActionResult<MinwonRecord>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.upsertMinwon(payload)
    }
    return fetchJson<MinwonRecord>('/api/v1/minwon', {
      method: payload.id ? 'PUT' : 'POST',
      body: JSON.stringify(payload)
    })
  },

  async deleteMinwon(id: number): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.deleteMinwon(id)
    }
    return fetchJson(`/api/v1/minwon/${id}`, {
      method: 'DELETE'
    })
  },

  async resetAllMinwon(): Promise<ActionResult> {
    if (window.minwonApi) {
      return window.minwonApi.resetAllMinwon()
    }
    return { ok: false, message: '전체 데이터 초기화는 로컬 서버 호스트에서만 가능합니다.' }
  },

  async reloadMinwonCsv(): Promise<ActionResult> {
    if (window.minwonApi) {
      return window.minwonApi.reloadMinwonCsv()
    }
    return { ok: false, message: '기존 민원 데이터 원본 불러오기는 로컬 서버에서 수행해 주세요.' }
  },

  async listDevices(params?: {
    keyword?: string
    zoneType?: string
    enforcementType?: string
  }): Promise<TrafficDevice[]> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.listDevices(params)
    }
    const qs = new URLSearchParams()
    if (params?.keyword) qs.set('keyword', params.keyword)
    if (params?.zoneType) qs.set('zoneType', params.zoneType)
    if (params?.enforcementType) qs.set('enforcementType', params.enforcementType)
    const res = await fetchJson<TrafficDevice[]>(`/api/v1/devices?${qs.toString()}`)
    return res.ok && res.data ? res.data : []
  },

  async upsertDevice(payload: TrafficDeviceUpsertPayload): Promise<ActionResult<TrafficDevice>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.upsertDevice(payload)
    }
    return fetchJson<TrafficDevice>('/api/v1/devices', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  async deleteDevice(deviceId: string): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.deleteDevice(deviceId)
    }
    return fetchJson(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE'
    })
  },

  async reloadDeviceCsv(): Promise<ActionResult> {
    if (window.minwonApi) {
      return window.minwonApi.reloadDeviceCsv()
    }
    return { ok: false, message: '장비 CSV 원본 재적재는 로컬 서버에서 수행해 주세요.' }
  },

  async exportDevicesCsv(params?: {
    keyword?: string
    zoneType?: string
    enforcementType?: string
  }): Promise<ActionResult<{ filePath: string; count: number }>> {
    if (window.minwonApi) {
      return window.minwonApi.exportDevicesCsv(params)
    }
    return { ok: false, message: '장비 CSV 내보내기는 데스크톱 프로그램에서 지원됩니다.' }
  },

  async importDevicesCsv(): Promise<
    ActionResult<{ count: number; errorCode?: string; errorDetail?: string }>
  > {
    if (window.minwonApi) {
      return window.minwonApi.importDevicesCsv()
    }
    return { ok: false, message: '장비 CSV 가져오기는 데스크톱 프로그램에서 지원됩니다.' }
  },

  async addCodeItem(category: CodeCategory, value: string): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.addCodeItem({ category, value })
    }
    return fetchJson('/api/v1/codes', {
      method: 'POST',
      body: JSON.stringify({ category, value })
    })
  },

  async deleteCodeItem(category: CodeCategory, value: string): Promise<ActionResult> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.deleteCodeItem({ category, value })
    }
    return fetchJson('/api/v1/codes', {
      method: 'DELETE',
      body: JSON.stringify({ category, value })
    })
  },

  async exportMinwonExcel(params?: {
    query?: MinwonFilterQuery
    prefix?: '전체' | '조회'
    customFileName?: string
  }): Promise<ActionResult<{ filePath: string }>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.exportMinwonExcel(params)
    }
    return fetchJson<{ filePath: string }>('/api/v1/export/minwon', {
      method: 'POST',
      body: JSON.stringify(params || {})
    })
  },

  async exportDeviceStatsExcel(params?: {
    customFileName?: string
  }): Promise<ActionResult<{ filePath: string }>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.exportDeviceStatsExcel(params)
    }
    return fetchJson<{ filePath: string }>('/api/v1/export/device-stats', {
      method: 'POST',
      body: JSON.stringify(params || {})
    })
  },

  async toggleServer(enabled: boolean, port?: number, host?: string): Promise<ActionResult> {
    if (window.minwonApi) {
      return window.minwonApi.toggleServer({ enabled, port, host })
    }
    return { ok: false, message: '서버 시작/중지는 메인 호스트 프로그램에서만 제어할 수 있습니다.' }
  },

  async updateConfig(config: AppConfig): Promise<ActionResult> {
    if (window.minwonApi) {
      return window.minwonApi.updateConfig(config)
    }
    return { ok: false, message: '시스템 환경설정은 메인 호스트 프로그램에서만 변경할 수 있습니다.' }
  },

  openFolder(kind: string): void {
    if (window.minwonApi) {
      void window.minwonApi.openPathFolder(kind)
    }
  }
}
