import React, { useEffect, useState } from 'react'
import {
  Calendar,
  Download,
  Edit3,
  FilePlus2,
  FileSpreadsheet,
  Filter,
  RotateCcw,
  Search,
  Trash2
} from 'lucide-react'
import {
  CodeCategory,
  MinwonFilterQuery,
  MinwonRecord,
  MinwonSummaryStats,
  QuickDatePeriod,
  SearchFieldDivision
} from '@shared/types/domain'
import { computeQuickDateRange } from '@shared/date-ranges'
import { unifiedApiClient } from '../../services/api-client'
import { PillButton } from '../../components/ui/PillButton'
import { OptionChip } from '../../components/ui/OptionChip'

interface MinwonLedgerViewProps {
  codes: Record<CodeCategory, string[]>
  summary: MinwonSummaryStats
  canWrite: boolean
  refreshTick: number
  onSelectEdit: (record: MinwonRecord) => void
  onGoNewRegister: () => void
  onDeleteRecord: (id: number) => Promise<void>
  onShowToast: (msg: string) => void
}

const SEARCH_DIVISIONS: SearchFieldDivision[] = [
  '전체',
  '접수구분',
  '접수번호',
  '이름',
  '연락처',
  '위치',
  '구역구분',
  '민원내용',
  '개선결과',
  '비고'
]

const QUICK_PERIODS: Array<{ id: QuickDatePeriod; label: string }> = [
  { id: 'ALL', label: '전체' },
  { id: 'THIS_MONTH', label: '당월' },
  { id: '3_MONTHS', label: '3개월' },
  { id: '6_MONTHS', label: '6개월' },
  { id: '9_MONTHS', label: '9개월' },
  { id: 'THIS_YEAR', label: '금년' }
]

const RESULT_BADGE_MAP: Record<string, string> = {
  신규설치: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]',
  이설검토: 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]',
  기존운영: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]',
  수리완료: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]',
  설치불가: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
  지자체이관: 'bg-[#f3e8ff] text-[#7e22ce] border-[#e9d5ff]',
  검토중: 'bg-[#f1f5f9] text-[#475569] border-[#cbd5e1]'
}

export const MinwonLedgerView: React.FC<MinwonLedgerViewProps> = ({
  codes,
  summary,
  canWrite,
  refreshTick,
  onSelectEdit,
  onGoNewRegister,
  onDeleteRecord,
  onShowToast
}) => {
  const [records, setRecords] = useState<MinwonRecord[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [division, setDivision] = useState<SearchFieldDivision>('전체')
  const [keyword, setKeyword] = useState<string>('')
  const [reviewResult, setReviewResult] = useState<string>('전체')
  const [zoneType, setZoneType] = useState<string>('전체')

  const [receivedPeriod, setReceivedPeriod] = useState<QuickDatePeriod>('ALL')
  const [receivedStartDate, setReceivedStartDate] = useState<string>('')
  const [receivedEndDate, setReceivedEndDate] = useState<string>('')

  const [reviewPeriod, setReviewPeriod] = useState<QuickDatePeriod>('ALL')
  const [reviewStartDate, setReviewStartDate] = useState<string>('')
  const [reviewEndDate, setReviewEndDate] = useState<string>('')

  const currentQuery: MinwonFilterQuery = {
    division,
    keyword,
    reviewResult: reviewResult === '전체' ? '' : reviewResult,
    zoneType: zoneType === '전체' ? '' : zoneType,
    receivedStartDate,
    receivedEndDate,
    reviewStartDate,
    reviewEndDate
  }

  const fetchList = async (q: MinwonFilterQuery = currentQuery): Promise<void> => {
    const list = await unifiedApiClient.listMinwon(q)
    setRecords(list)
  }

  useEffect(() => {
    void fetchList()
  }, [
    refreshTick,
    division,
    reviewResult,
    zoneType,
    receivedStartDate,
    receivedEndDate,
    reviewStartDate,
    reviewEndDate
  ])

  const handleApplyReceivedPeriod = (p: QuickDatePeriod): void => {
    setReceivedPeriod(p)
    const { startDate, endDate } = computeQuickDateRange(p)
    setReceivedStartDate(startDate)
    setReceivedEndDate(endDate)
  }

  const handleApplyReviewPeriod = (p: QuickDatePeriod): void => {
    setReviewPeriod(p)
    const { startDate, endDate } = computeQuickDateRange(p)
    setReviewStartDate(startDate)
    setReviewEndDate(endDate)
  }

  const handleResetFilters = (): void => {
    setDivision('전체')
    setKeyword('')
    setReviewResult('전체')
    setZoneType('전체')
    setReceivedPeriod('ALL')
    setReceivedStartDate('')
    setReceivedEndDate('')
    setReviewPeriod('ALL')
    setReviewStartDate('')
    setReviewEndDate('')
    void fetchList({})
  }

  const handleExportFiltered = async (): Promise<void> => {
    const res = await unifiedApiClient.exportMinwonExcel({
      query: currentQuery,
      prefix: '조회'
    })
    onShowToast(res.message)
  }

  const handleExportAll = async (): Promise<void> => {
    const res = await unifiedApiClient.exportMinwonExcel({
      query: {},
      prefix: '전체'
    })
    onShowToast(res.message)
  }

  return (
    <div className="h-full p-3.5 w-full min-h-0 flex flex-col gap-2.5">
      {/* 상단 요약 카드 4종 + 우측 빠른 액션 버튼 */}
      <div className="grid grid-cols-12 gap-2.5 shrink-0">
        <div className="col-span-2 rounded-[9px] bg-white border border-[#cbd5e1] px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#64748b] font-medium">총 누적 민원</div>
            <div className="text-[17px] font-extrabold text-[#0f172a] leading-tight mt-0.5">
              {summary.totalMinwonCount.toLocaleString()}
              <span className="text-[11.5px] font-semibold text-[#64748b] ml-0.5">건</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#2563eb] text-[10.5px] font-bold">
            전체
          </span>
        </div>

        <div className="col-span-2 rounded-[9px] bg-white border border-[#cbd5e1] px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#64748b] font-medium">이번 달 접수</div>
            <div className="text-[17px] font-extrabold text-[#2563eb] leading-tight mt-0.5">
              {summary.thisMonthCount.toLocaleString()}
              <span className="text-[11.5px] font-semibold text-[#64748b] ml-0.5">건</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-[5px] bg-[#f8fafc] border border-[#cbd5e1] text-[#334155] text-[10.5px] font-bold">
            당월
          </span>
        </div>

        <div className="col-span-2 rounded-[9px] bg-white border border-[#cbd5e1] px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#64748b] font-medium">공단 검토 대기</div>
            <div className="text-[17px] font-extrabold text-[#d97706] leading-tight mt-0.5">
              {summary.pendingReviewCount.toLocaleString()}
              <span className="text-[11.5px] font-semibold text-[#64748b] ml-0.5">건</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-[5px] bg-[#fef3c7] text-[#b45309] text-[10.5px] font-bold">
            검토중
          </span>
        </div>

        <div className="col-span-2 rounded-[9px] bg-white border border-[#cbd5e1] px-3 py-2 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-[#64748b] font-medium">검토/조치 완료</div>
            <div className="text-[17px] font-extrabold text-[#059669] leading-tight mt-0.5">
              {summary.completedReviewCount.toLocaleString()}
              <span className="text-[11.5px] font-semibold text-[#64748b] ml-0.5">건</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-[5px] bg-[#ecfdf5] text-[#047857] text-[10.5px] font-bold">
            완료
          </span>
        </div>

        <div className="col-span-4 rounded-[9px] bg-[#0f172a] text-white border border-[#1e293b] px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-slate-400">현재 조회 결과</div>
            <div className="text-[15px] font-extrabold text-white">
              {records.length.toLocaleString()}건 표시 중
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <PillButton variant="pearl-capsule" size="sm" onClick={() => void handleExportFiltered()}>
              <Download className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>조회결과 엑셀</span>
            </PillButton>
            <PillButton variant="secondary-pill" size="sm" onClick={() => void handleExportAll()}>
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>전체 엑셀</span>
            </PillButton>
            {canWrite && (
              <PillButton variant="primary" size="sm" onClick={onGoNewRegister}>
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>신규 등록</span>
              </PillButton>
            )}
          </div>
        </div>
      </div>

      {/* 복합 검색 및 날짜 필터 바 (기존 VBA frmSearch 완벽 계승) */}
      <div className="rounded-[10px] bg-white border border-[#cbd5e1] p-2.5 shrink-0 space-y-2">
        {/* 1행: 검색구분, 키워드, 공단 검토결과, 구역구분 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#2563eb]" />
            <span className="text-[11.5px] font-bold text-[#334155]">검색구분</span>
            <select
              value={division}
              onChange={(e) => setDivision(e.target.value as SearchFieldDivision)}
              className="h-[28px] px-2 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] text-[12px] font-medium text-[#0f172a]"
            >
              {SEARCH_DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d === '전체' ? '-- 전체 --' : d}
                </option>
              ))}
            </select>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void fetchList()
            }}
            className="flex items-center gap-1.5 flex-1 min-w-[200px]"
          >
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="민원인 이름, 위치, 접수번호, 민원내용, 연락처 검색 (Enter)"
                className="w-full h-[28px] pl-7.5 pr-2.5 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px] text-[#0f172a] focus:outline-2 focus:outline-[#2563eb]"
              />
            </div>
            <PillButton type="submit" variant="primary" size="sm">
              조회
            </PillButton>
          </form>

          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-bold text-[#334155]">공단 검토결과</span>
            <select
              value={reviewResult}
              onChange={(e) => setReviewResult(e.target.value)}
              className="h-[28px] px-2 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] text-[12px] font-medium text-[#0f172a]"
            >
              <option value="전체">-- 전체 --</option>
              {codes.검토결과.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] font-bold text-[#334155]">구역구분</span>
            <select
              value={zoneType}
              onChange={(e) => setZoneType(e.target.value)}
              className="h-[28px] px-2 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] text-[12px] font-medium text-[#0f172a]"
            >
              <option value="전체">-- 전체 --</option>
              {codes.구역구분.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <PillButton variant="pearl-capsule" size="sm" onClick={handleResetFilters}>
            <RotateCcw className="w-3.5 h-3.5 text-[#64748b]" />
            <span>초기화</span>
          </PillButton>
        </div>

        {/* 2행: 접수일자 빠른 기간 & 공단 검토일자 빠른 기간 */}
        <div className="grid grid-cols-12 gap-2 pt-1.5 border-t border-[#e2e8f0] text-[11.5px]">
          <div className="col-span-6 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold text-[#334155] w-[66px]">
              <Calendar className="w-3.5 h-3.5 text-[#2563eb]" />
              접수일자
            </span>
            <div className="flex items-center gap-1">
              {QUICK_PERIODS.map((p) => (
                <OptionChip
                  key={p.id}
                  label={p.label}
                  selected={receivedPeriod === p.id}
                  onClick={() => handleApplyReceivedPeriod(p.id)}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="date"
                value={receivedStartDate}
                onChange={(e) => {
                  setReceivedPeriod('ALL')
                  setReceivedStartDate(e.target.value)
                }}
                onDoubleClick={() => setReceivedStartDate('')}
                title="더블클릭 시 날짜 초기화"
                className="h-[26px] px-1.5 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] text-[11.5px]"
              />
              <span className="text-[#64748b]">~</span>
              <input
                type="date"
                value={receivedEndDate}
                onChange={(e) => {
                  setReceivedPeriod('ALL')
                  setReceivedEndDate(e.target.value)
                }}
                onDoubleClick={() => setReceivedEndDate('')}
                title="더블클릭 시 날짜 초기화"
                className="h-[26px] px-1.5 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] text-[11.5px]"
              />
            </div>
          </div>

          <div className="col-span-6 flex items-center gap-1.5 flex-wrap border-l border-[#e2e8f0] pl-2.5">
            <span className="inline-flex items-center gap-1 font-bold text-[#334155] w-[66px]">
              <Calendar className="w-3.5 h-3.5 text-[#059669]" />
              검토일자
            </span>
            <div className="flex items-center gap-1">
              {QUICK_PERIODS.map((p) => (
                <OptionChip
                  key={p.id}
                  label={p.label}
                  selected={reviewPeriod === p.id}
                  onClick={() => handleApplyReviewPeriod(p.id)}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="date"
                value={reviewStartDate}
                onChange={(e) => {
                  setReviewPeriod('ALL')
                  setReviewStartDate(e.target.value)
                }}
                onDoubleClick={() => setReviewStartDate('')}
                title="더블클릭 시 날짜 초기화"
                className="h-[26px] px-1.5 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] text-[11.5px]"
              />
              <span className="text-[#64748b]">~</span>
              <input
                type="date"
                value={reviewEndDate}
                onChange={(e) => {
                  setReviewPeriod('ALL')
                  setReviewEndDate(e.target.value)
                }}
                onDoubleClick={() => setReviewEndDate('')}
                title="더블클릭 시 날짜 초기화"
                className="h-[26px] px-1.5 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] text-[11.5px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 단일 테두리 시트: 13개 필드 민원접수대장 고밀도 테이블 */}
      <div className="flex-1 min-h-0 bg-[#ffffff] border border-[#cbd5e1] rounded-[10px] overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1] text-[11.5px] font-bold">
              <tr>
                <th className="py-2 px-2 text-center w-[46px]">연번</th>
                <th className="py-2 px-2 text-center w-[86px]">접수일자</th>
                <th className="py-2 px-2 text-center w-[78px]">접수구분</th>
                <th className="py-2 px-2 w-[92px]">접수번호</th>
                <th className="py-2 px-2 text-center w-[68px]">이름</th>
                <th className="py-2 px-2 w-[98px]">연락처</th>
                <th className="py-2 px-2 w-[170px]">위치</th>
                <th className="py-2 px-2 text-center w-[88px]">구역구분</th>
                <th className="py-2 px-2 min-w-[160px]">민원내용</th>
                <th className="py-2 px-2 text-center w-[86px]">공단 검토일자</th>
                <th className="py-2 px-2 text-center w-[84px]">공단 검토결과</th>
                <th className="py-2 px-2 w-[120px]">개선결과</th>
                <th className="py-2 px-2 w-[85px]">비고</th>
                {canWrite && <th className="py-2 px-2 text-center w-[68px]">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {records.length === 0 ? (
                <tr>
                  <td
                    colSpan={canWrite ? 14 : 13}
                    className="py-16 text-center text-[#64748b] text-[13px]"
                  >
                    조회된 민원접수 내역이 없습니다. 우측 상단의 [신규 등록] 버튼으로 민원을 등록해 보세요.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const isSelected = selectedId === r.id
                  const badgeCls =
                    RESULT_BADGE_MAP[r.reviewResult] ||
                    'bg-[#f8fafc] text-[#334155] border-[#cbd5e1]'

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      onDoubleClick={() => onSelectEdit(r)}
                      title="더블클릭 시 상세 편집 화면으로 이동합니다"
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#fef2f2] font-semibold'
                          : 'hover:bg-[#f8fafc]'
                      }`}
                    >
                      <td className="py-2 px-2 text-center font-bold text-[#0f172a]">{r.id}</td>
                      <td className="py-2 px-2 text-center text-[#334155] whitespace-nowrap">
                        {r.receivedDate}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded-[4px] bg-[#f1f5f9] border border-[#cbd5e1] text-[11px] font-medium text-[#334155]">
                          {r.receptionType || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-[#334155] truncate max-w-[92px]" title={r.receptionNo}>
                        {r.receptionNo || '-'}
                      </td>
                      <td className="py-2 px-2 text-center font-semibold text-[#0f172a]">
                        {r.complainantName || '-'}
                      </td>
                      <td className="py-2 px-2 text-[#334155] whitespace-nowrap">
                        {r.contact || '-'}
                      </td>
                      <td className="py-2 px-2 text-[#0f172a] truncate max-w-[170px]" title={r.location}>
                        {r.location || '-'}
                      </td>
                      <td className="py-2 px-2 text-center text-[11px] text-[#475569] whitespace-nowrap">
                        {r.zoneType || '일반구역'}
                      </td>
                      <td className="py-2 px-2 text-[#334155] truncate max-w-[200px]" title={r.content}>
                        {r.content || '-'}
                      </td>
                      <td className="py-2 px-2 text-center text-[#334155] whitespace-nowrap">
                        {r.reviewDate || '-'}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-[5px] border text-[11px] font-semibold whitespace-nowrap ${badgeCls}`}
                        >
                          {r.reviewResult || '검토중'}
                        </span>
                      </td>
                      <td
                        className="py-2 px-2 text-[#334155] truncate max-w-[120px]"
                        title={r.improvementResult}
                      >
                        {r.improvementResult || '-'}
                      </td>
                      <td className="py-2 px-2 text-[#64748b] truncate max-w-[85px]" title={r.note}>
                        {r.note || (r.deviceId ? `[${r.deviceId}]` : '-')}
                      </td>
                      {canWrite && (
                        <td
                          className="py-1.5 px-2 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onSelectEdit(r)}
                              title="민원 수정"
                              className="p-1 rounded-[5px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteRecord(r.id)}
                              title="민원 삭제"
                              className="p-1 rounded-[5px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
