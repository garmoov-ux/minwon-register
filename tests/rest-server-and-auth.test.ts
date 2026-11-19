import path from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabaseConnection } from '../src/main/db/connection'
import { UserRepository } from '../src/main/db/user-repo'
import { MinwonRepository } from '../src/main/db/minwon-repo'
import { DeviceRepository } from '../src/main/db/device-repo'
import { CodeRepository } from '../src/main/db/code-repo'
import { EmbeddedRestServer } from '../src/main/server/rest-server'

describe('내장 다중 사용자 REST API 서버 및 로그인 인증(RBAC) 통합 테스트', () => {
  const csvPath = path.resolve(__dirname, '../_ref_VBA/device.csv')
  const db = createDatabaseConnection(':memory:', { seed: true, customCsvPath: csvPath })
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
    // 테스트용 임시 포트 기동
    const testPort = 18095
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

  it('2. 관리자(admin) 로그인 토큰 발급 및 원격 민원 등록·조회·수정·삭제 검증', async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
    })
    expect(loginRes.status).toBe(401)

    const validLoginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin1234' })
    })
    expect(validLoginRes.status).toBe(200)
    const loginBody = (await validLoginRes.json()) as {
      ok: boolean
      data: { token: string; user: { username: string; role: string } }
    }
    expect(loginBody.ok).toBe(true)
    expect(loginBody.data.user.role).toBe('ADMIN')

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
        receptionNo: 'REST-2026-001',
        complainantName: '이순신',
        contact: '010-7777-1111',
        location: '서귀포시 안덕면 상창리 1978-1',
        zoneType: '일반구역',
        content: 'REST API 원격 접속 민원 등록 테스트',
        reviewDate: '2026-11-19',
        reviewResult: '기존운영',
        improvementResult: '정상 가동 안내 완료',
        note: 'B7272'
      })
    })
    expect(createRes.status).toBe(200)
    const createdBody = (await createRes.json()) as { ok: boolean; data: { id: number } }
    expect(createdBody.ok).toBe(true)
    expect(createdBody.data.id).toBe(1)

    // 원격 민원 목록 조회
    const listRes = await fetch(`${baseUrl}/api/v1/minwon?keyword=이순신`, {
      headers: authHeaders
    })
    expect(listRes.status).toBe(200)
    const listBody = (await listRes.json()) as { ok: boolean; data: Array<{ complainantName: string }> }
    expect(listBody.data.length).toBe(1)
    expect(listBody.data[0].complainantName).toBe('이순신')

    // 열람자(viewer) 로그인 후 쓰기 차단(403) 검증
    const viewerLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'viewer', password: 'view1234' })
    })
    const viewerBody = (await viewerLogin.json()) as { data: { token: string } }
    const viewerDeleteRes = await fetch(`${baseUrl}/api/v1/minwon/1`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${viewerBody.data.token}` }
    })
    expect(viewerDeleteRes.status).toBe(403)
  })
})
