import { QuickDatePeriod } from './types/domain'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * 관공서 표준 문서(접수)번호 자동 생성: JSPD-YYYY-MM-DD-01, 02, 03...
 */
export function generateJspdDocumentNo(
  receivedDate: string,
  existingRecords: Array<{ receivedDate: string; receptionNo: string }>
): string {
  const cleanDate =
    /^\d{4}-\d{2}-\d{2}$/.test((receivedDate || '').trim())
      ? receivedDate.trim()
      : formatIsoDate(new Date())

  const prefix = `JSPD-${cleanDate}-`
  let maxSeq = 0
  let sameDateCount = 0

  for (const r of existingRecords) {
    const no = (r.receptionNo || '').trim()
    if (no.startsWith(prefix)) {
      const tail = Number(no.slice(prefix.length))
      if (Number.isFinite(tail) && tail > maxSeq) {
        maxSeq = tail
      }
    }
    if (r.receivedDate === cleanDate) {
      sameDateCount += 1
    }
  }

  const nextSeq = Math.max(maxSeq, sameDateCount) + 1
  return `${prefix}${pad2(nextSeq)}`
}

/**
 * 기존 VBA frmSearch.GetStartAndEndDate(period) 완벽 호환 날짜 계산
 */
export function computeQuickDateRange(
  period: QuickDatePeriod,
  referenceDate: Date = new Date()
): { startDate: string; endDate: string } {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth() // 0-based

  switch (period) {
    case 'THIS_YEAR': {
      // 금년: 1월 1일 ~ 12월 31일
      return {
        startDate: formatIsoDate(new Date(year, 0, 1)),
        endDate: formatIsoDate(new Date(year, 11, 31))
      }
    }
    case 'THIS_MONTH': {
      // 당월: 이번 달 1일 ~ 이번 달 말일
      return {
        startDate: formatIsoDate(new Date(year, month, 1)),
        endDate: formatIsoDate(new Date(year, month + 1, 0))
      }
    }
    case '3_MONTHS': {
      // 3개월: 3개월 전 1일 ~ 이번 달 말일 (VBA DateSerial(intYear, intMonth - 3, 1))
      return {
        startDate: formatIsoDate(new Date(year, month - 3, 1)),
        endDate: formatIsoDate(new Date(year, month + 1, 0))
      }
    }
    case '6_MONTHS': {
      return {
        startDate: formatIsoDate(new Date(year, month - 6, 1)),
        endDate: formatIsoDate(new Date(year, month + 1, 0))
      }
    }
    case '9_MONTHS': {
      return {
        startDate: formatIsoDate(new Date(year, month - 9, 1)),
        endDate: formatIsoDate(new Date(year, month + 1, 0))
      }
    }
    case 'ALL':
    default:
      return { startDate: '', endDate: '' }
  }
}
