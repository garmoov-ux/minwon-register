import { Menu, Tray, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { resolveAppPaths } from './config/app-paths'

let trayInstance: Tray | null = null

// 15x15 자치경찰 방패 + 중앙 참수리/별 엠블럼 폴백 비트맵
const GLYPH_POLICE_SHIELD = [
  '000001111100000',
  '001111111111100',
  '011000000000110',
  '010000010000010',
  '010000111000010',
  '010011111110010',
  '010001111100010',
  '010001101100010',
  '011011000110110',
  '001100000001100',
  '000110000011000',
  '000011000110000',
  '000001101100000',
  '000000111000000',
  '000000010000000'
]

export function createMinwonAppIcon(size = 64): Electron.NativeImage {
  const { baseDir } = resolveAppPaths()
  const candidates = [
    path.resolve(baseDir, 'resources', 'icon.ico'),
    path.resolve(baseDir, 'resources', 'icon.png'),
    path.resolve(process.cwd(), 'resources', 'icon.ico'),
    path.resolve(process.cwd(), 'resources', 'icon.png')
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate)
      if (!img.isEmpty()) {
        return img.resize({ width: size, height: size })
      }
    }
  }

  // 파일이 없을 경우 자치경찰 네이비/골드 방패 비트맵 생성
  const buf = Buffer.alloc(size * size * 4)
  const pad = Math.max(1, Math.round(size * 0.06))
  const radius = Math.round(size * 0.22)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4
      const min = pad
      const max = size - 1 - pad
      const cx = x < min + radius ? min + radius : x > max - radius ? max - radius : x
      const cy = y < min + radius ? min + radius : y > max - radius ? max - radius : y
      if (x >= min && x <= max && y >= min && y <= max && Math.hypot(x - cx, y - cy) <= radius) {
        // BGRA: Police Navy #0b192c (R=11, G=25, B=44)
        buf[idx] = 44
        buf[idx + 1] = 25
        buf[idx + 2] = 11
        buf[idx + 3] = 255
      } else {
        buf[idx + 3] = 0
      }
    }
  }

  const scale = Math.max(1, Math.floor(size / 18))
  const startX = Math.floor((size - 15 * scale) / 2)
  const startY = Math.floor((size - 15 * scale) / 2)

  for (let row = 0; row < GLYPH_POLICE_SHIELD.length; row += 1) {
    for (let col = 0; col < GLYPH_POLICE_SHIELD[row].length; col += 1) {
      if (GLYPH_POLICE_SHIELD[row][col] !== '1') continue
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const px = startX + col * scale + sx
          const py = startY + row * scale + sy
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4
            // Gold #f59e0b (R=245, G=158, B=11)
            buf[idx] = 11
            buf[idx + 1] = 158
            buf[idx + 2] = 245
            buf[idx + 3] = 255
          }
        }
      }
    }
  }

  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

export function setupSystemTray(params: {
  isServerRunning: () => boolean
  getServerPort: () => number
  canToggleServer: () => boolean
  onToggleServer: (next: boolean) => Promise<void>
  onShowWindow: () => void
  onQuitApp: () => void
}): { refreshMenu: () => void; destroyTray: () => void } {
  const {
    isServerRunning,
    getServerPort,
    canToggleServer,
    onToggleServer,
    onShowWindow,
    onQuitApp
  } = params
  const icon = createMinwonAppIcon(32)

  trayInstance = new Tray(icon)
  trayInstance.setToolTip('자치경찰 무인교통단속장비 민원접수대장')

  const refreshMenu = (): void => {
    if (!trayInstance) return
    const running = isServerRunning()
    const port = getServerPort()
    const allowed = canToggleServer()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `자치경찰 민원접수대장 (${running ? `다중 접속 서버 가동 중 :${port}` : '단독 로컬 모드'})`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '민원접수대장 화면 열기',
        click: () => onShowWindow()
      },
      {
        label: running
          ? `다중 접속 서버 끄기 (포트 ${port})`
          : `다중 접속 서버 켜기 (포트 ${port})`,
        enabled: allowed,
        click: async () => {
          if (!canToggleServer()) return
          await onToggleServer(!running)
          refreshMenu()
        }
      },
      { type: 'separator' },
      {
        label: '프로그램 완전 종료',
        click: () => onQuitApp()
      }
    ])

    trayInstance.setContextMenu(contextMenu)
  }

  trayInstance.on('click', () => onShowWindow())
  trayInstance.on('double-click', () => onShowWindow())

  refreshMenu()

  return {
    refreshMenu,
    destroyTray: () => {
      if (trayInstance) {
        trayInstance.destroy()
        trayInstance = null
      }
    }
  }
}
