const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')

const APP_DISPLAY_NAME = '자치경찰 무인교통단속장비 민원접수대장'

function findRceditExe() {
  const localAppData = process.env.LOCALAPPDATA || ''
  const cacheDir = path.join(localAppData, 'electron-builder', 'Cache', 'winCodeSign')
  if (fs.existsSync(cacheDir)) {
    const entries = fs.readdirSync(cacheDir)
    for (const entry of entries) {
      const candidate = path.join(cacheDir, entry, 'rcedit-x64.exe')
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }
  return null
}

function stampExecutable(exePath, iconPath) {
  const rcedit = findRceditExe()
  if (!rcedit || !fs.existsSync(exePath)) return

  const args = [
    exePath,
    '--set-version-string',
    'FileDescription',
    APP_DISPLAY_NAME,
    '--set-version-string',
    'ProductName',
    APP_DISPLAY_NAME,
    '--set-version-string',
    'CompanyName',
    '㈜이노네트웍스',
    '--set-version-string',
    'InternalName',
    'MinwonRegister',
    '--set-version-string',
    'OriginalFilename',
    path.basename(exePath)
  ]

  if (iconPath && fs.existsSync(iconPath)) {
    args.push('--set-icon', iconPath)
  }

  try {
    execFileSync(rcedit, args, { stdio: 'inherit', windowsHide: true })
  } catch (err) {
    console.warn('[afterPack] rcedit warning:', err.message)
  }
}

exports.stampExecutable = stampExecutable

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return
  const exeName = `${context.packager.appInfo.productFilename}.exe`
  const exePath = path.join(context.appOutDir, exeName)
  const iconPath = path.resolve(context.packager.projectDir, 'resources', 'icon.ico')
  stampExecutable(exePath, iconPath)
}

if (require.main === module) {
  const devElectronExe = path.resolve(__dirname, '../node_modules/electron/dist/electron.exe')
  const iconPath = path.resolve(__dirname, 'icon.ico')
  stampExecutable(devElectronExe, iconPath)
}
