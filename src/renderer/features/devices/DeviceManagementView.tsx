import React, { useEffect, useState } from 'react'
import {
  FileSpreadsheet,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Table2,
  Trash2
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

  // 신규 장비 추가/수정 모달
  const [editingDevice, setEditingDevice] = useState<TrafficDeviceUpsertPayload | null>(null)

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
    <div className="h-full p-3.5 w-full min-h-0 flex flex-col gap-2.5">
      {/* 상단 탭 전환 & 통계 요약 헤더 */}
      <div className="rounded-[10px] bg-white border border-[#cbd5e1] p-2.5 flex items-center justify-between shrink-0">
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
              <span>연도별·유형별 운영현황 통계표 (operator-status)</span>
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
              onClick={() =>
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
            >
              <Plus className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>신규 장비 추가</span>
            </PillButton>
          )}
          {canWrite && (
            <PillButton variant="pearl-capsule" size="sm" onClick={() => void handleReloadCsv()}>
              <RefreshCw className="w-3.5 h-3.5 text-[#059669]" />
              <span>원본 CSV(487대) 동기화</span>
            </PillButton>
          )}
          <PillButton variant="primary" size="sm" onClick={() => void handleExportStatsExcel()}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>운영현황 통계 엑셀 내보내기</span>
          </PillButton>
        </div>
      </div>

      {/* 모드 1: 기존 VBA Analysis / operator-status.xlsx 100% 동일 운영현황 통계 시트 */}
      {subMode === 'STATS_TABLE' && (
        <div className="flex-1 min-h-0 bg-white border border-[#cbd5e1] rounded-[10px] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between shrink-0">
            <div>
              <h3 className="text-[13.5px] font-extrabold text-[#0f172a]">
                ○ 무인교통단속장비 유형별 통계 (설치년도별 보호구역 및 단속종류 집계)
              </h3>
              <p className="text-[11px] text-[#64748b]">
                단속장비 마스터 데이터가 추가·수정되면 아래 연도별 보호구역 및 단속종류 통계가 실시간 자동 재계산됩니다.
              </p>
            </div>
            <div className="px-3 py-1 rounded-[7px] bg-[#0f172a] text-white text-[13px] font-bold">
              총 <span className="text-[#38bdf8]">{deviceStats.totals.totalCount.toLocaleString()}</span> 대
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full border-collapse text-center text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-[#f1f5f9] text-[#1e293b] border-b border-[#cbd5e1] text-[11.5px] font-bold">
                <tr>
                  <th className="py-2.5 px-2 border-r border-[#e2e8f0]">연번</th>
                  <th className="py-2.5 px-2 border-r border-[#cbd5e1]">설치년도</th>
                  <th className="py-2.5 px-2 bg-[#f8fafc] border-r border-[#e2e8f0]">일반구역</th>
                  <th className="py-2.5 px-2 bg-[#fefce8] text-[#b45309] border-r border-[#e2e8f0]">
                    어린이보호구역
                  </th>
                  <th className="py-2.5 px-2 bg-[#ecfdf5] text-[#047857] border-r border-[#e2e8f0]">
                    노인보호구역
                  </th>
                  <th className="py-2.5 px-2 bg-[#f3e8ff] text-[#7e22ce] border-r border-[#cbd5e1]">
                    장애인보호구역
                  </th>
                  <th className="py-2.5 px-2 border-r border-[#e2e8f0]">신호과속(고)</th>
                  <th className="py-2.5 px-2 border-r border-[#e2e8f0]">과속(고)</th>
                  <th className="py-2.5 px-2 border-r border-[#e2e8f0]">구간(고)</th>
                  <th className="py-2.5 px-2 border-r border-[#e2e8f0]">운행제한(고)</th>
                  <th className="py-2.5 px-2 border-r border-[#e2e8f0]">진입금지(고)</th>
                  <th className="py-2.5 px-2 border-r border-[#cbd5e1] text-[#2563eb]">과속(이)</th>
                  <th className="py-2.5 px-3 bg-[#eff6ff] text-[#1d4ed8] font-extrabold">합계</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {deviceStats.rows.map((r) => (
                  <tr key={r.installYear} className="hover:bg-[#f8fafc]">
                    <td className="py-2 px-2 text-[#64748b] border-r border-[#e2e8f0]">{r.seq}</td>
                    <td className="py-2 px-2 font-bold text-[#0f172a] border-r border-[#cbd5e1]">
                      {r.installYear}년
                    </td>
                    <td className="py-2 px-2 border-r border-[#e2e8f0]">{r.zoneGeneral}</td>
                    <td className="py-2 px-2 font-semibold text-[#b45309] border-r border-[#e2e8f0]">
                      {r.zoneChild}
                    </td>
                    <td className="py-2 px-2 font-semibold text-[#047857] border-r border-[#e2e8f0]">
                      {r.zoneElder}
                    </td>
                    <td className="py-2 px-2 font-semibold text-[#7e22ce] border-r border-[#cbd5e1]">
                      {r.zoneDisabled}
                    </td>
                    <td className="py-2 px-2 border-r border-[#e2e8f0]">{r.fixedSignalSpeed}</td>
                    <td className="py-2 px-2 border-r border-[#e2e8f0]">{r.fixedSpeed}</td>
                    <td className="py-2 px-2 border-r border-[#e2e8f0]">{r.fixedSection}</td>
                    <td className="py-2 px-2 border-r border-[#e2e8f0]">{r.fixedRestriction}</td>
                    <td className="py-2 px-2 border-r border-[#e2e8f0]">{r.fixedNoEntry}</td>
                    <td className="py-2 px-2 font-semibold text-[#2563eb] border-r border-[#cbd5e1]">
                      {r.mobileSpeed}
                    </td>
                    <td className="py-2 px-3 font-extrabold text-[#0f172a] bg-[#f8fafc]">
                      {r.totalCount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-[#0f172a] text-white font-extrabold text-[12.5px]">
                <tr>
                  <td colSpan={2} className="py-2.5 px-2 border-r border-[#334155]">
                    합계
                  </td>
                  <td className="py-2.5 px-2 border-r border-[#334155]">
                    {deviceStats.totals.zoneGeneral.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-[#fcd34d] border-r border-[#334155]">
                    {deviceStats.totals.zoneChild.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-[#6ee7b7] border-r border-[#334155]">
                    {deviceStats.totals.zoneElder.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-[#d8b4fe] border-r border-[#334155]">
                    {deviceStats.totals.zoneDisabled.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 border-r border-[#334155]">
                    {deviceStats.totals.fixedSignalSpeed.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 border-r border-[#334155]">
                    {deviceStats.totals.fixedSpeed.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 border-r border-[#334155]">
                    {deviceStats.totals.fixedSection.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 border-r border-[#334155]">
                    {deviceStats.totals.fixedRestriction.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 border-r border-[#334155]">
                    {deviceStats.totals.fixedNoEntry.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 text-[#38bdf8] border-r border-[#334155]">
                    {deviceStats.totals.mobileSpeed.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 bg-[#2563eb] text-white">
                    {deviceStats.totals.totalCount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 모드 2: 단속장비 마스터 487대 검색 및 관리 */}
      {subMode === 'MASTER_LIST' && (
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          <div className="rounded-[10px] bg-white border border-[#cbd5e1] p-2.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {['전체', '일반구역', '어린이보호구역', '노인보호구역', '장애인보호구역'].map((z) => (
                <OptionChip
                  key={z}
                  label={z}
                  selected={zoneFilter === z}
                  onClick={() => setZoneFilter(z)}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {['전체', '신호과속', '과속', '구간', '운행제한', '진입금지'].map((t) => (
                <OptionChip
                  key={t}
                  label={t}
                  selected={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                />
              ))}
            </div>

            <div className="relative w-[260px]">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="장비번호(B7272), 교차로명, 제조사 검색..."
                className="w-full h-[28px] pl-7.5 pr-2.5 rounded-[6px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px]"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-white border border-[#cbd5e1] rounded-[10px] overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full border-collapse text-left text-[12px]">
                <thead className="sticky top-0 z-10 bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1] text-[11.5px] font-bold">
                  <tr>
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
                  {devices.map((d) => (
                    <tr
                      key={d.deviceId}
                      onDoubleClick={() => canWrite && setEditingDevice(d)}
                      className="hover:bg-[#f8fafc]"
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
                        <td className="py-1.5 px-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => void handleDeleteDevice(d.deviceId)}
                            className="p-1 rounded-[5px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] cursor-pointer"
                            title="장비 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 장비 추가/수정 모달 */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/60 flex items-center justify-center p-4">
          <div className="w-[460px] rounded-[12px] bg-white border border-[#cbd5e1] p-4 space-y-3 apple-product-shadow">
            <h3 className="text-[14px] font-bold text-[#0f172a]">
              무인교통단속장비 정보 등록 / 수정
            </h3>
            <form onSubmit={(e) => void handleSaveDevice(e)} className="space-y-2.5 text-[12px]">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">설치년도</label>
                  <input
                    type="number"
                    value={editingDevice.installYear}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, installYear: Number(e.target.value) })
                    }
                    className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">장비번호</label>
                  <input
                    type="text"
                    value={editingDevice.deviceId}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, deviceId: e.target.value })
                    }
                    placeholder="예: B9999"
                    required
                    className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">제한속도(km)</label>
                  <input
                    type="number"
                    value={editingDevice.speedLimit}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, speedLimit: Number(e.target.value) })
                    }
                    className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">장비명</label>
                <input
                  type="text"
                  value={editingDevice.deviceName}
                  onChange={(e) =>
                    setEditingDevice({ ...editingDevice, deviceName: e.target.value })
                  }
                  placeholder="예: [청루]노형오거리"
                  required
                  className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">설치 위치</label>
                <input
                  type="text"
                  value={editingDevice.location}
                  onChange={(e) =>
                    setEditingDevice({ ...editingDevice, location: e.target.value })
                  }
                  required
                  className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">유형</label>
                  <select
                    value={editingDevice.category}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, category: e.target.value })
                    }
                    className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                  >
                    <option value="고정식">고정식</option>
                    <option value="이동식">이동식</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">단속종류</label>
                  <select
                    value={editingDevice.enforcementType}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, enforcementType: e.target.value })
                    }
                    className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                  >
                    <option value="신호과속">신호과속</option>
                    <option value="과속">과속</option>
                    <option value="구간">구간</option>
                    <option value="운행제한">운행제한</option>
                    <option value="진입금지">진입금지</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">보호구역명</label>
                  <select
                    value={editingDevice.zoneType}
                    onChange={(e) =>
                      setEditingDevice({ ...editingDevice, zoneType: e.target.value })
                    }
                    className="w-full h-[30px] px-2 rounded-[6px] border border-[#cbd5e1]"
                  >
                    <option value="일반구역">일반구역</option>
                    <option value="어린이보호구역">어린이보호구역</option>
                    <option value="노인보호구역">노인보호구역</option>
                    <option value="장애인보호구역">장애인보호구역</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <PillButton
                  type="button"
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => setEditingDevice(null)}
                >
                  취소
                </PillButton>
                <PillButton type="submit" variant="primary" size="sm">
                  저장
                </PillButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
