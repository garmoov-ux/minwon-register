import dgram from 'dgram'
import os from 'os'
import { DiscoveredMinwonServer, NetworkAdapterItem } from '@shared/types/domain'

const DISCOVERY_PORT = 41234
const DISCOVERY_REQ_MAGIC = 'MINWON_DISCOVER_REQ_V1'
const DISCOVERY_RES_MAGIC = 'MINWON_DISCOVER_RES_V1'

function ipToInt(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, oct) => (acc << 8) + (parseInt(oct, 10) & 255), 0) >>> 0
  )
}

function intToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255
  ].join('.')
}

export function listNetworkAdapters(): NetworkAdapterItem[] {
  const adapters: NetworkAdapterItem[] = []
  try {
    const nets = os.networkInterfaces()
    for (const [name, list] of Object.entries(nets)) {
      for (const iface of list || []) {
        if (iface.family !== 'IPv4' || iface.internal) continue
        const lowerName = name.toLowerCase()
        const isVirtual =
          lowerName.includes('vethernet') ||
          lowerName.includes('wsl') ||
          lowerName.includes('hyper-v') ||
          lowerName.includes('docker') ||
          lowerName.includes('vmware') ||
          lowerName.includes('virtualbox')

        const ipInt = ipToInt(iface.address)
        const maskInt = ipToInt(iface.netmask || '255.255.255.0')
        const broadcastInt = (ipInt | (~maskInt >>> 0)) >>> 0

        adapters.push({
          name,
          address: iface.address,
          netmask: iface.netmask || '255.255.255.0',
          broadcast: intToIp(broadcastInt),
          isVirtual
        })
      }
    }
  } catch {
    // ignore
  }

  // 실제 물리 랜카드(유선 이더넷/Wi-Fi)를 가상 어댑터보다 항상 상단에 정렬
  return adapters.sort((a, b) => Number(a.isVirtual) - Number(b.isVirtual))
}

export class LanDiscoveryService {
  private responderSocket: dgram.Socket | null = null

  startResponder(getInfo: () => { running: boolean; port: number; bindHost: string }): void {
    if (this.responderSocket) return

    try {
      const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      sock.on('error', () => {
        // 포트 충돌 시 무시
      })

      sock.on('message', (msg, rinfo) => {
        const text = msg.toString('utf-8').trim()
        if (!text.startsWith(DISCOVERY_REQ_MAGIC)) return

        const info = getInfo()
        if (!info.running) return

        const adapters = listNetworkAdapters()
        // 요청을 보낸 클라이언트와 같은 서브넷에 있는 랜카드 IP를 우선 선택
        let bestIp = info.bindHost !== '0.0.0.0' ? info.bindHost : adapters[0]?.address || '127.0.0.1'
        const senderInt = ipToInt(rinfo.address)

        if (info.bindHost === '0.0.0.0') {
          for (const ad of adapters) {
            const maskInt = ipToInt(ad.netmask)
            if ((ipToInt(ad.address) & maskInt) === (senderInt & maskInt)) {
              bestIp = ad.address
              break
            }
          }
        }

        const payload = JSON.stringify({
          magic: DISCOVERY_RES_MAGIC,
          host: bestIp,
          port: info.port,
          url: `http://${bestIp}:${info.port}`,
          serverName: os.hostname(),
          adminName: '자치경찰 민원접수대장 서버'
        })

        sock.send(Buffer.from(payload, 'utf-8'), rinfo.port, rinfo.address)
      })

      sock.bind(DISCOVERY_PORT, '0.0.0.0')
      this.responderSocket = sock
    } catch {
      this.responderSocket = null
    }
  }

  stopResponder(): void {
    if (this.responderSocket) {
      try {
        this.responderSocket.close()
      } catch {
        // ignore
      }
      this.responderSocket = null
    }
  }
}

/**
 * 사내망(LAN) 내 모든 랜카드 서브넷 브로드캐스트 + 빠른 HTTP 스캔으로 가동 중인 민원접수대장 서버를 자동 탐색한다.
 */
export async function discoverLanMinwonServers(
  defaultPort = 8090,
  timeoutMs = 750
): Promise<DiscoveredMinwonServer[]> {
  const discovered = new Map<string, DiscoveredMinwonServer>()
  const adapters = listNetworkAdapters()

  await new Promise<void>((resolve) => {
    let closed = false
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true })

    const finish = (): void => {
      if (closed) return
      closed = true
      try {
        sock.close()
      } catch {
        // ignore
      }
      resolve()
    }

    sock.on('error', () => finish())

    sock.on('message', (msg, rinfo) => {
      try {
        const parsed = JSON.parse(msg.toString('utf-8')) as {
          magic?: string
          host?: string
          port?: number
          url?: string
          serverName?: string
          adminName?: string
        }
        if (parsed.magic !== DISCOVERY_RES_MAGIC) return
        const host = parsed.host || rinfo.address
        const port = parsed.port || defaultPort
        const url = parsed.url || `http://${host}:${port}`
        discovered.set(url, {
          host,
          port,
          url,
          serverName: parsed.serverName || host,
          adminName: parsed.adminName || '자치경찰 민원접수대장 서버'
        })
      } catch {
        // ignore
      }
    })

    sock.bind(0, '0.0.0.0', () => {
      try {
        sock.setBroadcast(true)
        const reqBuf = Buffer.from(DISCOVERY_REQ_MAGIC, 'utf-8')
        sock.send(reqBuf, DISCOVERY_PORT, '255.255.255.255')
        for (const ad of adapters) {
          sock.send(reqBuf, DISCOVERY_PORT, ad.broadcast)
        }
      } catch {
        // ignore
      }
      setTimeout(finish, timeoutMs)
    })
  })

  return Array.from(discovered.values())
}
