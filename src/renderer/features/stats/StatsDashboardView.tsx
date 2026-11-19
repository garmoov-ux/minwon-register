import React from 'react'
import { BarChart3, CheckCircle2, FileSpreadsheet, PieChart, Radio, TrendingUp } from 'lucide-react'
import { DeviceOperationStats, MinwonSummaryStats } from '@shared/types/domain'
import { UtilityCard } from '../../components/ui/UtilityCard'
import { PillButton } from '../../components/ui/PillButton'

interface StatsDashboardViewProps {
  minwonSummary: MinwonSummaryStats
  deviceStats: DeviceOperationStats
  onExportMinwonExcel: () => Promise<void>
  onExportDeviceStatsExcel: () => Promise<void>
}

export const StatsDashboardView: React.FC<StatsDashboardViewProps> = ({
  minwonSummary,
  deviceStats,
  onExportMinwonExcel,
  onExportDeviceStatsExcel
}) => {
  const totalMinwon = Math.max(1, minwonSummary.totalMinwonCount)
  const totalDevices = Math.max(1, deviceStats.totals.totalCount)

  const zoneBars = [
    {
      label: '어린이보호구역',
      count: deviceStats.totals.zoneChild,
      color: 'bg-[#f59e0b]'
    },
    {
      label: '일반구역',
      count: deviceStats.totals.zoneGeneral,
      color: 'bg-[#2563eb]'
    },
    {
      label: '노인보호구역',
      count: deviceStats.totals.zoneElder,
      color: 'bg-[#10b981]'
    },
    {
      label: '장애인보호구역',
      count: deviceStats.totals.zoneDisabled,
      color: 'bg-[#8b5cf6]'
    }
  ]

  const typeBars = [
    { label: '과속(고정식)', count: deviceStats.totals.fixedSpeed },
    { label: '신호과속(고정식)', count: deviceStats.totals.fixedSignalSpeed },
    { label: '구간단속(고정식)', count: deviceStats.totals.fixedSection },
    { label: '과속(이동식)', count: deviceStats.totals.mobileSpeed },
    { label: '운행제한(고정식)', count: deviceStats.totals.fixedRestriction },
    { label: '진입금지(고정식)', count: deviceStats.totals.fixedNoEntry }
  ]

  const maxYearlyCount = Math.max(1, ...deviceStats.rows.map((r) => r.totalCount))

  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측 6컬럼: 민원접수대장 분석 통계 (마우스 호버 시 상세 값 표시) */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="민원접수 구분 및 공단 검토결과 분포"
          badge={<PieChart className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            <PillButton variant="pearl-capsule" size="sm" onClick={() => void onExportMinwonExcel()}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>민원 전체 엑셀</span>
            </PillButton>
          }
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto space-y-3 pr-1"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-2.5">
              <div className="text-[11px] text-[#64748b]">총 민원 건수</div>
              <div className="text-[18px] font-extrabold text-[#0f172a] mt-0.5">
                {minwonSummary.totalMinwonCount.toLocaleString()}건
              </div>
            </div>
            <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-2.5">
              <div className="text-[11px] text-[#64748b]">검토/조치 완료율</div>
              <div className="text-[18px] font-extrabold text-[#059669] mt-0.5">
                {minwonSummary.totalMinwonCount === 0
                  ? '0%'
                  : `${Math.round((minwonSummary.completedReviewCount / totalMinwon) * 100)}%`}
              </div>
            </div>
            <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-2.5">
              <div className="text-[11px] text-[#64748b]">검토 대기 중</div>
              <div className="text-[18px] font-extrabold text-[#d97706] mt-0.5">
                {minwonSummary.pendingReviewCount.toLocaleString()}건
              </div>
            </div>
          </div>

          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
            <div className="text-[12px] font-bold text-[#0f172a]">
              공단 검토결과별 현황 (마우스 호버 시 상세 수치)
            </div>
            {minwonSummary.byReviewResult.length === 0 ? (
              <div className="text-[12px] text-[#64748b] py-4 text-center">
                등록된 민원 데이터가 없습니다.
              </div>
            ) : (
              minwonSummary.byReviewResult.map((item) => {
                const exactPct = ((item.count / totalMinwon) * 100).toFixed(1)
                const pct = Math.round((item.count / totalMinwon) * 100)
                return (
                  <div
                    key={item.label}
                    className="group relative space-y-1 rounded-[6px] p-1.5 -mx-1.5 hover:bg-white transition-colors cursor-pointer"
                  >
                    {/* 마우스 호버 시 즉시 표시되는 플로팅 값 툴팁 */}
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-[6px] bg-[#090d16] text-white px-2.5 py-1.5 text-[11px] font-bold border border-[#334155] apple-product-shadow">
                      {item.label}: {item.count.toLocaleString()}건 (전체 {minwonSummary.totalMinwonCount}건 중 {exactPct}%)
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-semibold text-[#334155] group-hover:text-[#2563eb]">
                        {item.label}
                      </span>
                      <span className="font-bold text-[#0f172a]">
                        {item.count.toLocaleString()}건 ({exactPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#e2e8f0] overflow-hidden">
                      <div
                        className="h-full bg-[#2563eb] group-hover:bg-[#1d4ed8] rounded-full transition-all"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
            <div className="text-[12px] font-bold text-[#0f172a]">접수구분별 민원 유입 경로</div>
            {minwonSummary.byReceptionType.length === 0 ? (
              <div className="text-[12px] text-[#64748b] py-3 text-center">
                등록된 민원 데이터가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {minwonSummary.byReceptionType.map((item) => {
                  const exactPct = ((item.count / totalMinwon) * 100).toFixed(1)
                  return (
                    <div
                      key={item.label}
                      className="group relative rounded-[6px] bg-white hover:bg-[#eff6ff] border border-[#cbd5e1] hover:border-[#2563eb] px-2.5 py-1.5 flex items-center justify-between text-[12px] transition-colors cursor-pointer"
                    >
                      <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-[6px] bg-[#090d16] text-white px-2.5 py-1 text-[11px] font-bold border border-[#334155] apple-product-shadow">
                        {item.label}: {item.count.toLocaleString()}건 ({exactPct}%)
                      </div>
                      <span className="text-[#475569] group-hover:text-[#0f172a] font-medium truncate">
                        {item.label}
                      </span>
                      <span className="font-bold text-[#2563eb]">
                        {item.count}건 ({exactPct}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </UtilityCard>
      </div>

      {/* 우측 6컬럼: 무인교통단속장비 487대 보호구역·단속유형·연도별 추이 차트 (마우스 호버 값 표시) */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="무인교통단속장비 보호구역 및 단속종류 비중"
          badge={<BarChart3 className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            <PillButton
              variant="primary"
              size="sm"
              onClick={() => void onExportDeviceStatsExcel()}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>장비 통계 엑셀</span>
            </PillButton>
          }
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto space-y-3 pr-1"
        >
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#0f172a] inline-flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#2563eb]" />
                보호구역별 단속장비 설치 비중
              </span>
              <span className="text-[11.5px] font-bold text-[#2563eb]">
                총 {deviceStats.totals.totalCount.toLocaleString()}대
              </span>
            </div>

            {zoneBars.map((z) => {
              const pct = ((z.count / totalDevices) * 100).toFixed(1)
              return (
                <div
                  key={z.label}
                  className="group relative space-y-1 rounded-[6px] p-1 -mx-1 hover:bg-white transition-colors cursor-pointer"
                >
                  <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-[6px] bg-[#090d16] text-white px-2.5 py-1.5 text-[11px] font-bold border border-[#334155] apple-product-shadow">
                    {z.label}: {z.count.toLocaleString()}대 (전체 {deviceStats.totals.totalCount}대 중 {pct}%)
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-[#334155] group-hover:text-[#0f172a]">
                      {z.label}
                    </span>
                    <span className="font-bold text-[#0f172a]">
                      {z.count.toLocaleString()}대 ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#e2e8f0] overflow-hidden">
                    <div
                      className={`h-full ${z.color} group-hover:brightness-110 rounded-full transition-all`}
                      style={{ width: `${Math.max(2, Number(pct))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
            <div className="text-[12px] font-bold text-[#0f172a] inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
              단속종류별 운영 대수
            </div>
            <div className="grid grid-cols-2 gap-2">
              {typeBars.map((t) => {
                const pct = ((t.count / totalDevices) * 100).toFixed(1)
                return (
                  <div
                    key={t.label}
                    className="group relative rounded-[7px] bg-white hover:bg-[#eff6ff] border border-[#cbd5e1] hover:border-[#2563eb] px-3 py-2 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-[6px] bg-[#090d16] text-white px-2.5 py-1 text-[11px] font-bold border border-[#334155] apple-product-shadow">
                      {t.label}: {t.count.toLocaleString()}대 ({pct}%)
                    </div>
                    <span className="text-[12px] font-medium text-[#475569] group-hover:text-[#0f172a]">
                      {t.label}
                    </span>
                    <span className="text-[13px] font-extrabold text-[#0f172a] group-hover:text-[#2563eb]">
                      {t.count.toLocaleString()}대
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 설치년도별 단속장비 운영 추이 막대 차트 (마우스 호버 시 상세 대수 툴팁 표시) */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-[#0f172a] inline-flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#2563eb]" />
                설치년도별 단속장비 운영 추이 차트 (마우스 호버 시 상세 값 표시)
              </span>
              <span className="text-[10.5px] font-semibold text-[#64748b]">2013년 ~ 2024년</span>
            </div>
            <div className="h-[118px] flex items-end gap-1.5 pt-4 pb-1 px-1 border-b border-[#cbd5e1]">
              {deviceStats.rows.map((r) => {
                const barH = Math.round((r.totalCount / maxYearlyCount) * 72)
                return (
                  <div
                    key={r.installYear}
                    className="group relative flex-1 flex flex-col items-center justify-end gap-1 rounded-[5px] py-0.5 hover:bg-[#e2e8f0]/70 transition-colors cursor-pointer"
                  >
                    <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-30 w-[154px] rounded-[7px] bg-[#090d16] text-white p-2 text-[11px] border border-[#334155] apple-product-shadow">
                      <div className="font-extrabold text-[#38bdf8] border-b border-[#1e293b] pb-1 mb-1 flex justify-between">
                        <span>{r.installYear}년 설치</span>
                        <span>총 {r.totalCount}대</span>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-slate-300">일반구역</span>
                          <span className="font-bold">{r.zoneGeneral}대</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#fcd34d]">어린이보호구역</span>
                          <span className="font-bold text-[#fcd34d]">{r.zoneChild}대</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6ee7b7]">노인보호구역</span>
                          <span className="font-bold text-[#6ee7b7]">{r.zoneElder}대</span>
                        </div>
                        <div className="flex justify-between pt-0.5 border-t border-[#1e293b]">
                          <span className="text-slate-300">신호과속/과속</span>
                          <span className="font-bold">
                            {r.fixedSignalSpeed}/{r.fixedSpeed + r.mobileSpeed}대
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="text-[9.5px] font-extrabold text-[#1d4ed8] leading-none">
                      {r.totalCount}
                    </span>
                    <div className="w-full flex items-end justify-center h-[72px]">
                      <div
                        className="w-3.5 bg-[#2563eb] group-hover:bg-[#1d4ed8] rounded-t-[3px] transition-all"
                        style={{ height: `${Math.max(4, barH)}px` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-[#475569] group-hover:text-[#0f172a]">
                      {r.installYear}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </UtilityCard>
      </div>
    </div>
  )
}
