import { Menu, Tray, nativeImage } from 'electron'

let trayInstance: Tray | null = null

// 13x11 문서/대장(Clipboard Ledger) 비트맵 (MinwonRegister 전용)
const GLYPH_MINWON_LEDGER = [
  '0001111111000',
  '0111000001110',
  '0100000000010',
  '0101111111010',
  '0100000000010',
  '0101111111010',
  '0100000000010',
  '0101111100010',
  '0100000000010',
  '0111111111110',
  '0000000000000'
]

function drawGlyph(
  buf: Buffer,
  size: number,
  glyph: string[],
  startX: number,
  startY: number,
  scale: number
): void {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let col = 0; col < glyph[row].length; col += 1) {
      if (glyph[row][col] !== '1') continue
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const px = startX + col * scale + sx
          const py = startY + row * scale + sy
          if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4
            buf[idx] = 255 // B
            buf[idx + 1] = 255 // G
            buf[idx + 2] = 255 // R
            buf[idx + 3] = 255 // A
          }
        }
      }
    }
  }
}

function insideRoundedRect(x: number, y: number, size: number, pad: number, radius: number): boolean {
  const min = pad
  const max = size - 1 - pad
  if (x < min || x > max || y < min || y > max) return false

  const cx = x < min + radius ? min + radius : x > max - radius ? max - radius : x
  const cy = y < min + radius ? min + radius : y > max - radius ? max - radius : y
  return Math.hypot(x - cx, y - cy) <= radius
}

export function createMinwonAppIcon(size = 64): Electron.NativeImage {
  const buf = Buffer.alloc(size * size * 4)
  const pad = Math.max(1, Math.round(size * 0.06))
  const radius = Math.round(size * 0.22)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4
      if (insideRoundedRect(x, y, size, pad, radius)) {
        // BGRA: Royal Blue #2563eb (R=37, G=99, B=235)
        buf[idx] = 235
        buf[idx + 1] = 99
        buf[idx + 2] = 37
        buf[idx + 3] = 255
      } else {
        buf[idx + 3] = 0
      }
    }
  }

  const scale = Math.max(1, Math.floor(size / 18))
  const totalWidth = 13 * scale
  const totalHeight = 11 * scale
  const startX = Math.floor((size - totalWidth) / 2)
  const startY = Math.floor((size - totalHeight) / 2)

  drawGlyph(buf, size, GLYPH_MINWON_LEDGER, startX, startY, scale)

  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

export function setupSystemTray(params: {
  isServerRunning: () => boolean
  getServerPort: () => number
  onToggleServer: (next: boolean) => Promise<void>
  onShowWindow: () => void
  onQuitApp: () => void
}): { refreshMenu: () => void; destroyTray: () => void } {
  const { isServerRunning, getServerPort, onToggleServer, onShowWindow, onQuitApp } = params
  const icon = createMinwonAppIcon(32)

  trayInstance = new Tray(icon)
  trayInstance.setToolTip('민원접수대장 - 무인교통단속장비 민원 및 운영현황 관리 시스템')

  const refreshMenu = (): void => {
    if (!trayInstance) return
    const running = isServerRunning()
    const port = getServerPort()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `민원접수대장 (${running ? `다중 접속 서버 가동 중 :${port}` : '로컬 단독 모드'})`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: '민원접수대장 창 열기',
        click: () => onShowWindow()
      },
      {
        label: running
          ? `다중 접속 REST API 서버 중지 (포트 ${port})`
          : `다중 접속 REST API 서버 시작 (포트 ${port})`,
        click: async () => {
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
