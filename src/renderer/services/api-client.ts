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

export const unifiedApiClient = {
  async getSnapshot(): Promise<AppSnapshot | null> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.getSnapshot()
    }
    const res = await fetchJson<AppSnapshot>('/api/v1/snapshot')
    return res.ok && res.data ? res.data : null
  },

  async login(payload: LoginPayload): Promise<ActionResult<AuthSession>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      const res = await window.minwonApi.login(payload)
      if (res.ok && res.data) saveAuthSession(res.data)
      return res
    }
    const res = await fetchJson<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    if (res.ok && res.data) saveAuthSession(res.data)
    return res
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
  }): Promise<ActionResult<{ filePath: string }>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.exportMinwonExcel(params)
    }
    return fetchJson<{ filePath: string }>('/api/v1/export/minwon', {
      method: 'POST',
      body: JSON.stringify(params || {})
    })
  },

  async exportDeviceStatsExcel(): Promise<ActionResult<{ filePath: string }>> {
    if (!shouldUseRestApi() && window.minwonApi) {
      return window.minwonApi.exportDeviceStatsExcel()
    }
    return fetchJson<{ filePath: string }>('/api/v1/export/device-stats', {
      method: 'POST'
    })
  },

  async toggleServer(enabled: boolean, port?: number): Promise<ActionResult> {
    if (window.minwonApi) {
      return window.minwonApi.toggleServer({ enabled, port })
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
