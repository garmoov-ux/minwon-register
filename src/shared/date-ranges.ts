import { QuickDatePeriod } from './types/domain'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
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
