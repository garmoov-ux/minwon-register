import { contextBridge, ipcRenderer } from 'electron'
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
  TrafficDeviceUpsertPayload
} from '@shared/types/domain'

export const minwonApi = {
  getSnapshot: (): Promise<AppSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.GET_SNAPSHOT),

  onStateUpdated: (callback: (snapshot: AppSnapshot) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot): void => {
      callback(snapshot)
    }
    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATED, listener)
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATED, listener)
    }
  },

  login: (payload: LoginPayload): Promise<ActionResult<AuthSession>> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, payload),

  logout: (): Promise<ActionResult> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),

  changePassword: (params: {
    username: string
    oldPassword: string
    newPassword: string
  }): Promise<ActionResult> => ipcRenderer.invoke(IPC_CHANNELS.AUTH_CHANGE_PASSWORD, params),

  upsertUser: (payload: CreateUserPayload): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_UPSERT, payload),

  designateServerAdmin: (username: string): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_DESIGNATE_SERVER_ADMIN, username),

  deleteUser: (username: string): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.USER_DELETE, username),

  listMinwon: (query?: MinwonFilterQuery): Promise<MinwonRecord[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.MINWON_LIST, query),

  upsertMinwon: (payload: MinwonUpsertPayload): Promise<ActionResult<MinwonRecord>> =>
    ipcRenderer.invoke(IPC_CHANNELS.MINWON_UPSERT, payload),

  deleteMinwon: (id: number): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.MINWON_DELETE, id),

  resetAllMinwon: (): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.MINWON_RESET_ALL),

  reloadMinwonCsv: (): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.MINWON_RELOAD_CSV),

  listDevices: (params?: {
    keyword?: string
    zoneType?: string
    enforcementType?: string
  }): Promise<TrafficDevice[]> => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_LIST, params),

  upsertDevice: (payload: TrafficDeviceUpsertPayload): Promise<ActionResult<TrafficDevice>> =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICE_UPSERT, payload),

  deleteDevice: (deviceId: string): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICE_DELETE, deviceId),

  reloadDeviceCsv: (): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICE_RELOAD_CSV),

  exportDevicesCsv: (params?: {
    keyword?: string
    zoneType?: string
    enforcementType?: string
  }): Promise<ActionResult<{ filePath: string; count: number }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICE_EXPORT_CSV, params),

  importDevicesCsv: (): Promise<
    ActionResult<{ count: number; errorCode?: string; errorDetail?: string }>
  > => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_IMPORT_CSV),

  addCodeItem: (params: { category: CodeCategory; value: string }): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODE_ADD, params),

  deleteCodeItem: (params: { category: CodeCategory; value: string }): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CODE_DELETE, params),

  exportMinwonExcel: (params?: {
    query?: MinwonFilterQuery
    prefix?: '전체' | '조회'
    customFileName?: string
  }): Promise<ActionResult<{ filePath: string }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_MINWON_EXCEL, params),

  exportDeviceStatsExcel: (params?: {
    customFileName?: string
  }): Promise<ActionResult<{ filePath: string }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_DEVICE_STATS_EXCEL, params),

  toggleServer: (params: {
    enabled: boolean
    port?: number
    host?: string
  }): Promise<ActionResult> => ipcRenderer.invoke(IPC_CHANNELS.SERVER_TOGGLE, params),

  discoverServers: (): Promise<
    Array<{
      host: string
      port: number
      url: string
      serverName: string
      adminName: string
    }>
  > => ipcRenderer.invoke(IPC_CHANNELS.SERVER_DISCOVER),

  updateConfig: (config: AppConfig): Promise<ActionResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, config),

  openPathFolder: (kind: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER, kind)
}

contextBridge.exposeInMainWorld('minwonApi', minwonApi)
