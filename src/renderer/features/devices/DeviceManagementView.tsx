import React, { useEffect, useState } from 'react'
import {
  Edit3,
  FileSpreadsheet,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Table2,
  Trash2,
  X
} from 'lucide-react'
import {
  DeviceOperationStats,
  TrafficDevice,
  TrafficDeviceUpsertPayload
} from '@shared/types/domain'
import { unifiedApiClient } from '../../services/api-client'
import { PillButton } from '../../components/ui/PillButton'
import { OptionChip } from '../../components/ui/OptionChip'

interface DeviceManagementViewProps {
  deviceStats: DeviceOperationStats
  totalDeviceCount: number
  canWrite: boolean
  refreshTick: number
  onShowToast: (msg: string) => void
  onRefreshSnapshot: () => Promise<void>
}

export const DeviceManagementView: React.FC<DeviceManagementViewProps> = ({
  deviceStats,
  totalDeviceCount,
  canWrite,
  refreshTick,
  onShowToast,
  onRefreshSnapshot
}) => {
  const [subMode, setSubMode] = useState<'STATS_TABLE' | 'MASTER_LIST'>('STATS_TABLE')
  const [devices, setDevices] = useState<TrafficDevice[]>([])
  const [keyword, setKeyword] = useState<string>('')
  const [zoneFilter, setZoneFilter] = useState<string>('전체')
  const [typeFilter, setTypeFilter] = useState<string>('전체')

  // 우측 사이드패널 (신규 장비 등록 또는 선택된 장비 상세/수정)
  const [editingDevice, setEditingDevice] = useState<TrafficDeviceUpsertPayload | null>(null)
  const [isNewDeviceMode, setIsNewDeviceMode] = useState<boolean>(false)

  const openNewDevicePanel = (): void => {
    setSubMode('MASTER_LIST')
    setIsNewDeviceMode(true)
    setEditingDevice({
      installYear: new Date().getFullYear(),
      deviceId: '',
      deviceName: '',
      location: '',
      manufacturer: '건아정보기술/2차표준화',
      category: '고정식',
      enforcementType: '신호과속',
      speedLimit: 50,
      zoneType: '일반구역'
    })
  }

  const openDeviceDetailPanel = (d: TrafficDevice): void => {
    if (!isNewDeviceMode && editingDevice?.deviceId === d.deviceId) {
      setEditingDevice(null)
      return
    }
    setIsNewDeviceMode(false)
    setEditingDevice({ ...d })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setEditingDevice(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadDeviceList = async (): Promise<void> => {
    const list = await unifiedApiClient.listDevices({
      keyword,
      zoneType: zoneFilter === '전체' ? '' : zoneFilter,
      enforcementType: typeFilter === '전체' ? '' : typeFilter
    })
    setDevices(list)
  }

  useEffect(() => {
    if (subMode === 'MASTER_LIST') {
      void loadDeviceList()
    }
  }, [subMode, keyword, zoneFilter, typeFilter, refreshTick])

  const handleExportStatsExcel = async (): Promise<void> => {
    const res = await unifiedApiClient.exportDeviceStatsExcel()
    onShowToast(res.message)
  }

  const handleReloadCsv = async (): Promise<void> => {
    const res = await unifiedApiClient.reloadDeviceCsv()
    onShowToast(res.message)
    await onRefreshSnapshot()
    if (subMode === 'MASTER_LIST') {
      await loadDeviceList()
    }
  }

  const handleSaveDevice = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!editingDevice) return
    const res = await unifiedApiClient.upsertDevice(editingDevice)
    onShowToast(res.message)
    if (res.ok) {
      setEditingDevice(null)
      await onRefreshSnapshot()
      await loadDeviceList()
    }
  }

  const handleDeleteDevice = async (deviceId: string): Promise<void> => {
    const res = await unifiedApiClient.deleteDevice(deviceId)
    onShowToast(res.message)
    if (res.ok) {
      await onRefreshSnapshot()
      await loadDeviceList()
    }
  }

  return (
    <div
      className="h-full p-3.5 w-full min-h-0 flex flex-col gap-2.5"
      onClick={() => setEditingDevice(null)}
    >
      {/* 상단 탭 전환 & 통계 요약 헤더 */}
      <div
        className="rounded-[10px] bg-white border border-[#cbd5e1] p-2.5 flex items-center justify-between shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] p-0.5">
            <button
              type="button"
              onClick={() => setSubMode('STATS_TABLE')}
              className={`h-[28px] px-3 rounded-[6px] text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                subMode === 'STATS_TABLE'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>연도별·유형별 운영현황 통계표</span>
            </button>
            <button
              type="button"
              onClick={() => setSubMode('MASTER_LIST')}
              className={`h-[28px] px-3 rounded-[6px] text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer ${
                subMode === 'MASTER_LIST'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-[#475569] hover:text-[#0f172a]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>전체 단속장비 마스터 목록 ({totalDeviceCount.toLocaleString()}대)</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <PillButton
              variant="pearl-capsule"
              size="sm"
              onClick={openNewDevicePanel}
            >
              <Plus className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>신규 장비 추가</span>
            </PillButton>
          )}
          {canWrite && (
            <PillButton variant="pearl-capsule" size="sm" onClick={() => void handleReloadCsv()}>
              <RefreshCw className="w-3.5 h-3.5 text-[#059669]" />
              <span>원본 장비(487대) 동기화</span>
            </PillButton>
          )}
          <PillButton variant="primary" size="sm" onClick={() => void handleExportStatsExcel()}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>운영현황 통계 엑셀 내보내기</span>
          </PillButton>
        </div>
      </div>

      {/* 모드 1: 기존 VBA Analysis / operator-status.xlsx 100% 동일 운영현황 통계 시트 + 시각화 차트 */}
      {subMode === 'STATS_TABLE' && (
        <div className="flex-1 min-h-0 bg-white border border-[#cbd5e1] rounded-[10px] overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {/* 상단 문서 타이틀 (operator-status.xlsx 동일 양식) */}
            <div className="text-center pb-1">
              <h2 className="text-[21px] font-extrabold text-[#0f172a] tracking-tight">
                무인교통단속장비 운영현황
              </h2>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-[14.5px] font-extrabold text-[#1f4e78]">
                ○ 무인교통단속장비 유형별 통계
              </div>
              <div className="inline-flex items-center border border-[#0f172a] text-[12.5px]">
                <span className="px-4 py-1 font-extrabold text-[#0f172a] border-r border-dotted border-[#64748b] bg-[#f8fafc]">
                  총
                </span>
                <span className="px-5 py-1 font-bold text-[#0f172a] bg-white">
                  {deviceStats.totals.totalCount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* 메인 통계 테이블 */}
            <div className="border border-[#475569] overflow-hidden">
              <table className="w-full border-collapse text-center text-[12px]">
                <thead className="bg-[#f8fafc] text-[#0f172a] border-b border-[#475569] text-[11.5px] font-bold">
                  <tr>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">연번</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">설치년도</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">일반구역</th>
                    <th className="py-2 px-2 text-[#b45309] border-r border-[#94a3b8]">
                      어린이보호구역
                    </th>
                    <th className="py-2 px-2 text-[#047857] border-r border-[#94a3b8]">
                      노인보호구역
                    </th>
                    <th className="py-2 px-2 text-[#7e22ce] border-r border-[#94a3b8]">
                      장애인보호구역
                    </th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">신호과속(고)</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">과속(고)</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">구간(고)</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">운행제한(고)</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8]">진입금지(고)</th>
                    <th className="py-2 px-2 border-r border-[#94a3b8] text-[#2563eb]">과속(이)</th>
                    <th className="py-2 px-3 bg-[#eff6ff] text-[#1d4ed8] font-extrabold">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#cbd5e1]">
                  {deviceStats.rows.map((r) => (
                    <tr key={r.installYear} className="hover:bg-[#f8fafc]">
                      <td className="py-1.5 px-2 text-[#334155] border-r border-[#cbd5e1]">{r.seq}</td>
                      <td className="py-1.5 px-2 font-bold text-[#0f172a] border-r border-[#cbd5e1]">
                        {r.installYear}
                      </td>
                      <td className="py-1.5 px-2 border-r border-[#cbd5e1]">{r.zoneGeneral}</td>
                      <td className="py-1.5 px-2 font-semibold text-[#b45309] border-r border-[#cbd5e1]">
                        {r.zoneChild}
                      </td>
                      <td className="py-1.5 px-2 font-semibold text-[#047857] border-r border-[#cbd5e1]">
                        {r.zoneElder}
                      </td>
                      <td className="py-1.5 px-2 font-semibold text-[#7e22ce] border-r border-[#cbd5e1]">
                        {r.zoneDisabled}
                      </td>
                      <td className="py-1.5 px-2 border-r border-[#cbd5e1]">{r.fixedSignalSpeed}</td>
                      <td className="py-1.5 px-2 border-r border-[#cbd5e1]">{r.fixedSpeed}</td>
                      <td className="py-1.5 px-2 border-r border-[#cbd5e1]">{r.fixedSection}</td>
                      <td className="py-1.5 px-2 border-r border-[#cbd5e1]">{r.fixedRestriction}</td>
                      <td className="py-1.5 px-2 border-r border-[#cbd5e1]">{r.fixedNoEntry}</td>
                      <td className="py-1.5 px-2 font-semibold text-[#2563eb] border-r border-[#cbd5e1]">
                        {r.mobileSpeed}
                      </td>
                      <td className="py-1.5 px-3 font-extrabold text-[#0f172a] bg-[#f8fafc]">
                        {r.totalCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#f1f5f9] text-[#0f172a] border-t border-[#475569] font-extrabold text-[12px]">
                  <tr>
                    <td colSpan={2} className="py-2 px-2 border-r border-[#94a3b8]">
                      합계
                    </td>
                    <td className="py-2 px-2 border-r border-[#94a3b8]">
                      {deviceStats.totals.zoneGeneral.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-[#b45309] border-r border-[#94a3b8]">
                      {deviceStats.totals.zoneChild.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-[#047857] border-r border-[#94a3b8]">
                      {deviceStats.totals.zoneElder.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-[#7e22ce] border-r border-[#94a3b8]">
                      {deviceStats.totals.zoneDisabled.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 border-r border-[#94a3b8]">
                      {deviceStats.totals.fixedSignalSpeed.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 border-r border-[#94a3b8]">
                      {deviceStats.totals.fixedSpeed.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 border-r border-[#94a3b8]">
                      {deviceStats.totals.fixedSection.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 border-r border-[#94a3b8]">
                      {deviceStats.totals.fixedRestriction.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 border-r border-[#94a3b8]">
                      {deviceStats.totals.fixedNoEntry.toLocaleString()}
                    </td>
                    <td className="py-2 px-2 text-[#2563eb] border-r border-[#94a3b8]">
                      {deviceStats.totals.mobileSpeed.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 bg-[#eff6ff] text-[#1d4ed8]">
                      {deviceStats.totals.totalCount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 하단 시각화 차트 2종 (엑셀 내보내기 시 함께 삽입되는 차트 미리보기) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* 차트 1: 설치년도별 보호구역 단속장비 현황 */}
              <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-extrabold text-[#0f172a]">
                    설치년도별 보호구역 단속장비 현황 (차트)
                  </span>
                  <div className="flex items-center gap-2 text-[10.5px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-[#2563eb]">
                      <span className="w-2 h-2 rounded-xs bg-[#2563eb]" /> 일반구역
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#d97706]">
                      <span className="w-2 h-2 rounded-xs bg-[#d97706]" /> 어린이
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#059669]">
                      <span className="w-2 h-2 rounded-xs bg-[#059669]" /> 노인
                    </span>
                  </div>
                </div>
                <div className="h-[115px] flex items-end gap-1.5 pt-3 pb-1 px-1 border-b border-[#cbd5e1]">
                  {deviceStats.rows.map((r) => {
                    const maxVal = Math.max(
                      1,
                      ...deviceStats.rows.map((x) =>
                        Math.max(x.zoneGeneral, x.zoneChild, x.zoneElder, 1)
                      )
                    )
                    const gH = Math.round((r.zoneGeneral / maxVal) * 78)
                    const cH = Math.round((r.zoneChild / maxVal) * 78)
                    const eH = Math.round((r.zoneElder / maxVal) * 78)
                    return (
                      <div
                        key={r.installYear}
                        className="flex-1 flex flex-col items-center justify-end gap-1"
                        title={`${r.installYear}년: 일반 ${r.zoneGeneral} / 어린이 ${r.zoneChild} / 노인 ${r.zoneElder}`}
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-[80px]">
                          <div
                            className="w-2 bg-[#2563eb] rounded-t-[2px]"
                            style={{ height: `${Math.max(r.zoneGeneral > 0 ? 3 : 0, gH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#d97706] rounded-t-[2px]"
                            style={{ height: `${Math.max(r.zoneChild > 0 ? 3 : 0, cH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#059669] rounded-t-[2px]"
                            style={{ height: `${Math.max(r.zoneElder > 0 ? 3 : 0, eH)}px` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#475569]">{r.installYear}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 차트 2: 설치년도별 단속종류별 운영현황 */}
              <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-extrabold text-[#0f172a]">
                    설치년도별 단속종류별 운영현황 (차트)
                  </span>
                  <div className="flex items-center gap-2 text-[10.5px] font-semibold">
                    <span className="inline-flex items-center gap-1 text-[#1d4ed8]">
                      <span className="w-2 h-2 rounded-xs bg-[#1d4ed8]" /> 신호과속(고)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#0284c7]">
                      <span className="w-2 h-2 rounded-xs bg-[#0284c7]" /> 과속(고)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#0d9488]">
                      <span className="w-2 h-2 rounded-xs bg-[#0d9488]" /> 구간/이동
                    </span>
                  </div>
                </div>
                <div className="h-[115px] flex items-end gap-1.5 pt-3 pb-1 px-1 border-b border-[#cbd5e1]">
                  {deviceStats.rows.map((r) => {
                    const maxVal = Math.max(
                      1,
                      ...deviceStats.rows.map((x) =>
                        Math.max(x.fixedSignalSpeed, x.fixedSpeed, x.fixedSection + x.mobileSpeed, 1)
                      )
                    )
                    const sH = Math.round((r.fixedSignalSpeed / maxVal) * 78)
                    const fH = Math.round((r.fixedSpeed / maxVal) * 78)
                    const mH = Math.round(((r.fixedSection + r.mobileSpeed) / maxVal) * 78)
                    return (
                      <div
                        key={r.installYear}
                        className="flex-1 flex flex-col items-center justify-end gap-1"
                        title={`${r.installYear}년: 신호과속 ${r.fixedSignalSpeed} / 과속(고) ${r.fixedSpeed} / 구간·이동 ${r.fixedSection + r.mobileSpeed}`}
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-[80px]">
                          <div
                            className="w-2 bg-[#1d4ed8] rounded-t-[2px]"
                            style={{ height: `${Math.max(r.fixedSignalSpeed > 0 ? 3 : 0, sH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#0284c7] rounded-t-[2px]"
                            style={{ height: `${Math.max(r.fixedSpeed > 0 ? 3 : 0, fH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#0d9488] rounded-t-[2px]"
                            style={{
                              height: `${Math.max(r.fixedSection + r.mobileSpeed > 0 ? 3 : 0, mH)}px`
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-[#475569]">{r.installYear}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 하단 문서 바닥글 안내 (엑셀 인쇄 바닥글 동일 적용) */}
          <div className="px-4 py-2 bg-[#f8fafc] border-t border-[#cbd5e1] flex items-center justify-between text-[11px] text-[#475569] shrink-0">
            <span className="font-semibold">
              작성일: {new Date().toISOString().slice(0, 10)}
            </span>
            <span className="font-bold text-[#dc2626]">
              본 자료는 중요 공무 자료이므로 외부 유출 및 무단 배포를 금지합니다.
            </span>
          </div>
        </div>
      )}

      {/* 모드 2: 단속장비 마스터 487대 검색 및 우측 사이드패널(상세/수정/신규등록) */}
      {subMode === 'MASTER_LIST' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {/* 상단 필터 바: 보호구역 및 단속종류(전체·신호과속·과속·구간 등)를 좌측으로 보기 좋게 정렬 */}
          <div
            className="rounded-[10px] bg-white border border-[#cbd5e1] p-2.5 flex items-center justify-between gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                {['전체', '일반구역', '어린이보호구역', '노인보호구역', '장애인보호구역'].map((z) => (
                  <OptionChip
                    key={z}
                    label={z}
                    selected={zoneFilter === z}
                    onClick={() => setZoneFilter(z)}
                  />
                ))}
              </div>

              <div className="w-[1px] h-5 bg-[#cbd5e1] mx-1" />

              <div className="flex items-center gap-1">
                {['전체', '신호과속', '과속', '구간', '운행제한', '진입금지'].map((t) => (
                  <OptionChip
                    key={t}
                    label={t}
                    selected={typeFilter === t}
                    onClick={() => setTypeFilter(t)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-[250px]">
                <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="장비번호(B7272), 교차로명, 제조사 검색..."
                  className="w-full h-[28px] pl-7.5 pr-2.5 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px]"
                />
              </div>
              {canWrite && (
                <PillButton variant="primary" size="sm" onClick={openNewDevicePanel}>
                  <Plus className="w-3.5 h-3.5" />
                  <span>장비 등록</span>
                </PillButton>
              )}
            </div>
          </div>

          {/* 좌측 장비 테이블 + 우측 사이드패널(데이터 선택 또는 신규 장비 등록 시 열림) */}
          <div className="flex-1 min-h-0 bg-white border border-[#cbd5e1] rounded-[10px] overflow-hidden flex">
            <div className="flex-1 min-w-0 min-h-0 overflow-auto">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1] text-[11.5px] font-bold">
                  <tr className="whitespace-nowrap">
                    <th className="py-2 px-2.5 text-center w-[68px]">설치년도</th>
                    <th className="py-2 px-2.5 text-center w-[76px]">장비번호</th>
                    <th className="py-2 px-2.5 w-[180px]">장비명</th>
                    <th className="py-2 px-2.5 min-w-[230px]">설치 위치</th>
                    <th className="py-2 px-2.5 w-[140px]">제조사</th>
                    <th className="py-2 px-2.5 text-center w-[68px]">유형</th>
                    <th className="py-2 px-2.5 text-center w-[76px]">단속종류</th>
                    <th className="py-2 px-2.5 text-center w-[70px]">제한속도</th>
                    <th className="py-2 px-2.5 text-center w-[100px]">보호구역명</th>
                    {canWrite && <th className="py-2 px-2.5 text-center w-[68px]">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {devices.map((d) => {
                    const isSelected = !isNewDeviceMode && editingDevice?.deviceId === d.deviceId
                    return (
                      <tr
                        key={d.deviceId}
                        onClick={(e) => {
                          e.stopPropagation()
                          openDeviceDetailPanel(d)
                        }}
                        title="클릭 시 우측 상세/수정 패널이 열립니다"
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#eff6ff] font-semibold' : 'hover:bg-[#f8fafc]'
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-center text-[#475569]">{d.installYear}</td>
                        <td className="py-1.5 px-2.5 text-center font-extrabold text-[#2563eb]">
                          {d.deviceId}
                        </td>
                        <td className="py-1.5 px-2.5 font-semibold text-[#0f172a] truncate max-w-[180px]">
                          {d.deviceName}
                        </td>
                        <td className="py-1.5 px-2.5 text-[#334155] truncate max-w-[280px]" title={d.location}>
                          {d.location}
                        </td>
                        <td className="py-1.5 px-2.5 text-[#475569] truncate max-w-[140px]">
                          {d.manufacturer}
                        </td>
                        <td className="py-1.5 px-2.5 text-center">{d.category}</td>
                        <td className="py-1.5 px-2.5 text-center font-semibold">{d.enforcementType}</td>
                        <td className="py-1.5 px-2.5 text-center font-bold">{d.speedLimit}km</td>
                        <td className="py-1.5 px-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-[5px] text-[11px] font-semibold ${
                              d.zoneType === '어린이보호구역'
                                ? 'bg-[#fefce8] text-[#b45309] border border-[#fde68a]'
                                : d.zoneType === '노인보호구역'
                                  ? 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]'
                                  : 'bg-[#f1f5f9] text-[#475569]'
                            }`}
                          >
                            {d.zoneType}
                          </span>
                        </td>
                        {canWrite && (
                          <td
                            className="py-1.5 px-2.5 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setIsNewDeviceMode(false)
                                  setEditingDevice({ ...d })
                                }}
                                className="p-1 rounded-[5px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#2563eb] cursor-pointer"
                                title="장비 상세/수정"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteDevice(d.deviceId)}
                                className="p-1 rounded-[5px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] cursor-pointer"
                                title="장비 삭제"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 우측: 데이터 선택 시 또는 신규 장비 추가 시 열리는 속성 : 값 사이드패널 */}
            {editingDevice && (
              <aside
                onClick={(e) => e.stopPropagation()}
                className="w-[370px] shrink-0 border-l border-[#cbd5e1] bg-[#f8fafc] flex flex-col h-full"
              >
                <div className="px-3.5 py-2.5 bg-[#090d16] text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-[5px] text-[11px] font-extrabold ${
                        isNewDeviceMode ? 'bg-[#059669] text-white' : 'bg-[#2563eb] text-white'
                      }`}
                    >
                      {isNewDeviceMode ? '신규 등록' : editingDevice.deviceId}
                    </span>
                    <span className="text-[13px] font-bold">
                      {isNewDeviceMode ? '신규 단속장비 등록' : '단속장비 상세 및 수정'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingDevice(null)}
                    title="사이드패널 닫기 (ESC)"
                    className="w-6 h-6 rounded-[5px] bg-[#1e293b] hover:bg-[#334155] text-slate-300 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => void handleSaveDevice(e)}
                  className="flex-1 min-h-0 flex flex-col justify-between"
                >
                  <div className="flex-1 min-h-0 overflow-y-auto p-3">
                    <div className="rounded-[8px] border border-[#cbd5e1] bg-white divide-y divide-[#e2e8f0] text-[12px]">
                      {/* 속성 : 값 구조 행들 */}
                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">장비번호</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={editingDevice.deviceId}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({ ...editingDevice, deviceId: e.target.value })
                            }
                            placeholder="예: B9999"
                            required
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-extrabold text-[#2563eb]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">설치년도</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <input
                            type="number"
                            value={editingDevice.installYear}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({
                                ...editingDevice,
                                installYear: Number(e.target.value)
                              })
                            }
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-bold text-[#0f172a]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">장비명</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={editingDevice.deviceName}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({ ...editingDevice, deviceName: e.target.value })
                            }
                            placeholder="예: [청루]노형오거리"
                            required
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-semibold text-[#0f172a]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-start px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold pt-1">설치 위치</span>
                        <span className="col-span-1 text-center text-[#94a3b8] pt-1">:</span>
                        <div className="col-span-7">
                          <textarea
                            rows={2}
                            value={editingDevice.location}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({ ...editingDevice, location: e.target.value })
                            }
                            placeholder="설치 주소 및 방면 입력"
                            required
                            className="w-full p-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[#0f172a] resize-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">보호구역명</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <select
                            value={editingDevice.zoneType}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({ ...editingDevice, zoneType: e.target.value })
                            }
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-semibold text-[#0f172a]"
                          >
                            <option value="일반구역">일반구역</option>
                            <option value="어린이보호구역">어린이보호구역</option>
                            <option value="노인보호구역">노인보호구역</option>
                            <option value="장애인보호구역">장애인보호구역</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">장비 유형</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <select
                            value={editingDevice.category}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({ ...editingDevice, category: e.target.value })
                            }
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-semibold text-[#0f172a]"
                          >
                            <option value="고정식">고정식</option>
                            <option value="이동식">이동식</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">단속종류</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <select
                            value={editingDevice.enforcementType}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({
                                ...editingDevice,
                                enforcementType: e.target.value
                              })
                            }
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-semibold text-[#0f172a]"
                          >
                            <option value="신호과속">신호과속</option>
                            <option value="과속">과속</option>
                            <option value="구간">구간</option>
                            <option value="운행제한">운행제한</option>
                            <option value="진입금지">진입금지</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">제한속도(km)</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <input
                            type="number"
                            value={editingDevice.speedLimit}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({
                                ...editingDevice,
                                speedLimit: Number(e.target.value)
                              })
                            }
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white font-bold text-[#0f172a]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 items-center px-3 py-2 gap-1">
                        <span className="col-span-4 text-[#64748b] font-semibold">제조사</span>
                        <span className="col-span-1 text-center text-[#94a3b8]">:</span>
                        <div className="col-span-7">
                          <input
                            type="text"
                            value={editingDevice.manufacturer}
                            disabled={!canWrite}
                            onChange={(e) =>
                              setEditingDevice({
                                ...editingDevice,
                                manufacturer: e.target.value
                              })
                            }
                            placeholder="예: 건아정보기술/2차표준화"
                            className="w-full h-[28px] px-2 rounded-[5px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[#0f172a]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-2.5 bg-white border-t border-[#cbd5e1] flex items-center justify-between gap-2 shrink-0">
                    <PillButton
                      type="button"
                      variant="pearl-capsule"
                      size="sm"
                      onClick={() => setEditingDevice(null)}
                    >
                      <X className="w-3.5 h-3.5 text-[#64748b]" />
                      <span>닫기</span>
                    </PillButton>

                    {canWrite && (
                      <div className="flex items-center gap-1.5">
                        {!isNewDeviceMode && editingDevice.deviceId && (
                          <PillButton
                            type="button"
                            variant="pearl-capsule"
                            size="sm"
                            onClick={() => void handleDeleteDevice(editingDevice.deviceId)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
                            <span className="text-[#dc2626]">삭제</span>
                          </PillButton>
                        )}
                        <PillButton type="submit" variant="primary" size="sm">
                          <Save className="w-3.5 h-3.5" />
                          <span>{isNewDeviceMode ? '신규 장비 등록' : '수정사항 저장'}</span>
                        </PillButton>
                      </div>
                    )}
                  </div>
                </form>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
