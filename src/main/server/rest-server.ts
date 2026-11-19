import http from 'http'
import fs from 'fs'
import path from 'path'
import { RestServerStatus } from '@shared/types/domain'
import { ApiRouterContext, handleApiRequest } from './api-router'
import { LanDiscoveryService, listNetworkAdapters } from './lan-discovery'
import { writeSystemLog } from '../config/file-logger'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
}

export function getLocalIpv4Urls(port: number, bindHost = '0.0.0.0'): string[] {
  if (bindHost && bindHost !== '0.0.0.0') {
    return [`http://${bindHost}:${port}`]
  }
  const adapters = listNetworkAdapters()
  const urls = adapters.map((a) => `http://${a.address}:${port}`)
  urls.push(`http://127.0.0.1:${port}`)
  return Array.from(new Set(urls))
}

export class EmbeddedRestServer {
  private server: http.Server | null = null
  private discoveryService = new LanDiscoveryService()
  private sseClients = new Set<http.ServerResponse>()
  private running = false
  private port = 8090
  private host = '0.0.0.0'
  private startedAt: string | null = null
  private totalRequests = 0
  private lastError: string | null = null

  constructor(
    private readonly routerContext: ApiRouterContext,
    private readonly rendererStaticDir?: string
  ) {}

  getStatus(): RestServerStatus {
    return {
      running: this.running,
      port: this.port,
      host: this.host,
      urls: this.running ? getLocalIpv4Urls(this.port, this.host) : [],
      adapters: listNetworkAdapters(),
      activeConnections: this.sseClients.size,
      startedAt: this.startedAt,
      totalRequests: this.totalRequests,
      lastError: this.lastError
    }
  }

  broadcastSseUpdate(): void {
    if (!this.running || this.sseClients.size === 0) return
    const payload = `data: ${JSON.stringify({ type: 'STATE_UPDATED', timestamp: new Date().toISOString() })}\n\n`
    for (const client of this.sseClients) {
      try {
        client.write(payload)
      } catch {
        this.sseClients.delete(client)
      }
    }
  }

  async start(port: number, host = '0.0.0.0'): Promise<RestServerStatus> {
    if (this.running) {
      if (this.port === port && this.host === host) {
        return this.getStatus()
      }
      await this.stop()
    }

    this.port = port
    this.host = host || '0.0.0.0'
    this.lastError = null

    return new Promise((resolve, reject) => {
      const srv = http.createServer(async (req, res) => {
        this.totalRequests += 1
        const reqUrl = req.url || '/'

        // 1. 실시간 동기화 SSE 스트림
        if (reqUrl.startsWith('/api/v1/events')) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          })
          res.write(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`)
          this.sseClients.add(res)
          req.on('close', () => {
            this.sseClients.delete(res)
          })
          return
        }

        // 2. /api/v1/* REST API 라우팅
        const handled = await handleApiRequest(req, res, this.routerContext)
        if (handled) return

        // 3. 정적 웹 클라이언트(React Renderer) 서빙
        this.serveRendererStatic(reqUrl, res)
      })

      srv.on('error', (err: Error) => {
        this.lastError = err.message
        this.running = false
        writeSystemLog('ERROR', `내장 다중 접속 서버 오류: ${err.message}`)
        reject(err)
      })

      srv.listen(this.port, this.host, () => {
        this.server = srv
        this.running = true
        this.startedAt = new Date().toISOString()

        // LAN UDP 자동 탐색 응답기 기동 (다른 사용자 컴퓨터에서 접속모드 선택 없이 자동으로 서버를 찾도록 지원)
        this.discoveryService.startResponder(() => ({
          running: this.running,
          port: this.port,
          bindHost: this.host
        }))

        const urls = getLocalIpv4Urls(this.port, this.host)
        writeSystemLog(
          'INFO',
          `다중 접속 서버가 시작되었습니다. 접속 주소: ${urls.join(', ')}`
        )
        resolve(this.getStatus())
      })
    })
  }

  async stop(): Promise<RestServerStatus> {
    this.discoveryService.stopResponder()

    for (const client of this.sseClients) {
      try {
        client.end()
      } catch {
        // ignore
      }
    }
    this.sseClients.clear()

    if (!this.server) {
      this.running = false
      this.startedAt = null
      return this.getStatus()
    }

    return new Promise((resolve) => {
      this.server?.close(() => {
        this.server = null
        this.running = false
        this.startedAt = null
        writeSystemLog('INFO', '다중 접속 서버가 중지되었습니다.')
        resolve(this.getStatus())
      })
    })
  }

  private serveRendererStatic(reqUrl: string, res: http.ServerResponse): void {
    const cleanPath = reqUrl.split('?')[0]
    const staticRoot =
      this.rendererStaticDir || path.resolve(__dirname, '../renderer')

    let filePath = path.join(staticRoot, cleanPath === '/' ? 'index.html' : cleanPath)
    if (!filePath.startsWith(staticRoot)) {
      res.writeHead(403)
      res.end('Forbidden')
      return
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(staticRoot, 'index.html')
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'
      res.writeHead(200, { 'Content-Type': contentType })
      fs.createReadStream(filePath).pipe(res)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>자치경찰 무인교통단속장비 민원접수대장 서버</title></head>
<body style="font-family: sans-serif; background:#f1f5f9; color:#0f172a; padding:32px;">
  <h2>자치경찰 무인교통단속장비 민원접수대장 다중 접속 서버</h2>
  <p>현재 다중 접속 서버가 정상 가동 중입니다.</p>
</body>
</html>`)
    }
  }
}
