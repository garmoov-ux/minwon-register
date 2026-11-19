const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const bsDir = path.resolve(__dirname, '../node_modules/better-sqlite3')
const tmpCopy = path.resolve(__dirname, '../node_modules/.cache/bs-temp')
const destDir = path.resolve(__dirname, '../node_modules/.cache/better-sqlite3-prebuilds')
const outNode = path.join(destDir, 'node-v127.node')

if (!fs.existsSync(outNode)) {
  fs.rmSync(tmpCopy, { recursive: true, force: true })
  fs.mkdirSync(path.join(tmpCopy, 'build/Release'), { recursive: true })
  fs.copyFileSync(path.join(bsDir, 'package.json'), path.join(tmpCopy, 'package.json'))

  const prebuildBin = path.resolve(__dirname, '../node_modules/prebuild-install/bin.js')
  execFileSync(process.execPath, [prebuildBin], { cwd: tmpCopy, stdio: 'inherit' })

  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(path.join(tmpCopy, 'build/Release/better_sqlite3.node'), outNode)
}
