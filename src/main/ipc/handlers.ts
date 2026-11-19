import { BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import { IPC_CHANNELS } from '@shared/ipc-channels'
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
  TrafficDeviceUpsertPayload,
  USER_ROLE_LABELS,
  UserAccount
} from '@shared/types/domain'
import { collectStorageInfo, resolveAppPaths } from '../config/app-paths'
import { saveConfigAtomic } from '../config/config-manager'
import { writeSystemLog } from '../config/file-logger'
import { issueAuthSession } from '../auth/auth-service'
import { UserRepository } from '../db/user-repo'
import { MinwonRepository } from '../db/minwon-repo'
import { DeviceRepository } from '../db/device-repo'
import { CodeRepository } from '../db/code-repo'
import { loadDevicesFromCsv, loadMinwonFromCsv } from '../db/seed'
import { Database } from 'better-sqlite3'
import {
  exportDeviceOperationStatsToExcel,
  exportMinwonRecordsToExcel
} from '../excel/excel-service'
import { EmbeddedRestServer } from '../server/rest-server'

export interface IpcContext {
  db: Database
  getMainWindow: () => BrowserWindow | null
  getConfig: () => AppConfig
  setConfig: (next: AppConfig) => void
  getCurrentUser: () => UserAccount | null
  setCurrentUser: (user: UserAccount | null) => void
  userRepo: UserRepository
  minwonRepo: MinwonRepository
  deviceRepo: DeviceRepository
  codeRepo: CodeRepository
  restServer: EmbeddedRestServer
  refreshTrayMenu: () => void
  buildSnapshot: () => AppSnapshot
  broadcastUpdate: () => void
}

export function canUserControlServer(user: UserAccount | null, config: AppConfig): boolean {
  if (!user) return false
  if (user.role === 'SUPER_ADMIN') return true
  if (
    user.role === 'ADMIN' &&
    (user.canToggleServer || user.username === config.server.designatedAdminUsername)
  ) {
    return true
  }
  return false
}

export function registerIpcHandlers(ctx: IpcContext): void {
  const getActorName = (): string => ctx.getCurrentUser()?.username || 'admin'

  ipcMain.handle(IPC_CHANNELS.GET_SNAPSHOT, (): AppSnapshot => {
    return ctx.buildSnapshot()
  })

  // 1. 로그인 / 로그아웃 / 비밀번호 변경 / 계정 관리
  ipcMain.handle(
    IPC_CHANNELS.AUTH_LOGIN,
    (_e, payload: LoginPayload): ActionResult<AuthSession> => {
      const user = ctx.userRepo.authenticate(payload.username || '', payload.password || '')
      if (!user) {
        return {
          ok: false,
          message: '아이디 또는 비밀번호가 일치하지 않거나 비활성화된 계정입니다.'
        }
      }

      ctx.setCurrentUser(user)
      ctx.refreshTrayMenu()
      const session = issueAuthSession(user)
      ctx.userRepo.recordAudit({
        username: user.username,
        action: '로컬 로그인',
        targetType: '인증',
        targetId: user.username,
        detail: `${user.displayName} (${USER_ROLE_LABELS[user.role]}) 로그인`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `${user.displayName} (${USER_ROLE_LABELS[user.role]})님 로그인되었습니다.`,
        data: session
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, (): ActionResult => {
    const actor = getActorName()
    ctx.setCurrentUser(null)
    ctx.refreshTrayMenu()
    ctx.userRepo.recordAudit({
      username: actor,
      action: '로그아웃',
      targetType: '인증',
      targetId: actor,
      detail: '사용자 로그아웃'
    })
    ctx.broadcastUpdate()
    return { ok: true, message: '로그아웃되었습니다.' }
  })

  ipcMain.handle(
    IPC_CHANNELS.AUTH_CHANGE_PASSWORD,
    (
      _e,
      params: { username: string; oldPassword: string; newPassword: string }
    ): ActionResult => {
      const ok = ctx.userRepo.changePassword(
        params.username,
        params.oldPassword,
        params.newPassword
      )
      if (!ok) {
        return { ok: false, message: '현재 비밀번호가 일치하지 않습니다.' }
      }
      ctx.userRepo.recordAudit({
        username: params.username,
        action: '비밀번호 변경',
        targetType: '사용자',
        targetId: params.username,
        detail: '비밀번호 변경 완료'
      })
      ctx.broadcastUpdate()
      return { ok: true, message: '비밀번호가 안전하게 변경되었습니다.' }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.USER_UPSERT,
    (_e, payload: CreateUserPayload): ActionResult => {
      const actor = ctx.getCurrentUser()
      if (actor && actor.role === 'USER') {
        return { ok: false, message: '사용자 계정 관리는 최고관리자 또는 관리자만 가능합니다.' }
      }
      if (!payload.username?.trim()) {
        return { ok: false, message: '사용자 아이디를 입력해 주세요.' }
      }
      const saved = ctx.userRepo.upsertUser(payload)

      // 만약 해당 계정이 서버 구동 지정 관리자(ADMIN + canToggleServer)로 저장되었다면 config.designatedAdminUsername도 동기화
      if (saved.role === 'ADMIN' && saved.canToggleServer) {
        const currentCfg = ctx.getConfig()
        const updatedCfg = saveConfigAtomic({
          ...currentCfg,
          server: {
            ...currentCfg.server,
            designatedAdminUsername: saved.username
          }
        })
        ctx.setConfig(updatedCfg)
      }

      if (actor && actor.username === saved.username) {
        ctx.setCurrentUser(saved)
      }
      ctx.refreshTrayMenu()

      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '사용자 계정 저장',
        targetType: '사용자',
        targetId: saved.username,
        detail: `${saved.displayName} (${USER_ROLE_LABELS[saved.role]} · ${saved.jobTitle})`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `'${saved.displayName} (${saved.username})' 계정이 저장되었습니다.`,
        data: saved
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.USER_DESIGNATE_SERVER_ADMIN,
    (_e, targetUsername: string): ActionResult => {
      const actor = ctx.getCurrentUser()
      if (actor && actor.role !== 'SUPER_ADMIN') {
        return {
          ok: false,
          message: '서버 구동 관리자(1명) 지정은 최고관리자만 변경할 수 있습니다.'
        }
      }
      const designated = ctx.userRepo.designateServerAdmin(targetUsername)
      if (!designated) {
        return { ok: false, message: '지정할 사용자 계정을 찾을 수 없습니다.' }
      }
      const currentCfg = ctx.getConfig()
      const updatedCfg = saveConfigAtomic({
        ...currentCfg,
        server: {
          ...currentCfg.server,
          designatedAdminUsername: designated.username
        }
      })
      ctx.setConfig(updatedCfg)
      ctx.refreshTrayMenu()
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '서버 지정 관리자 변경',
        targetType: '사용자',
        targetId: designated.username,
        detail: `서버 기능 제어 관리자 지정: ${designated.displayName} (${designated.username})`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `'${designated.displayName} (${designated.username})' 계정이 서버 구동 관리자(1명)로 지정되었습니다.`,
        data: designated
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.USER_DELETE,
    (_e, username: string): ActionResult => {
      const actor = ctx.getCurrentUser()
      if (actor && actor.role !== 'SUPER_ADMIN') {
        return { ok: false, message: '사용자 계정 삭제는 최고관리자만 가능합니다.' }
      }
      const ok = ctx.userRepo.deleteUser(username)
      if (!ok) {
        return { ok: false, message: '기본 최고관리자 계정은 삭제할 수 없습니다.' }
      }
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '사용자 계정 삭제',
        targetType: '사용자',
        targetId: username,
        detail: `계정 [${username}] 삭제`
      })
      ctx.broadcastUpdate()
      return { ok: true, message: `'${username}' 계정이 삭제되었습니다.` }
    }
  )

  // 2. 민원접수대장 CRUD 및 복합 검색
  ipcMain.handle(
    IPC_CHANNELS.MINWON_LIST,
    (_e, query?: MinwonFilterQuery): MinwonRecord[] => {
      return ctx.minwonRepo.listRecords(query)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MINWON_UPSERT,
    (_e, payload: MinwonUpsertPayload): ActionResult<MinwonRecord> => {
      if (!payload.receivedDate?.trim()) {
        return { ok: false, message: '접수일자를 입력해 주세요.' }
      }
      const isEdit = Boolean(payload.id && ctx.minwonRepo.getById(payload.id))
      const saved = ctx.minwonRepo.upsertRecord(payload, getActorName())
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: isEdit ? '민원 수정' : '민원 등록',
        targetType: '민원대장',
        targetId: String(saved.id),
        detail: `[연번 ${saved.id}] ${saved.complainantName || '무기명'} / ${saved.location}`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: isEdit
          ? `[연번 ${saved.id}] 민원 내역이 수정되었습니다.`
          : `[연번 ${saved.id}] 신규 민원이 등록되었습니다.`,
        data: saved
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.MINWON_DELETE,
    (_e, id: number): ActionResult => {
      const ok = ctx.minwonRepo.deleteRecord(id)
      if (!ok) {
        return { ok: false, message: '삭제할 민원 연번을 찾지 못했습니다.' }
      }
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '민원 삭제',
        targetType: '민원대장',
        targetId: String(id),
        detail: `[연번 ${id}] 민원 삭제`
      })
      ctx.broadcastUpdate()
      return { ok: true, message: `[연번 ${id}] 민원이 삭제되었습니다.` }
    }
  )

  ipcMain.handle(IPC_CHANNELS.MINWON_RESET_ALL, (): ActionResult => {
    const actor = ctx.getCurrentUser()
    if (actor && actor.role !== 'SUPER_ADMIN') {
      return { ok: false, message: '전체 초기화는 최고관리자만 실행할 수 있습니다.' }
    }
    const count = ctx.minwonRepo.resetAllRecords()
    ctx.userRepo.recordAudit({
      username: getActorName(),
      action: '민원 전체 초기화',
      targetType: '민원대장',
      targetId: '전체',
      detail: `총 ${count}건 민원 데이터 초기화`
    })
    ctx.broadcastUpdate()
    return { ok: true, message: `총 ${count}건의 민원 데이터가 초기화되었습니다.` }
  })

  ipcMain.handle(IPC_CHANNELS.MINWON_RELOAD_CSV, (): ActionResult => {
    const { seedMinwonCsvPath } = resolveAppPaths()
    const count = loadMinwonFromCsv(ctx.db, seedMinwonCsvPath)
    ctx.userRepo.recordAudit({
      username: getActorName(),
      action: '기존 민원 데이터 불러오기',
      targetType: '민원대장',
      targetId: '원본파일',
      detail: `기존 민원접수대장 파일에서 ${count}건 동기화`
    })
    ctx.broadcastUpdate()
    return {
      ok: count > 0,
      message:
        count > 0
          ? `기존 민원접수대장 데이터 총 ${count}건을 성공적으로 불러왔습니다.`
          : '기존 민원 데이터 파일을 찾을 수 없습니다.'
    }
  })

  // 3. 무인교통단속장비 마스터 CRUD 및 CSV 재적재
  ipcMain.handle(
    IPC_CHANNELS.DEVICE_LIST,
    (
      _e,
      params?: { keyword?: string; zoneType?: string; enforcementType?: string }
    ): TrafficDevice[] => {
      return ctx.deviceRepo.listDevices(
        params?.keyword,
        params?.zoneType,
        params?.enforcementType
      )
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_UPSERT,
    (_e, payload: TrafficDeviceUpsertPayload): ActionResult<TrafficDevice> => {
      if (!payload.deviceId?.trim()) {
        return { ok: false, message: '장비번호(예: B7272)를 입력해 주세요.' }
      }
      const saved = ctx.deviceRepo.upsertDevice(payload)
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '장비 저장',
        targetType: '단속장비',
        targetId: saved.deviceId,
        detail: `[${saved.deviceId}] ${saved.deviceName}`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `[${saved.deviceId}] 단속장비 정보가 저장되었습니다.`,
        data: saved
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.DEVICE_DELETE,
    (_e, deviceId: string): ActionResult => {
      const ok = ctx.deviceRepo.deleteDevice(deviceId)
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '장비 삭제',
        targetType: '단속장비',
        targetId: deviceId,
        detail: `단속장비 [${deviceId}] 삭제`
      })
      ctx.broadcastUpdate()
      return {
        ok,
        message: ok ? `[${deviceId}] 단속장비가 삭제되었습니다.` : '삭제할 장비를 찾지 못했습니다.'
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.DEVICE_RELOAD_CSV, (): ActionResult => {
    const { seedDeviceCsvPath } = resolveAppPaths()
    const count = loadDevicesFromCsv(ctx.db, seedDeviceCsvPath)
    ctx.userRepo.recordAudit({
      username: getActorName(),
      action: '장비 마스터 재적재',
      targetType: '단속장비',
      targetId: '원본파일',
      detail: `단속장비 원본 파일에서 ${count}대 동기화`
    })
    ctx.broadcastUpdate()
    return {
      ok: count > 0,
      message:
        count > 0
          ? `단속장비 마스터에서 총 ${count}대를 성공적으로 불러왔습니다.`
          : '단속장비 마스터 파일을 찾을 수 없습니다.'
    }
  })

  // 4. 코드 항목 관리 (접수구분, 구역구분, 검토결과)
  ipcMain.handle(
    IPC_CHANNELS.CODE_ADD,
    (_e, params: { category: CodeCategory; value: string }): ActionResult => {
      if (!params.value?.trim()) {
        return { ok: false, message: '추가할 항목명을 입력해 주세요.' }
      }
      ctx.codeRepo.ensureCodeItem(params.category, params.value)
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `[${params.category}] '${params.value.trim()}' 항목이 추가되었습니다.`
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CODE_DELETE,
    (_e, params: { category: CodeCategory; value: string }): ActionResult => {
      const ok = ctx.codeRepo.deleteCodeItem(params.category, params.value)
      ctx.broadcastUpdate()
      return {
        ok,
        message: ok
          ? `[${params.category}] '${params.value}' 항목이 삭제되었습니다.`
          : '삭제할 항목을 찾지 못했습니다.'
      }
    }
  )

  // 5. 엑셀 내보내기 (민원 전체/조회 결과, 단속장비 운영현황 통계)
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_MINWON_EXCEL,
    (_e, params?: { query?: MinwonFilterQuery; prefix?: '전체' | '조회' }): ActionResult<{ filePath: string }> => {
      const records = ctx.minwonRepo.listRecords(params?.query)
      const { filePath } = exportMinwonRecordsToExcel(records, params?.prefix || '전체')
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '민원 엑셀 내보내기',
        targetType: '엑셀출력',
        targetId: params?.prefix || '전체',
        detail: `${records.length}건 -> ${path.basename(filePath)}`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `엑셀 파일(${records.length}건)이 저장되었습니다: ${filePath}`,
        data: { filePath }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.EXPORT_DEVICE_STATS_EXCEL,
    (): ActionResult<{ filePath: string }> => {
      const stats = ctx.deviceRepo.computeOperationStats()
      const { filePath } = exportDeviceOperationStatsToExcel(stats)
      ctx.userRepo.recordAudit({
        username: getActorName(),
        action: '장비 통계 엑셀 내보내기',
        targetType: '엑셀출력',
        targetId: '운영현황통계',
        detail: `총 ${stats.totals.totalCount}대 -> ${path.basename(filePath)}`
      })
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: `무인교통단속장비 운영현황 통계 파일이 저장되었습니다: ${filePath}`,
        data: { filePath }
      }
    }
  )

  // 6. 내장 다중 접속 서버 On/Off 제어 (최고관리자 또는 지정된 관리자 1명만 허용!)
  ipcMain.handle(
    IPC_CHANNELS.SERVER_TOGGLE,
    async (_e, params: { enabled: boolean; port?: number }): Promise<ActionResult> => {
      const currentCfg = ctx.getConfig()
      const actor = ctx.getCurrentUser()

      if (!canUserControlServer(actor, currentCfg)) {
        return {
          ok: false,
          message: `다중 접속 서버 기능은 최고관리자 또는 지정된 관리자(${currentCfg.server.designatedAdminUsername}) 계정만 켤 수 있습니다.`
        }
      }

      const targetPort = params.port || currentCfg.server.port

      try {
        if (params.enabled) {
          const status = await ctx.restServer.start(targetPort, currentCfg.server.host)
          const updated = saveConfigAtomic({
            ...currentCfg,
            server: {
              ...currentCfg.server,
              enabled: true,
              port: targetPort
            }
          })
          ctx.setConfig(updated)
          ctx.refreshTrayMenu()
          ctx.userRepo.recordAudit({
            username: getActorName(),
            action: '다중 접속 서버 시작',
            targetType: '서버제어',
            targetId: String(targetPort),
            detail: `다중 접속 서버 기동 (${status.urls.join(', ')})`
          })
          ctx.broadcastUpdate()
          return {
            ok: true,
            message: `다중 접속 서버가 시작되었습니다 (${status.urls[0]}). 다른 사용자도 접속할 수 있습니다.`
          }
        } else {
          await ctx.restServer.stop()
          const updated = saveConfigAtomic({
            ...currentCfg,
            server: {
              ...currentCfg.server,
              enabled: false
            }
          })
          ctx.setConfig(updated)
          ctx.refreshTrayMenu()
          ctx.userRepo.recordAudit({
            username: getActorName(),
            action: '다중 접속 서버 중지',
            targetType: '서버제어',
            targetId: String(targetPort),
            detail: '다중 접속 서버 중지됨'
          })
          ctx.broadcastUpdate()
          return {
            ok: true,
            message: '다중 접속 서버가 중지되었습니다.'
          }
        }
      } catch (err) {
        return {
          ok: false,
          message: `서버 상태 전환 실패: ${(err as Error).message}`
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_UPDATE,
    async (_e, nextConfig: AppConfig): Promise<ActionResult> => {
      const actor = ctx.getCurrentUser()
      const currentCfg = ctx.getConfig()
      if (!canUserControlServer(actor, currentCfg)) {
        return {
          ok: false,
          message: '서버 및 시스템 환경설정은 최고관리자 또는 지정 관리자만 변경할 수 있습니다.'
        }
      }

      const saved = saveConfigAtomic(nextConfig)
      ctx.setConfig(saved)

      // 지정 관리자가 바뀌었으면 DB에도 동기화
      if (saved.server.designatedAdminUsername) {
        ctx.userRepo.designateServerAdmin(saved.server.designatedAdminUsername)
      }

      try {
        if (saved.server.enabled) {
          await ctx.restServer.start(saved.server.port, saved.server.host)
        } else {
          await ctx.restServer.stop()
        }
      } catch (err) {
        writeSystemLog('ERROR', `설정 변경 후 서버 재시작 실패: ${(err as Error).message}`)
      }

      ctx.refreshTrayMenu()
      ctx.broadcastUpdate()
      return {
        ok: true,
        message: '시스템 및 서버 환경설정이 안전하게 저장되었습니다.'
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_e, kind: string): Promise<void> => {
    const paths = resolveAppPaths()
    const storage = collectStorageInfo()
    const found = storage.find((s) => s.key === kind)

    if (kind === 'CONFIG') {
      shell.showItemInFolder(paths.configPath)
      return
    }
    if (found) {
      await shell.openPath(found.resolvedPath)
      return
    }
    await shell.openPath(paths.exportDir)
  })
}
