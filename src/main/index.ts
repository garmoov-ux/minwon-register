import { app, BrowserWindow } from 'electron'
import path from 'path'
import { IPC_CHANNELS } from '@shared/ipc-channels'
import { AppConfig, AppSnapshot, UserAccount } from '@shared/types/domain'
import { collectStorageInfo } from './config/app-paths'
import { loadConfig, saveConfigAtomic } from './config/config-manager'
import { writeSystemLog } from './config/file-logger'
import { closeDatabase, getDatabase } from './db/connection'
import { UserRepository } from './db/user-repo'
import { MinwonRepository } from './db/minwon-repo'
import { DeviceRepository } from './db/device-repo'
import { CodeRepository } from './db/code-repo'
import { EmbeddedRestServer } from './server/rest-server'
import { canUserControlServer, registerIpcHandlers } from './ipc/handlers'
import { createMinwonAppIcon, setupSystemTray } from './tray'

let mainWindow: BrowserWindow | null = null
let isQuitting = false

const APP_KOREAN_TITLE = '자치경찰 무인교통단속장비 민원접수대장'
process.title = APP_KOREAN_TITLE
app.setName(APP_KOREAN_TITLE)
app.setAppUserModelId('com.inno.minwonregister')

const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
const gotSingleInstanceLock = isDev ? true : app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    let config: AppConfig = loadConfig()
    const db = getDatabase()
    const userRepo = new UserRepository(db)
    const minwonRepo = new MinwonRepository(db)
    const deviceRepo = new DeviceRepository(db)
    const codeRepo = new CodeRepository(db)

    let currentUser: UserAccount | null = null
    let restServer: EmbeddedRestServer

    const buildSnapshot = (): AppSnapshot => ({
      config,
      serverStatus: restServer.getStatus(),
      codes: codeRepo.getAllCodes(),
      minwonSummary: minwonRepo.getSummaryStats(),
      deviceStats: deviceRepo.computeOperationStats(),
      totalDeviceCount: deviceRepo.getTotalCount(),
      users: userRepo.listUsers(),
      recentAuditLogs: userRepo.listRecentAuditLogs(80),
      storageInfo: collectStorageInfo()
    })

    const broadcastUpdate = (): void => {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
        mainWindow.webContents.send(IPC_CHANNELS.STATE_UPDATED, buildSnapshot())
      }
      restServer?.broadcastSseUpdate()
    }

    restServer = new EmbeddedRestServer(
      {
        userRepo,
        minwonRepo,
        deviceRepo,
        codeRepo,
        getSnapshot: buildSnapshot,
        onStateMutated: broadcastUpdate,
        allowRemoteWrite: () => config.server.allowRemoteWrite
      },
      path.join(__dirname, '../renderer')
    )

    if (config.server.enabled || config.server.autoStartOnBoot) {
      try {
        await restServer.start(config.server.port, config.server.host)
        config = saveConfigAtomic({
          ...config,
          server: { ...config.server, enabled: true }
        })
      } catch (err) {
        writeSystemLog('ERROR', `초기 다중 접속 서버 기동 실패: ${(err as Error).message}`)
      }
    }

    const appIcon = createMinwonAppIcon(64)

    mainWindow = new BrowserWindow({
      width: 1180,
      height: 740,
      useContentSize: true,
      resizable: false,
      maximizable: false,
      fullscreenable: false,
      show: !config.system.startMinimized,
      autoHideMenuBar: true,
      backgroundColor: '#f1f5f9',
      icon: appIcon,
      title: APP_KOREAN_TITLE,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      }
    })

    const trayControl = setupSystemTray({
      isServerRunning: () => restServer.getStatus().running,
      getServerPort: () => config.server.port,
      canToggleServer: () => canUserControlServer(currentUser, config),
      onToggleServer: async (next: boolean) => {
        if (!canUserControlServer(currentUser, config)) return
        if (next) {
          await restServer.start(config.server.port, config.server.host)
        } else {
          await restServer.stop()
        }
        config = saveConfigAtomic({
          ...config,
          server: { ...config.server, enabled: next }
        })
        broadcastUpdate()
      },
      onShowWindow: () => {
        if (!mainWindow) return
        mainWindow.show()
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
        broadcastUpdate()
      },
      onQuitApp: () => {
        isQuitting = true
        app.quit()
      }
    })

    mainWindow.on('show', () => broadcastUpdate())
    mainWindow.on('restore', () => broadcastUpdate())
    mainWindow.on('close', (event) => {
      if (!isQuitting && config.system.minimizeToTray) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })

    registerIpcHandlers({
      db,
      getMainWindow: () => mainWindow,
      getConfig: () => config,
      setConfig: (next) => {
        config = next
      },
      getCurrentUser: () => currentUser,
      setCurrentUser: (u) => {
        currentUser = u
      },
      userRepo,
      minwonRepo,
      deviceRepo,
      codeRepo,
      restServer,
      refreshTrayMenu: trayControl.refreshMenu,
      buildSnapshot,
      broadcastUpdate
    })

    if (process.env.ELECTRON_RENDERER_URL) {
      await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    writeSystemLog('INFO', '자치경찰 무인교통단속장비 민원접수대장 시스템이 시작되었습니다.')

    app.on('before-quit', () => {
      isQuitting = true
      void restServer.stop()
      trayControl.destroyTray()
      writeSystemLog('INFO', '자치경찰 무인교통단속장비 민원접수대장 시스템이 정상 종료되었습니다.')
      closeDatabase()
    })
  })
}
