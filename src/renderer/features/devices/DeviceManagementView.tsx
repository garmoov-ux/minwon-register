import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Edit3,
  FileSpreadsheet,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Table2,
  Trash2,
  Upload,
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

  // 단속장비 마스터 목록 컬럼 정렬 상태
  type DeviceSortField =
    | 'installYear'
    | 'deviceId'
    | 'deviceName'
    | 'location'
    | 'manufacturer'
    | 'category'
    | 'enforcementType'
    | 'speedLimit'
    | 'zoneType'
  const [sortField, setSortField] = useState<DeviceSortField>('installYear')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const handleToggleSort = (field: DeviceSortField): void => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'installYear' || field === 'speedLimit' ? 'desc' : 'asc')
    }
  }

  const sortedDevices = useMemo(() => {
    const copy = [...devices]
    copy.sort((a, b) => {
      const valA = a[sortField]
      const valB = b[sortField]
      let cmp = 0
      if (typeof valA === 'number' && typeof valB === 'number') {
        cmp = valA - valB
      } else {
        cmp = String(valA ?? '').localeCompare(String(valB ?? ''), 'ko-KR', {
          numeric: true
        })
      }
      if (cmp === 0) {
        cmp = a.deviceId.localeCompare(b.deviceId, 'ko-KR', { numeric: true })
      }
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return copy
  }, [devices, sortField, sortOrder])

  const renderSortIcon = (field: DeviceSortField): React.ReactNode => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#94a3b8] inline ml-1" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#2563eb] inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#2563eb] inline ml-1" />
    )
  }

  // 우측 사이드패널 (신규 장비 등록 또는 선택된 장비 상세/수정)
  const [editingDevice, setEditingDevice] = useState<TrafficDeviceUpsertPayload | null>(null)
  const [isNewDeviceMode, setIsNewDeviceMode] = useState<boolean>(false)

  // CSV 가져오기 필드 불일치 오류 모달 (관리자 문의 안내)
  const [csvErrorModal, setCsvErrorModal] = useState<{
    title: string
    detail: string
  } | null>(null)

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

  const handleExportDevicesCsv = async (): Promise<void> => {
    const res = await unifiedApiClient.exportDevicesCsv({
      keyword,
      zoneType: zoneFilter === '전체' ? '' : zoneFilter,
      enforcementType: typeFilter === '전체' ? '' : typeFilter
    })
    onShowToast(res.message)
  }

  const handleImportDevicesCsv = async (): Promise<void> => {
    const res = await unifiedApiClient.importDevicesCsv()
    if (!res.ok) {
      if (res.data?.errorDetail || res.data?.errorCode === 'INVALID_CSV_FIELDS') {
        setCsvErrorModal({
          title: '단속장비 CSV 파일 양식 및 필드 불일치 오류',
          detail:
            res.data.errorDetail ||
            'CSV 파일의 열(필드) 구성이 표준 단속장비 양식과 일치하지 않습니다.'
        })
      } else {
        onShowToast(res.message)
      }
      return
    }
    onShowToast(res.message)
    await onRefreshSnapshot()
    await loadDeviceList()
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

        <div className="flex items-center gap-1.5">
          {subMode === 'MASTER_LIST' && (
            <>
              <PillButton
                variant="pearl-capsule"
                size="sm"
                onClick={() => void handleExportDevicesCsv()}
                title="현재 조회된 단속장비 목록을 한글이 깨지지 않는 CSV 파일로 내보냅니다"
              >
                <Download className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>CSV 내보내기</span>
              </PillButton>
              {canWrite && (
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => void handleImportDevicesCsv()}
                  title="엑셀에서 편집한 단속장비 CSV 파일을 가져와 일괄 등록/수정합니다"
                >
                  <Upload className="w-3.5 h-3.5 text-[#059669]" />
                  <span>CSV 가져오기</span>
                </PillButton>
              )}
            </>
          )}
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

            {/* 하단 시각화 차트 2종 (마우스 호버 시 연도별 세부 대수 툴팁 즉시 표시) */}
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
                <div className="h-[125px] flex items-end gap-1.5 pt-4 pb-1 px-1 border-b border-[#cbd5e1]">
                  {deviceStats.rows.map((r) => {
                    const maxVal = Math.max(
                      1,
                      ...deviceStats.rows.map((x) =>
                        Math.max(x.zoneGeneral, x.zoneChild, x.zoneElder, 1)
                      )
                    )
                    const gH = Math.round((r.zoneGeneral / maxVal) * 76)
                    const cH = Math.round((r.zoneChild / maxVal) * 76)
                    const eH = Math.round((r.zoneElder / maxVal) * 76)
                    return (
                      <div
                        key={r.installYear}
                        className="group relative flex-1 flex flex-col items-center justify-end gap-1 rounded-[5px] py-0.5 hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer"
                      >
                        {/* 마우스 호버 시 즉시 표시되는 플로팅 값 툴팁 */}
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-30 w-[148px] rounded-[7px] bg-[#090d16] text-white p-2 text-[11px] border border-[#334155] apple-product-shadow">
                          <div className="font-extrabold text-[#38bdf8] border-b border-[#1e293b] pb-1 mb-1 flex items-center justify-between">
                            <span>{r.installYear}년</span>
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
                            {r.zoneDisabled > 0 && (
                              <div className="flex justify-between">
                                <span className="text-[#d8b4fe]">장애인보호구역</span>
                                <span className="font-bold text-[#d8b4fe]">{r.zoneDisabled}대</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <span className="text-[9.5px] font-extrabold text-[#1d4ed8] leading-none">
                          {r.totalCount}
                        </span>
                        <div className="w-full flex items-end justify-center gap-0.5 h-[76px]">
                          <div
                            className="w-2 bg-[#2563eb] group-hover:brightness-110 rounded-t-[2px]"
                            style={{ height: `${Math.max(r.zoneGeneral > 0 ? 3 : 0, gH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#d97706] group-hover:brightness-110 rounded-t-[2px]"
                            style={{ height: `${Math.max(r.zoneChild > 0 ? 3 : 0, cH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#059669] group-hover:brightness-110 rounded-t-[2px]"
                            style={{ height: `${Math.max(r.zoneElder > 0 ? 3 : 0, eH)}px` }}
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
                <div className="h-[125px] flex items-end gap-1.5 pt-4 pb-1 px-1 border-b border-[#cbd5e1]">
                  {deviceStats.rows.map((r) => {
                    const maxVal = Math.max(
                      1,
                      ...deviceStats.rows.map((x) =>
                        Math.max(x.fixedSignalSpeed, x.fixedSpeed, x.fixedSection + x.mobileSpeed, 1)
                      )
                    )
                    const sH = Math.round((r.fixedSignalSpeed / maxVal) * 76)
                    const fH = Math.round((r.fixedSpeed / maxVal) * 76)
                    const mH = Math.round(((r.fixedSection + r.mobileSpeed) / maxVal) * 76)
                    return (
                      <div
                        key={r.installYear}
                        className="group relative flex-1 flex flex-col items-center justify-end gap-1 rounded-[5px] py-0.5 hover:bg-[#e2e8f0]/60 transition-colors cursor-pointer"
                      >
                        {/* 마우스 호버 시 즉시 표시되는 플로팅 값 툴팁 */}
                        <div className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-100 absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-30 w-[148px] rounded-[7px] bg-[#090d16] text-white p-2 text-[11px] border border-[#334155] apple-product-shadow">
                          <div className="font-extrabold text-[#38bdf8] border-b border-[#1e293b] pb-1 mb-1 flex items-center justify-between">
                            <span>{r.installYear}년</span>
                            <span>총 {r.totalCount}대</span>
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-slate-300">신호과속(고)</span>
                              <span className="font-bold">{r.fixedSignalSpeed}대</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#38bdf8]">과속(고)</span>
                              <span className="font-bold text-[#38bdf8]">{r.fixedSpeed}대</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#6ee7b7]">구간단속(고)</span>
                              <span className="font-bold text-[#6ee7b7]">{r.fixedSection}대</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[#fcd34d]">과속(이동식)</span>
                              <span className="font-bold text-[#fcd34d]">{r.mobileSpeed}대</span>
                            </div>
                          </div>
                        </div>

                        <span className="text-[9.5px] font-extrabold text-[#1d4ed8] leading-none">
                          {r.totalCount}
                        </span>
                        <div className="w-full flex items-end justify-center gap-0.5 h-[76px]">
                          <div
                            className="w-2 bg-[#1d4ed8] group-hover:brightness-110 rounded-t-[2px]"
                            style={{ height: `${Math.max(r.fixedSignalSpeed > 0 ? 3 : 0, sH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#0284c7] group-hover:brightness-110 rounded-t-[2px]"
                            style={{ height: `${Math.max(r.fixedSpeed > 0 ? 3 : 0, fH)}px` }}
                          />
                          <div
                            className="w-2 bg-[#0d9488] group-hover:brightness-110 rounded-t-[2px]"
                            style={{
                              height: `${Math.max(r.fixedSection + r.mobileSpeed > 0 ? 3 : 0, mH)}px`
                            }}
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
          {/* 상단 필터 바: 보호구역 및 단속종류 필터가 줄바꿈 없이 1줄로 깔끔하게 정렬 */}
          <div
            className="rounded-[10px] bg-white border border-[#cbd5e1] px-2.5 py-2 flex items-center justify-between gap-2 shrink-0 flex-nowrap overflow-x-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
              <div className="flex items-center gap-1 flex-nowrap">
                {['전체', '일반구역', '어린이보호구역', '노인보호구역', '장애인보호구역'].map((z) => (
                  <OptionChip
                    key={z}
                    label={z}
                    selected={zoneFilter === z}
                    onClick={() => setZoneFilter(z)}
                  />
                ))}
              </div>

              <div className="w-[1px] h-4 bg-[#cbd5e1] mx-1 shrink-0" />

              <div className="flex items-center gap-1 flex-nowrap">
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

            <div className="flex items-center gap-1.5 shrink-0">
              <div className="relative w-[220px]">
                <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="장비번호(B7272), 교차로명, 제조사 검색..."
                  className="w-full h-[28px] pl-7.5 pr-2.5 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px]"
                />
              </div>

              <div className="h-[28px] px-2.5 rounded-[6px] bg-[#eff6ff] border border-[#bfdbfe] text-[#1d4ed8] text-[12px] font-extrabold inline-flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span>검색</span>
                <span>{sortedDevices.length.toLocaleString()}대</span>
                <span className="text-[11px] font-medium text-[#64748b]">
                  / 전체 {totalDeviceCount.toLocaleString()}대
                </span>
              </div>
            </div>
          </div>

          {/* 좌측 장비 테이블(컬럼 헤더 클릭 시 정렬 지원) + 우측 사이드패널 */}
          <div className="flex-1 min-h-0 bg-white border border-[#cbd5e1] rounded-[10px] overflow-hidden flex">
            <div className="flex-1 min-w-0 min-h-0 overflow-auto">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1] text-[11.5px] font-bold">
                  <tr className="whitespace-nowrap">
                    <th
                      onClick={() => handleToggleSort('installYear')}
                      className="py-2 px-2.5 text-center w-[76px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      설치년도{renderSortIcon('installYear')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('deviceId')}
                      className="py-2 px-2.5 text-center w-[84px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      장비번호{renderSortIcon('deviceId')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('deviceName')}
                      className="py-2 px-2.5 w-[180px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      장비명{renderSortIcon('deviceName')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('location')}
                      className="py-2 px-2.5 min-w-[230px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      설치 위치{renderSortIcon('location')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('manufacturer')}
                      className="py-2 px-2.5 w-[140px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      제조사{renderSortIcon('manufacturer')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('category')}
                      className="py-2 px-2.5 text-center w-[74px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      유형{renderSortIcon('category')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('enforcementType')}
                      className="py-2 px-2.5 text-center w-[84px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      단속종류{renderSortIcon('enforcementType')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('speedLimit')}
                      className="py-2 px-2.5 text-center w-[78px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      제한속도{renderSortIcon('speedLimit')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('zoneType')}
                      className="py-2 px-2.5 text-center w-[108px] cursor-pointer hover:bg-[#e2e8f0]/70 transition-colors"
                    >
                      보호구역명{renderSortIcon('zoneType')}
                    </th>
                    {canWrite && <th className="py-2 px-2.5 text-center w-[68px]">관리</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {sortedDevices.map((d) => {
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

      {/* CSV 가져오기 필드 불일치 오류 모달 (관리자 문의 안내) */}
      {csvErrorModal && (
        <div
          className="fixed inset-0 z-50 bg-[#090d16]/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setCsvErrorModal(null)}
        >
          <div
            className="w-[460px] rounded-[13px] bg-white border border-[#cbd5e1] overflow-hidden apple-product-shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#090d16] text-white px-4 py-3 flex items-center justify-between border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                <span className="text-[13.5px] font-bold">{csvErrorModal.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setCsvErrorModal(null)}
                className="w-6 h-6 rounded-[5px] bg-[#1e293b] hover:bg-[#334155] text-slate-300 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-[12.5px]">
              <div className="rounded-[8px] bg-[#fef2f2] border border-[#fecaca] p-3 text-[#b91c1c] font-semibold leading-relaxed">
                {csvErrorModal.detail}
              </div>

              <div className="rounded-[8px] bg-[#f8fafc] border border-[#cbd5e1] p-3 space-y-1.5 text-[12px] text-[#334155]">
                <div className="font-extrabold text-[#0f172a]">
                  표준 단속장비 CSV 필수 9개 필드(열) 순서
                </div>
                <div className="text-[11.5px] font-mono bg-white border border-[#e2e8f0] rounded-[5px] px-2.5 py-1.5 text-[#1d4ed8] font-bold">
                  설치년도, 장비번호, 장비명, 위치, 제조사, 유형, 단속종류, 제한속도, 보호구역명
                </div>
                <p className="text-[11.5px] text-[#dc2626] font-bold pt-1">
                  * 파일 양식이나 필드 구성이 맞지 않아 가져오기를 중단했습니다. 먼저 [CSV 내보내기]로 표준 양식을 내려받아 편집하시거나, 시스템 관리자에게 문의해 주세요.
                </p>
              </div>

              <div className="flex justify-end pt-1">
                <PillButton
                  variant="primary"
                  size="sm"
                  onClick={() => setCsvErrorModal(null)}
                >
                  확인
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
