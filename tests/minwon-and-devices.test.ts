import path from 'path'
import { describe, expect, it } from 'vitest'
import { createDatabaseConnection } from '../src/main/db/connection'
import { UserRepository } from '../src/main/db/user-repo'
import { MinwonRepository } from '../src/main/db/minwon-repo'
import { DeviceRepository } from '../src/main/db/device-repo'
import { CodeRepository } from '../src/main/db/code-repo'
import {
  buildDevicesCsvContent,
  convertExcelSerialToIsoDate,
  validateAndImportDevicesCsvBuffer
} from '../src/main/db/seed'
import iconv from 'iconv-lite'
import { computeQuickDateRange, generateJspdDocumentNo } from '../src/shared/date-ranges'
import { buildStandardXlsxBuffer } from '../src/main/excel/excel-service'

describe('MinwonRegister 도메인 로직, datadb.csv(114건), 단속장비 487대 통계 정합성 테스트', () => {
  const deviceCsvPath = path.resolve(__dirname, '../_ref_VBA/device.csv')
  const minwonCsvPath = path.resolve(__dirname, '../_ref_VBA/datadb.csv')

  it('1. device.csv(487대) 및 datadb.csv(114건) 시드 적재와 operator-status.xlsx 통계 100% 일치 검증', () => {
    const db = createDatabaseConnection(':memory:', {
      seed: true,
      customCsvPath: deviceCsvPath,
      customMinwonCsvPath: minwonCsvPath,
      seedMinwon: true
    })
    const deviceRepo = new DeviceRepository(db)
    const minwonRepo = new MinwonRepository(db)

    // 단속장비 487대 확인
    expect(deviceRepo.getTotalCount()).toBe(487)

    // 기존 민원접수대장 datadb.csv 114건 자동 적재 확인
    const allMinwon = minwonRepo.listRecords()
    expect(allMinwon.length).toBe(114)

    // Excel 일련번호 날짜 변환 확인 (46027 -> 2026-01-05)
    expect(convertExcelSerialToIsoDate('46027')).toBe('2026-01-05')
    const firstRecord = minwonRepo.getById(1)
    expect(firstRecord?.complainantName).toBe('고방실')
    expect(firstRecord?.receivedDate).toBe('2026-01-05')
    expect(firstRecord?.receptionNo).toBe('JSPD-2026-01-05-01')
    expect(firstRecord?.reviewDate).toBe('2026-02-03')
    expect(firstRecord?.reviewResult).toBe('불합리')

    // 동일 날짜(2026-01-22) 민원 2건(연번 5, 6)이 JSPD-2026-01-22-01, 02로 정규화되었는지 확인
    expect(minwonRepo.getById(5)?.receptionNo).toBe('JSPD-2026-01-22-01')
    expect(minwonRepo.getById(6)?.receptionNo).toBe('JSPD-2026-01-22-02')

    // 단속장비 CSV 내보내기(UTF-8 BOM) 및 가져오기(CP949 / 필드 불일치 오류 검증)
    const allDevices = deviceRepo.listDevices()
    const csvText = buildDevicesCsvContent(allDevices.slice(0, 3))
    expect(csvText.startsWith('\uFEFF설치년도,장비번호,장비명,위치,제조사,유형,단속종류,제한속도,보호구역명')).toBe(
      true
    )

    // 윈도우 엑셀 CP949 인코딩으로 저장된 CSV 가져오기 테스트
    const cp949Buf = iconv.encode(csvText.replace(/^\uFEFF/, ''), 'cp949')
    const importOk = validateAndImportDevicesCsvBuffer(db, cp949Buf)
    expect(importOk.ok).toBe(true)
    expect(importOk.count).toBe(3)

    // 필드가 맞지 않는 잘못된 CSV 가져오기 시 오류 반환 검증
    const badCsvBuf = Buffer.from('연번,잘못된헤더,위치\n1,테스트,제주', 'utf-8')
    const importFail = validateAndImportDevicesCsvBuffer(db, badCsvBuf)
    expect(importFail.ok).toBe(false)
    expect(importFail.errorDetail).toContain('9개 열')

    const stats = deviceRepo.computeOperationStats()
    expect(stats.totals.totalCount).toBe(487)
    expect(stats.totals.zoneGeneral).toBe(221)
    expect(stats.totals.zoneChild).toBe(237)
    expect(stats.totals.zoneElder).toBe(28)
    expect(stats.totals.zoneDisabled).toBe(1)

    expect(stats.totals.fixedSignalSpeed).toBe(204)
    expect(stats.totals.fixedSpeed).toBe(233)
    expect(stats.totals.fixedSection).toBe(27)
    expect(stats.totals.fixedRestriction).toBe(2)
    expect(stats.totals.fixedNoEntry).toBe(2)
    expect(stats.totals.mobileSpeed).toBe(19)

    db.close()
  })

  it('2. 최고관리자(admin) 외 지정 관리자 1명 서버 구동 권한 부여 및 사용자 프로필(직책/이메일/연락처) 검증', () => {
    const db = createDatabaseConnection(':memory:', {
      seed: true,
      customCsvPath: deviceCsvPath,
      seedMinwon: false
    })
    const userRepo = new UserRepository(db)

    const users = userRepo.listUsers()
    expect(users.length).toBe(3)

    const superAdmin = userRepo.getUserByUsername('admin')
    expect(superAdmin?.role).toBe('SUPER_ADMIN')
    expect(superAdmin?.canToggleServer).toBe(true)

    const manager = userRepo.getUserByUsername('manager')
    expect(manager?.role).toBe('ADMIN')
    expect(manager?.canToggleServer).toBe(true)
    expect(manager?.jobTitle).toBe('교통시설관리 팀장')

    const normalUser = userRepo.getUserByUsername('user1')
    expect(normalUser?.role).toBe('USER')
    expect(normalUser?.canToggleServer).toBe(false)

    // 새로운 관리자(subadmin)를 지정 관리자로 설정하면 기존 manager의 서버 구동 권한은 자동 해제되어 admin 외 1명만 유지됨
    userRepo.upsertUser({
      username: 'subadmin',
      password: 'sub1234',
      displayName: '박관제',
      jobTitle: '교통안전 계장',
      email: 'park@jeju.go.kr',
      contact: '010-2222-3333',
      role: 'ADMIN',
      canToggleServer: true
    })

    const afterManager = userRepo.getUserByUsername('manager')
    const afterSubAdmin = userRepo.getUserByUsername('subadmin')
    expect(afterManager?.canToggleServer).toBe(false)
    expect(afterSubAdmin?.canToggleServer).toBe(true)

    // non-super-admin 중 canToggleServer가 true인 계정이 정확히 1명인지 검증
    const serverAdminsExcludingSuper = userRepo
      .listUsers()
      .filter((u) => u.role !== 'SUPER_ADMIN' && u.canToggleServer)
    expect(serverAdminsExcludingSuper.length).toBe(1)
    expect(serverAdminsExcludingSuper[0].username).toBe('subadmin')

    db.close()
  })

  it('3. 민원접수대장 CRUD, 신규 접수구분 코드 자동 등록, 복합 검색 필터 검증', () => {
    const db = createDatabaseConnection(':memory:', {
      seed: true,
      customCsvPath: deviceCsvPath,
      seedMinwon: false
    })
    const minwonRepo = new MinwonRepository(db)
    const codeRepo = new CodeRepository(db)

    const created = minwonRepo.upsertRecord(
      {
        receivedDate: '2026-11-05',
        receptionType: '제주도청이첩',
        receptionNo: '2026-JEJU-001',
        complainantName: '홍길동',
        contact: '010-1234-5678',
        location: '제주시 도평동 781-1 도평초교입구 사거리',
        zoneType: '어린이보호구역',
        content: '어린이보호구역 신호과속 단속카메라 신규 설치 요청',
        reviewDate: '2026-11-10',
        reviewResult: '적합',
        improvementResult: '2027년 상반기 설치 예정 반영',
        note: 'B9119 인접',
        deviceId: 'B9119'
      },
      'admin'
    )

    expect(created.id).toBe(1)
    expect(created.complainantName).toBe('홍길동')

    const allCodes = codeRepo.getAllCodes()
    expect(allCodes.접수구분).toContain('제주도청이첩')

    const refDate = new Date(2026, 10, 19)
    const thisMonth = computeQuickDateRange('THIS_MONTH', refDate)
    expect(thisMonth.startDate).toBe('2026-11-01')
    expect(thisMonth.endDate).toBe('2026-11-30')

    // 관공서 문서번호(JSPD-YYYY-MM-DD-01, 02, 03) 자동 생성 검증
    const docNo1 = generateJspdDocumentNo('2026-11-19', [])
    expect(docNo1).toBe('JSPD-2026-11-19-01')

    const docNo2 = generateJspdDocumentNo('2026-11-19', [
      { receivedDate: '2026-11-19', receptionNo: 'JSPD-2026-11-19-01' }
    ])
    expect(docNo2).toBe('JSPD-2026-11-19-02')

    const docNo3 = generateJspdDocumentNo('2026-11-19', [
      { receivedDate: '2026-11-19', receptionNo: 'JSPD-2026-11-19-01' },
      { receivedDate: '2026-11-19', receptionNo: 'JSPD-2026-11-19-02' }
    ])
    expect(docNo3).toBe('JSPD-2026-11-19-03')

    const buf = buildStandardXlsxBuffer({
      sheetName: '전체',
      headers: ['연번', '접수일자', '이름'],
      rows: [[1, '2026-11-19', '강홍선']]
    })
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)

    db.close()
  })
})
