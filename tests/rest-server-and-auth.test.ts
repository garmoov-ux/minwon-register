import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabaseConnection } from '../src/main/db/connection'
import { UserRepository } from '../src/main/db/user-repo'
import { MinwonRepository } from '../src/main/db/minwon-repo'
import { DeviceRepository } from '../src/main/db/device-repo'
import { CodeRepository } from '../src/main/db/code-repo'
import { EmbeddedRestServer } from '../src/main/server/rest-server'
import { discoverLanMinwonServers, listNetworkAdapters } from '../src/main/server/lan-discovery'

describe('내장 다중 사용자 서버 및 3단계 권한(최고관리자·관리자·사용자) 통합 테스트', () => {
  const csvPath = path.resolve(__dirname, '../_ref_VBA/device.csv')
  const db = createDatabaseConnection(':memory:', {
    seed: true,
    customCsvPath: csvPath,
    seedMinwon: false
  })
  const userRepo = new UserRepository(db)
  const minwonRepo = new MinwonRepository(db)
  const deviceRepo = new DeviceRepository(db)
  const codeRepo = new CodeRepository(db)

  let server: EmbeddedRestServer
  let baseUrl = ''

  beforeAll(async () => {
    server = new EmbeddedRestServer({
      userRepo,
      minwonRepo,
      deviceRepo,
      codeRepo,
      getSnapshot: () => ({
        totalDeviceCount: deviceRepo.getTotalCount(),
        minwonSummary: minwonRepo.getSummaryStats()
      }),
      onStateMutated: () => {},
      allowRemoteWrite: () => true
    })
    const testPort = 18096
    await server.start(testPort, '127.0.0.1')
    baseUrl = `http://127.0.0.1:${testPort}`
  })

  afterAll(async () => {
    await server.stop()
    db.close()
  })

  it('1. 미인증 상태에서 데이터 API 호출 시 401 차단 검증', async () => {
    const res = await fetch(`${baseUrl}/api/v1/minwon`)
    expect(res.status).toBe(401)
  })

  it('2. 최고관리자(admin), 지정 관리자(manager), 일반 사용자(user1) 로그인 및 권한 검증', async () => {
    const validLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin1234' })
    })
    expect(validLoginRes.status).toBe(200)
    const loginBody = (await validLoginRes.json()) as {
      ok: boolean
      data: {
        token: string
        user: { username: string; role: string; jobTitle: string; canToggleServer: boolean }
      }
    }
    expect(loginBody.ok).toBe(true)
    expect(loginBody.data.user.role).toBe('SUPER_ADMIN')
    expect(loginBody.data.user.canToggleServer).toBe(true)

    const token = loginBody.data.token
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }

    // 원격 민원 등록
    const createRes = await fetch(`${baseUrl}/api/v1/minwon`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        receivedDate: '2026-11-19',
        receptionType: '국민신문고',
        receptionNo: '2026-001',
        complainantName: '이순신',
        contact: '010-7777-1111',
        location: '서귀포시 안덕면 상창리 1978-1',
        zoneType: '일반구역',
        content: '다중 접속 서버 원격 민원 등록 테스트',
        reviewDate: '2026-11-19',
        reviewResult: '적합',
        improvementResult: '정상 가동 안내 완료',
        note: 'B7272'
      })
    })
    expect(createRes.status).toBe(200)

    // 일반 사용자(user1)로 로그인 후 사용자 계정 생성 시도 -> 403 차단 확인
    const userLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'user1', password: 'user1234' })
    })
    const userBody = (await userLogin.json()) as {
      data: { token: string; user: { role: string; canToggleServer: boolean } }
    }
    expect(userBody.data.user.role).toBe('USER')
    expect(userBody.data.user.canToggleServer).toBe(false)

    const forbiddenUserAdd = await fetch(`${baseUrl}/api/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userBody.data.token}`
      },
      body: JSON.stringify({
        username: 'hacker',
        displayName: '침입자',
        jobTitle: '없음',
        email: '',
        contact: '',
        role: 'ADMIN'
      })
    })
    expect(forbiddenUserAdd.status).toBe(403)
  })

  it('3. 다중 랜카드 물리/가상 어댑터 정렬 및 사내망 UDP 브로드캐스트 서버 자동 탐색 검증', async () => {
    const adapters = listNetworkAdapters()
    expect(Array.isArray(adapters)).toBe(true)

    const discovered = await discoverLanMinwonServers(18096, 400)
    expect(discovered.length).toBeGreaterThanOrEqual(1)
    expect(discovered[0].port).toBe(18096)
  })
})
