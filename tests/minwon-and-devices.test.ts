import path from 'path'
import { describe, expect, it } from 'vitest'
import { createDatabaseConnection } from '../src/main/db/connection'
import { UserRepository } from '../src/main/db/user-repo'
import { MinwonRepository } from '../src/main/db/minwon-repo'
import { DeviceRepository } from '../src/main/db/device-repo'
import { CodeRepository } from '../src/main/db/code-repo'
import { computeQuickDateRange } from '../src/shared/date-ranges'
import { buildStandardXlsxBuffer } from '../src/main/excel/excel-service'

describe('MinwonRegister 도메인 로직 및 단속장비 487대 통계 정합성 테스트', () => {
  const csvPath = path.resolve(__dirname, '../_ref_VBA/device.csv')

  it('device.csv(487대) 시드 적재 및 operator-status.xlsx 통계 매트릭스 100% 일치 검증', () => {
    const db = createDatabaseConnection(':memory:', {
      seed: true,
      customCsvPath: csvPath
    })
    const deviceRepo = new DeviceRepository(db)

    expect(deviceRepo.getTotalCount()).toBe(487)

    const stats = deviceRepo.computeOperationStats()
    // operator-status.xlsx Row 17 합계 행과 100% 동일한지 검증
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

    // 2013년(첫 행) 및 2023년 데이터 정합성 검증
    const row2013 = stats.rows.find((r) => r.installYear === 2013)
    expect(row2013?.totalCount).toBe(2)
    expect(row2013?.fixedSignalSpeed).toBe(2)

    const row2023 = stats.rows.find((r) => r.installYear === 2023)
    expect(row2023?.totalCount).toBe(114)
    expect(row2023?.zoneChild).toBe(56)

    db.close()
  })

  it('민원접수대장 CRUD, 신규 접수구분 코드 자동 등록, 복합 검색 필터 검증', () => {
    const db = createDatabaseConnection(':memory:', { seed: true, customCsvPath: csvPath })
    const minwonRepo = new MinwonRepository(db)
    const codeRepo = new CodeRepository(db)

    const created = minwonRepo.upsertRecord(
      {
        receivedDate: '2026-11-05',
        receptionType: '제주도청이첩', // 기존 목록에 없는 신규 접수구분
        receptionNo: '2026-JEJU-001',
        complainantName: '홍길동',
        contact: '010-1234-5678',
        location: '제주시 도평동 781-1 도평초교입구 사거리',
        zoneType: '어린이보호구역',
        content: '어린이보호구역 신호과속 단속카메라 신규 설치 요청',
        reviewDate: '2026-11-10',
        reviewResult: '신규설치',
        improvementResult: '2027년 상반기 설치 예정 반영',
        note: 'B9119 인접',
        deviceId: 'B9119'
      },
      'admin'
    )

    expect(created.id).toBe(1)
    expect(created.complainantName).toBe('홍길동')

    // 신규 접수구분이 코드 테이블에 자동 추가되었는지 확인 (VBA AddListboxItem 호환)
    const allCodes = codeRepo.getAllCodes()
    expect(allCodes.접수구분).toContain('제주도청이첩')

    // 두 번째 민원 등록
    minwonRepo.upsertRecord(
      {
        receivedDate: '2026-08-15',
        receptionType: '전화민원',
        receptionNo: '2026-TEL-002',
        complainantName: '김철수',
        contact: '010-9999-8888',
        location: '서귀포시 서귀동 336 중앙로터리',
        zoneType: '일반구역',
        content: '제한속도 표지판 가림 정비 요청',
        reviewDate: '',
        reviewResult: '검토중',
        improvementResult: '',
        note: ''
      },
      'operator'
    )

    // 1. 이름 검색
    const searchByName = minwonRepo.listRecords({ division: '이름', keyword: '홍길동' })
    expect(searchByName.length).toBe(1)
    expect(searchByName[0].receptionNo).toBe('2026-JEJU-001')

    // 2. 공단 검토결과 필터
    const searchByResult = minwonRepo.listRecords({ reviewResult: '검토중' })
    expect(searchByResult.length).toBe(1)
    expect(searchByResult[0].complainantName).toBe('김철수')

    // 3. 접수일자 기간 필터
    const searchByDate = minwonRepo.listRecords({
      receivedStartDate: '2026-11-01',
      receivedEndDate: '2026-11-30'
    })
    expect(searchByDate.length).toBe(1)
    expect(searchByDate[0].id).toBe(1)

    // 4. 통계 요약 검증
    const summary = minwonRepo.getSummaryStats()
    expect(summary.totalMinwonCount).toBe(2)
    expect(summary.pendingReviewCount).toBe(1)
    expect(summary.completedReviewCount).toBe(1)

    db.close()
  })

  it('VBA frmSearch.GetStartAndEndDate 빠른 기간 계산 및 표준 엑셀(.xlsx) 바이너리 생성 검증', () => {
    const refDate = new Date(2026, 10, 19) // 2026-11-19
    const thisMonth = computeQuickDateRange('THIS_MONTH', refDate)
    expect(thisMonth.startDate).toBe('2026-11-01')
    expect(thisMonth.endDate).toBe('2026-11-30')

    const thisYear = computeQuickDateRange('THIS_YEAR', refDate)
    expect(thisYear.startDate).toBe('2026-01-01')
    expect(thisYear.endDate).toBe('2026-12-31')

    const buf = buildStandardXlsxBuffer({
      sheetName: '전체',
      headers: ['연번', '접수일자', '이름'],
      rows: [[1, '2026-11-19', '강홍선']]
    })
    // ZIP Local File Header Magic signature (PK\x03\x04) 확인
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
    expect(buf.length).toBeGreaterThan(500)
  })
})
