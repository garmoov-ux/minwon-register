import http from 'http'
import { URL } from 'url'
import {
  CodeCategory,
  CreateUserPayload,
  MinwonFilterQuery,
  MinwonUpsertPayload,
  TrafficDeviceUpsertPayload
} from '@shared/types/domain'
import { issueAuthSession, verifyAuthToken } from '../auth/auth-service'
import { UserRepository } from '../db/user-repo'
import { MinwonRepository } from '../db/minwon-repo'
import { DeviceRepository } from '../db/device-repo'
import { CodeRepository } from '../db/code-repo'
import {
  exportDeviceOperationStatsToExcel,
  exportMinwonRecordsToExcel
} from '../excel/excel-service'

export interface ApiRouterContext {
  userRepo: UserRepository
  minwonRepo: MinwonRepository
  deviceRepo: DeviceRepository
  codeRepo: CodeRepository
  getSnapshot: () => unknown
  onStateMutated: () => void
  allowRemoteWrite: () => boolean
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  })
  res.end(payload)
}

function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > 10 * 1024 * 1024) {
        reject(new Error('요청 본문 크기가 10MB를 초과했습니다.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8')
        resolve((raw ? JSON.parse(raw) : {}) as T)
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export async function handleApiRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  ctx: ApiRouterContext
): Promise<boolean> {
  const method = req.method || 'GET'
  const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1')
  const pathname = parsedUrl.pathname

  if (!pathname.startsWith('/api/v1/')) {
    return false
  }

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    res.end()
    return true
  }

  const clientIp = req.socket.remoteAddress || '127.0.0.1'

  try {
    // 1. 헬스 체크
    if (pathname === '/api/v1/health' && method === 'GET') {
      sendJson(res, 200, { ok: true, message: '민원접수대장 다중 접속 REST API 서버 정상 가동 중' })
      return true
    }

    // 2. 로그인 인증 (토큰 발급)
    if (pathname === '/api/v1/auth/login' && method === 'POST') {
      const body = await readJsonBody<{ username?: string; password?: string }>(req)
      const user = ctx.userRepo.authenticate(body.username || '', body.password || '')
      if (!user) {
        sendJson(res, 401, {
          ok: false,
          message: '아이디 또는 비밀번호가 일치하지 않거나 비활성화된 계정입니다.'
        })
        return true
      }

      const session = issueAuthSession(user)
      ctx.userRepo.recordAudit({
        username: user.username,
        action: '원격 로그인',
        targetType: 'AUTH',
        targetId: user.username,
        detail: `${user.displayName}(${user.role}) REST API 로그인 성공`,
        clientIp
      })
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `${user.displayName}님 환영합니다.`,
        data: session
      })
      return true
    }

    // 3. 토큰 인증 검증
    const authHeader = req.headers.authorization || parsedUrl.searchParams.get('token')
    const tokenPayload = verifyAuthToken(authHeader)
    if (!tokenPayload) {
      sendJson(res, 401, {
        ok: false,
        message: '인증 세션이 만료되었거나 유효하지 않습니다. 다시 로그인해 주세요.'
      })
      return true
    }

    const isWriteMethod = method === 'POST' || method === 'PUT' || method === 'DELETE'
    if (isWriteMethod && !ctx.allowRemoteWrite()) {
      sendJson(res, 403, {
        ok: false,
        message: '현재 서버 설정에서 원격 수정 및 등록 기능이 열람 전용으로 제한되어 있습니다.'
      })
      return true
    }

    // 4. 전체 스냅샷 조회
    if (pathname === '/api/v1/snapshot' && method === 'GET') {
      sendJson(res, 200, { ok: true, message: '스냅샷 조회 성공', data: ctx.getSnapshot() })
      return true
    }

    // 5. 비밀번호 변경
    if (pathname === '/api/v1/auth/password' && method === 'POST') {
      const body = await readJsonBody<{ oldPassword?: string; newPassword?: string }>(req)
      const ok = ctx.userRepo.changePassword(
        tokenPayload.username,
        body.oldPassword || '',
        body.newPassword || ''
      )
      if (!ok) {
        sendJson(res, 400, { ok: false, message: '현재 비밀번호가 일치하지 않습니다.' })
        return true
      }
      ctx.userRepo.recordAudit({
        username: tokenPayload.username,
        action: '비밀번호 변경',
        targetType: 'USER',
        targetId: tokenPayload.username,
        detail: '계정 비밀번호 변경 완료',
        clientIp
      })
      sendJson(res, 200, { ok: true, message: '비밀번호가 안전하게 변경되었습니다.' })
      return true
    }

    // 6. 민원접수대장 조회 / 등록 / 수정 / 삭제
    if (pathname === '/api/v1/minwon' && method === 'GET') {
      const query: MinwonFilterQuery = {
        division: (parsedUrl.searchParams.get('division') as MinwonFilterQuery['division']) || '전체',
        keyword: parsedUrl.searchParams.get('keyword') || '',
        reviewResult: parsedUrl.searchParams.get('reviewResult') || '',
        zoneType: parsedUrl.searchParams.get('zoneType') || '',
        receivedStartDate: parsedUrl.searchParams.get('receivedStartDate') || '',
        receivedEndDate: parsedUrl.searchParams.get('receivedEndDate') || '',
        reviewStartDate: parsedUrl.searchParams.get('reviewStartDate') || '',
        reviewEndDate: parsedUrl.searchParams.get('reviewEndDate') || ''
      }
      const list = ctx.minwonRepo.listRecords(query)
      sendJson(res, 200, { ok: true, message: '민원 목록 조회 완료', data: list })
      return true
    }

    if (pathname === '/api/v1/minwon' && (method === 'POST' || method === 'PUT')) {
      const body = await readJsonBody<MinwonUpsertPayload>(req)
      const isEdit = Boolean(body.id && ctx.minwonRepo.getById(body.id))
      const saved = ctx.minwonRepo.upsertRecord(body, tokenPayload.username)
      ctx.userRepo.recordAudit({
        username: tokenPayload.username,
        action: isEdit ? '민원 수정' : '민원 등록',
        targetType: 'MINWON',
        targetId: String(saved.id),
        detail: `[연번 ${saved.id}] ${saved.complainantName || '무기명'} / ${saved.location}`,
        clientIp
      })
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: isEdit
          ? `[연번 ${saved.id}] 민원 내역이 수정되었습니다.`
          : `[연번 ${saved.id}] 신규 민원이 등록되었습니다.`,
        data: saved
      })
      return true
    }

    if (pathname.startsWith('/api/v1/minwon/') && method === 'DELETE') {
      const id = Number(pathname.replace('/api/v1/minwon/', ''))
      const deleted = ctx.minwonRepo.deleteRecord(id)
      if (!deleted) {
        sendJson(res, 404, { ok: false, message: '삭제할 민원 연번을 찾을 수 없습니다.' })
        return true
      }
      ctx.userRepo.recordAudit({
        username: tokenPayload.username,
        action: '민원 삭제',
        targetType: 'MINWON',
        targetId: String(id),
        detail: `[연번 ${id}] 민원 레코드 삭제`,
        clientIp
      })
      ctx.onStateMutated()
      sendJson(res, 200, { ok: true, message: `[연번 ${id}] 민원이 삭제되었습니다.` })
      return true
    }

    // 7. 무인교통단속장비 마스터 조회 / 등록 / 수정 / 삭제
    if (pathname === '/api/v1/devices' && method === 'GET') {
      const keyword = parsedUrl.searchParams.get('keyword') || ''
      const zoneType = parsedUrl.searchParams.get('zoneType') || ''
      const enforcementType = parsedUrl.searchParams.get('enforcementType') || ''
      const list = ctx.deviceRepo.listDevices(keyword, zoneType, enforcementType)
      sendJson(res, 200, { ok: true, message: '장비 목록 조회 완료', data: list })
      return true
    }

    if (pathname === '/api/v1/devices' && (method === 'POST' || method === 'PUT')) {
      const body = await readJsonBody<TrafficDeviceUpsertPayload>(req)
      const saved = ctx.deviceRepo.upsertDevice(body)
      ctx.userRepo.recordAudit({
        username: tokenPayload.username,
        action: '장비 저장',
        targetType: 'DEVICE',
        targetId: saved.deviceId,
        detail: `[${saved.deviceId}] ${saved.deviceName} (${saved.zoneType})`,
        clientIp
      })
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `[${saved.deviceId}] 단속장비 정보가 저장되었습니다.`,
        data: saved
      })
      return true
    }

    if (pathname.startsWith('/api/v1/devices/') && method === 'DELETE') {
      const deviceId = decodeURIComponent(pathname.replace('/api/v1/devices/', ''))
      const deleted = ctx.deviceRepo.deleteDevice(deviceId)
      ctx.userRepo.recordAudit({
        username: tokenPayload.username,
        action: '장비 삭제',
        targetType: 'DEVICE',
        targetId: deviceId,
        detail: `단속장비 [${deviceId}] 삭제`,
        clientIp
      })
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: deleted,
        message: deleted ? `[${deviceId}] 장비가 삭제되었습니다.` : '삭제할 장비를 찾지 못했습니다.'
      })
      return true
    }

    // 8. 통계 조회 (민원 통계 + 무인교통단속장비 유형별 운영현황 통계)
    if (pathname === '/api/v1/stats' && method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        message: '통계 조회 완료',
        data: {
          minwonSummary: ctx.minwonRepo.getSummaryStats(),
          deviceStats: ctx.deviceRepo.computeOperationStats()
        }
      })
      return true
    }

    // 9. 코드 항목 추가 / 삭제
    if (pathname === '/api/v1/codes' && method === 'POST') {
      const body = await readJsonBody<{ category: CodeCategory; value: string }>(req)
      ctx.codeRepo.ensureCodeItem(body.category, body.value)
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `[${body.category}] '${body.value}' 항목이 등록되었습니다.`,
        data: ctx.codeRepo.getAllCodes()
      })
      return true
    }

    if (pathname === '/api/v1/codes' && method === 'DELETE') {
      const body = await readJsonBody<{ category: CodeCategory; value: string }>(req)
      ctx.codeRepo.deleteCodeItem(body.category, body.value)
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `[${body.category}] '${body.value}' 항목이 삭제되었습니다.`,
        data: ctx.codeRepo.getAllCodes()
      })
      return true
    }

    // 10. 사용자 계정 관리 (최고관리자 또는 관리자 전용)
    if (pathname === '/api/v1/users' && (method === 'POST' || method === 'PUT')) {
      if (tokenPayload.role === 'USER') {
        sendJson(res, 403, { ok: false, message: '사용자 계정 관리는 최고관리자 또는 관리자만 가능합니다.' })
        return true
      }
      const body = await readJsonBody<CreateUserPayload>(req)
      const saved = ctx.userRepo.upsertUser(body)
      ctx.userRepo.recordAudit({
        username: tokenPayload.username,
        action: '계정 저장',
        targetType: '사용자',
        targetId: saved.username,
        detail: `${saved.displayName} (${saved.jobTitle}) 계정 등록/수정`,
        clientIp
      })
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `'${saved.displayName} (${saved.username})' 계정이 저장되었습니다.`,
        data: saved
      })
      return true
    }

    if (pathname === '/api/v1/users/designate-server-admin' && method === 'POST') {
      if (tokenPayload.role !== 'SUPER_ADMIN') {
        sendJson(res, 403, { ok: false, message: '서버 구동 관리자(1명) 지정은 최고관리자만 변경할 수 있습니다.' })
        return true
      }
      const body = await readJsonBody<{ username: string }>(req)
      const designated = ctx.userRepo.designateServerAdmin(body.username || '')
      if (!designated) {
        sendJson(res, 404, { ok: false, message: '지정할 사용자 계정을 찾을 수 없습니다.' })
        return true
      }
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `'${designated.displayName} (${designated.username})' 계정이 서버 구동 관리자(1명)로 지정되었습니다.`,
        data: designated
      })
      return true
    }

    if (pathname.startsWith('/api/v1/users/') && method === 'DELETE') {
      if (tokenPayload.role !== 'SUPER_ADMIN') {
        sendJson(res, 403, { ok: false, message: '사용자 계정 삭제는 최고관리자만 가능합니다.' })
        return true
      }
      const username = decodeURIComponent(pathname.replace('/api/v1/users/', ''))
      const ok = ctx.userRepo.deleteUser(username)
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok,
        message: ok ? `'${username}' 계정이 삭제되었습니다.` : '최고관리자 기본 계정은 삭제할 수 없습니다.'
      })
      return true
    }

    // 11. 엑셀 파일(.xlsx) 다운로드 및 서버 Export 폴더 저장
    if (pathname === '/api/v1/export/minwon' && method === 'POST') {
      const body = await readJsonBody<{ query?: MinwonFilterQuery; prefix?: '전체' | '조회' }>(req)
      const records = ctx.minwonRepo.listRecords(body.query)
      const { filePath } = exportMinwonRecordsToExcel(records, body.prefix || '조회')
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `엑셀 파일이 저장되었습니다: ${filePath}`,
        data: { filePath }
      })
      return true
    }

    if (pathname === '/api/v1/export/device-stats' && method === 'POST') {
      const stats = ctx.deviceRepo.computeOperationStats()
      const { filePath } = exportDeviceOperationStatsToExcel(stats)
      ctx.onStateMutated()
      sendJson(res, 200, {
        ok: true,
        message: `단속장비 운영현황 통계 엑셀 파일이 저장되었습니다: ${filePath}`,
        data: { filePath }
      })
      return true
    }

    sendJson(res, 404, { ok: false, message: `존재하지 않는 API 경로입니다: ${pathname}` })
    return true
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      message: `서버 요청 처리 중 오류가 발생했습니다: ${(err as Error).message}`
    })
    return true
  }
}
