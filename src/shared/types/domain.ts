export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: '최고관리자',
  ADMIN: '관리자',
  USER: '사용자'
}

export interface UserAccount {
  id: number
  username: string
  displayName: string
  jobTitle: string
  email: string
  contact: string
  role: UserRole
  canToggleServer: boolean
  active: boolean
  lastLoginAt: string | null
  createdAt: string
}

export interface AuthSession {
  token: string
  user: UserAccount
  expiresAt: string
}

export interface LoginPayload {
  username: string
  password?: string
}

export interface CreateUserPayload {
  username: string
  password?: string
  displayName: string
  jobTitle: string
  email: string
  contact: string
  role: UserRole
  canToggleServer?: boolean
  active?: boolean
}

export type CodeCategory = '접수구분' | '구역구분' | '검토결과'

export interface CodeItem {
  id: number
  category: CodeCategory
  value: string
  sortOrder: number
}

export interface MinwonRecord {
  id: number
  receivedDate: string
  receptionType: string
  receptionNo: string
  complainantName: string
  contact: string
  location: string
  zoneType: string
  content: string
  reviewDate: string
  reviewResult: string
  improvementResult: string
  note: string
  deviceId: string
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface MinwonUpsertPayload {
  id?: number
  receivedDate: string
  receptionType: string
  receptionNo: string
  complainantName: string
  contact: string
  location: string
  zoneType: string
  content: string
  reviewDate: string
  reviewResult: string
  improvementResult: string
  note: string
  deviceId?: string
}

export type QuickDatePeriod = 'ALL' | 'THIS_MONTH' | '3_MONTHS' | '6_MONTHS' | '9_MONTHS' | 'THIS_YEAR'

export type SearchFieldDivision =
  | '전체'
  | '접수구분'
  | '접수번호'
  | '이름'
  | '연락처'
  | '위치'
  | '구역구분'
  | '민원내용'
  | '개선결과'
  | '비고'

export interface MinwonFilterQuery {
  division?: SearchFieldDivision
  keyword?: string
  reviewResult?: string
  zoneType?: string
  receivedStartDate?: string
  receivedEndDate?: string
  reviewStartDate?: string
  reviewEndDate?: string
}

export interface TrafficDevice {
  id: number
  installYear: number
  deviceId: string
  deviceName: string
  location: string
  manufacturer: string
  category: string
  enforcementType: string
  speedLimit: number
  zoneType: string
}

export interface TrafficDeviceUpsertPayload {
  id?: number
  installYear: number
  deviceId: string
  deviceName: string
  location: string
  manufacturer: string
  category: string
  enforcementType: string
  speedLimit: number
  zoneType: string
}

export interface DeviceYearlyStatRow {
  seq: number
  installYear: number
  zoneGeneral: number
  zoneChild: number
  zoneElder: number
  zoneDisabled: number
  fixedSignalSpeed: number
  fixedSpeed: number
  fixedSection: number
  fixedRestriction: number
  fixedNoEntry: number
  mobileSpeed: number
  totalCount: number
}

export interface DeviceOperationStats {
  rows: DeviceYearlyStatRow[]
  totals: Omit<DeviceYearlyStatRow, 'seq' | 'installYear'>
}

export interface MinwonSummaryStats {
  totalMinwonCount: number
  thisMonthCount: number
  pendingReviewCount: number
  completedReviewCount: number
  byReceptionType: Array<{ label: string; count: number }>
  byReviewResult: Array<{ label: string; count: number }>
  byZoneType: Array<{ label: string; count: number }>
  monthlyTrend: Array<{ month: string; receivedCount: number; reviewedCount: number }>
}

export interface RestServerStatus {
  running: boolean
  port: number
  host: string
  urls: string[]
  activeConnections: number
  startedAt: string | null
  totalRequests: number
  lastError: string | null
}

export interface AuditLogEntry {
  id: number
  timestamp: string
  username: string
  action: string
  targetType: string
  targetId: string
  detail: string
  clientIp: string
}

export interface AppConfig {
  server: {
    enabled: boolean
    port: number
    host: string
    autoStartOnBoot: boolean
    allowRemoteWrite: boolean
    designatedAdminUsername: string
  }
  system: {
    minimizeToTray: boolean
    startMinimized: boolean
    requireLoginOnStart: boolean
    autoBackupDaily: boolean
    retentionDays: number
  }
  remoteClient: {
    mode: 'LOCAL' | 'REMOTE'
    remoteServerUrl: string
  }
}

export interface StorageFolderItem {
  key: 'DATA' | 'EXPORT' | 'LOGS' | 'CONFIG'
  label: string
  description: string
  resolvedPath: string
  fileCount: number
  totalBytes: number
}

export interface AppSnapshot {
  config: AppConfig
  serverStatus: RestServerStatus
  codes: Record<CodeCategory, string[]>
  minwonSummary: MinwonSummaryStats
  deviceStats: DeviceOperationStats
  totalDeviceCount: number
  users: UserAccount[]
  recentAuditLogs: AuditLogEntry[]
  storageInfo: StorageFolderItem[]
}

export interface ActionResult<T = unknown> {
  ok: boolean
  message: string
  data?: T
}
