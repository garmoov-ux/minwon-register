import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  FilePlus2,
  MapPin,
  Radio,
  RotateCcw,
  Save,
  Search,
  Trash2
} from 'lucide-react'
import {
  CodeCategory,
  MinwonRecord,
  MinwonUpsertPayload,
  TrafficDevice
} from '@shared/types/domain'
import { formatIsoDate } from '@shared/date-ranges'
import { unifiedApiClient } from '../../services/api-client'
import { UtilityCard } from '../../components/ui/UtilityCard'
import { PillButton } from '../../components/ui/PillButton'

interface MinwonFormViewProps {
  codes: Record<CodeCategory, string[]>
  initialRecord: MinwonRecord | null
  nextSuggestedId: number
  canWrite: boolean
  onSaveRecord: (payload: MinwonUpsertPayload) => Promise<boolean>
  onDeleteRecord: (id: number) => Promise<void>
  onClearInitial: () => void
  onBackToLedger: () => void
}

export const MinwonFormView: React.FC<MinwonFormViewProps> = ({
  codes,
  initialRecord,
  nextSuggestedId,
  canWrite,
  onSaveRecord,
  onDeleteRecord,
  onClearInitial,
  onBackToLedger
}) => {
  const todayStr = formatIsoDate(new Date())

  const [id, setId] = useState<number>(initialRecord?.id || nextSuggestedId)
  const [receivedDate, setReceivedDate] = useState<string>(
    initialRecord?.receivedDate || todayStr
  )
  const [receptionType, setReceptionType] = useState<string>(
    initialRecord?.receptionType || codes.접수구분[0] || '국민신문고'
  )
  const [receptionNo, setReceptionNo] = useState<string>(initialRecord?.receptionNo || '')
  const [complainantName, setComplainantName] = useState<string>(
    initialRecord?.complainantName || ''
  )
  const [contact, setContact] = useState<string>(initialRecord?.contact || '')
  const [location, setLocation] = useState<string>(initialRecord?.location || '')
  const [zoneType, setZoneType] = useState<string>(
    initialRecord?.zoneType || codes.구역구분[0] || '일반구역'
  )
  const [content, setContent] = useState<string>(initialRecord?.content || '')
  const [reviewDate, setReviewDate] = useState<string>(initialRecord?.reviewDate || '')
  const [reviewResult, setReviewResult] = useState<string>(
    initialRecord?.reviewResult || codes.검토결과[0] || '검토중'
  )
  const [improvementResult, setImprovementResult] = useState<string>(
    initialRecord?.improvementResult || ''
  )
  const [note, setNote] = useState<string>(initialRecord?.note || '')
  const [deviceId, setDeviceId] = useState<string>(initialRecord?.deviceId || '')

  // 우측 단속장비 위치 빠른 검색 연동
  const [deviceSearchKw, setDeviceSearchKw] = useState<string>('')
  const [deviceList, setDeviceList] = useState<TrafficDevice[]>([])

  useEffect(() => {
    if (initialRecord) {
      setId(initialRecord.id)
      setReceivedDate(initialRecord.receivedDate)
      setReceptionType(initialRecord.receptionType)
      setReceptionNo(initialRecord.receptionNo)
      setComplainantName(initialRecord.complainantName)
      setContact(initialRecord.contact)
      setLocation(initialRecord.location)
      setZoneType(initialRecord.zoneType)
      setContent(initialRecord.content)
      setReviewDate(initialRecord.reviewDate)
      setReviewResult(initialRecord.reviewResult)
      setImprovementResult(initialRecord.improvementResult)
      setNote(initialRecord.note)
      setDeviceId(initialRecord.deviceId)
    } else {
      setId(nextSuggestedId)
    }
  }, [initialRecord, nextSuggestedId])

  useEffect(() => {
    const loadDevices = async (): Promise<void> => {
      const list = await unifiedApiClient.listDevices({ keyword: deviceSearchKw })
      setDeviceList(list.slice(0, 60))
    }
    void loadDevices()
  }, [deviceSearchKw])

  const handleResetNew = (): void => {
    onClearInitial()
    setId(nextSuggestedId)
    setReceivedDate(todayStr)
    setReceptionType(codes.접수구분[0] || '국민신문고')
    setReceptionNo('')
    setComplainantName('')
    setContact('')
    setLocation('')
    setZoneType(codes.구역구분[0] || '일반구역')
    setContent('')
    setReviewDate('')
    setReviewResult('검토중')
    setImprovementResult('')
    setNote('')
    setDeviceId('')
  }

  const handleSelectDevice = (d: TrafficDevice): void => {
    setDeviceId(d.deviceId)
    setLocation(`${d.location} [${d.deviceId} ${d.deviceName}]`)
    setZoneType(d.zoneType)
    if (!note.includes(d.deviceId)) {
      setNote((prev) =>
        prev ? `${prev} / 장비:${d.deviceId}(${d.enforcementType} ${d.speedLimit}km)` : `장비:${d.deviceId}(${d.enforcementType} ${d.speedLimit}km)`
      )
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const ok = await onSaveRecord({
      id: initialRecord ? initialRecord.id : id,
      receivedDate,
      receptionType,
      receptionNo,
      complainantName,
      contact,
      location,
      zoneType,
      content,
      reviewDate,
      reviewResult,
      improvementResult,
      note,
      deviceId
    })
    if (ok) {
      onBackToLedger()
    }
  }

  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측 8컬럼: 민원접수대장 13대 표준 항목 입력/수정 시트 (기존 VBA D4:D19 완벽 대응) */}
      <div className="col-span-8 min-h-0 flex flex-col">
        <UtilityCard
          title={
            initialRecord
              ? `민원접수 내역 수정 (연번 #${initialRecord.id})`
              : `신규 민원접수 등록 (예정 연번 #${id})`
          }
          badge={
            <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] text-[11px] font-semibold">
              {initialRecord ? '수정 모드' : '새 작성 모드'}
            </span>
          }
          rightAction={
            <div className="flex items-center gap-1.5">
              <PillButton variant="pearl-capsule" size="sm" onClick={handleResetNew}>
                <RotateCcw className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>새 작성(초기화)</span>
              </PillButton>
              {initialRecord && canWrite && (
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => void onDeleteRecord(initialRecord.id)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
                  <span className="text-[#dc2626]">삭제</span>
                </PillButton>
              )}
            </div>
          }
          className="flex-1 min-h-0"
        >
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex-1 min-h-0 flex flex-col justify-between gap-2.5 overflow-y-auto pr-1"
          >
            <div className="space-y-3">
              {/* 섹션 1: 접수 기본 정보 */}
              <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2.5">
                <div className="text-[12px] font-bold text-[#1e293b] flex items-center justify-between">
                  <span>1. 민원 접수 및 민원인 기본 정보</span>
                  <span className="text-[11px] text-[#64748b] font-normal">
                    * 접수구분을 직접 입력하면 다음 등록부터 목록에 자동 추가됩니다.
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      연번 (ID)
                    </label>
                    <input
                      type="number"
                      value={id}
                      onChange={(e) => setId(Number(e.target.value))}
                      disabled={Boolean(initialRecord)}
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] font-bold text-[#0f172a] disabled:bg-[#e2e8f0]"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      접수일자
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={receivedDate}
                        onChange={(e) => setReceivedDate(e.target.value)}
                        required
                        className="w-full h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] text-[#0f172a]"
                      />
                      <button
                        type="button"
                        onClick={() => setReceivedDate(todayStr)}
                        className="h-[32px] px-2 rounded-[6px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                      >
                        오늘
                      </button>
                    </div>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      접수구분 (선택 또는 직접 입력)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        list="reception-type-list"
                        value={receptionType}
                        onChange={(e) => setReceptionType(e.target.value)}
                        placeholder="예: 국민신문고, 전화민원"
                        className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                      />
                      <datalist id="reception-type-list">
                        {codes.접수구분.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      접수번호
                    </label>
                    <input
                      type="text"
                      value={receptionNo}
                      onChange={(e) => setReceptionNo(e.target.value)}
                      placeholder="예: 1AA-2611-001234"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      민원인 이름
                    </label>
                    <input
                      type="text"
                      value={complainantName}
                      onChange={(e) => setComplainantName(e.target.value)}
                      placeholder="성명 입력"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      연락처
                    </label>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="010-0000-0000"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      구역구분
                    </label>
                    <select
                      value={zoneType}
                      onChange={(e) => setZoneType(e.target.value)}
                      className="w-full h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    >
                      {codes.구역구분.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      연결 장비번호 (선택)
                    </label>
                    <input
                      type="text"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="우측 장비 클릭 시 자동입력"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#2563eb] font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                    위치 (주소 / 교차로 / 설치 장소 — 우측 단속장비 목록에서 클릭하면 자동 입력됩니다)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: 제주시 도평동 781-1 도평초교입구 사거리"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                    민원내용
                  </label>
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="민원 상세 요청 사항(신규 설치 요청, 제한속도 조정, 카메라 방향 점검 등)을 입력해 주세요."
                    className="w-full p-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a] resize-none"
                  />
                </div>
              </div>

              {/* 섹션 2: 공단 검토 및 개선 결과 */}
              <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2.5">
                <div className="text-[12px] font-bold text-[#1e293b]">
                  2. 공단 검토 및 현장 개선 결과
                </div>

                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      공단 검토일자
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={reviewDate}
                        onChange={(e) => setReviewDate(e.target.value)}
                        className="w-full h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] text-[#0f172a]"
                      />
                      <button
                        type="button"
                        onClick={() => setReviewDate(todayStr)}
                        className="h-[32px] px-2 rounded-[6px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] border border-[#a7f3d0] text-[11px] font-semibold whitespace-nowrap cursor-pointer"
                      >
                        오늘
                      </button>
                    </div>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      공단 검토결과
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        list="review-result-list"
                        value={reviewResult}
                        onChange={(e) => setReviewResult(e.target.value)}
                        className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] font-semibold text-[#0f172a]"
                      />
                      <datalist id="review-result-list">
                        {codes.검토결과.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      비고
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="참고사항 입력"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                    개선결과 (조치 내역 및 회신 내용)
                  </label>
                  <input
                    type="text"
                    value={improvementResult}
                    onChange={(e) => setImprovementResult(e.target.value)}
                    placeholder="예: 2026년 하반기 정기 설치 대상 반영 / 현장 표지판 및 차선 정비 완료"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between shrink-0">
              <PillButton
                type="button"
                variant="pearl-capsule"
                onClick={onBackToLedger}
              >
                목록으로 돌아가기
              </PillButton>

              {canWrite ? (
                <div className="flex items-center gap-2">
                  <PillButton type="submit" variant="primary">
                    {initialRecord ? (
                      <>
                        <Save className="w-4 h-4" />
                        <span>민원 수정사항 저장</span>
                      </>
                    ) : (
                      <>
                        <FilePlus2 className="w-4 h-4" />
                        <span>민원접수대장에 등록</span>
                      </>
                    )}
                  </PillButton>
                </div>
              ) : (
                <span className="text-[12px] text-[#dc2626] font-semibold">
                  열람자 권한은 조회만 가능합니다.
                </span>
              )}
            </div>
          </form>
        </UtilityCard>
      </div>

      {/* 우측 4컬럼: 무인교통단속장비 마스터(487대) 검색 및 원클릭 위치/보호구역 자동 입력 도우미 */}
      <div className="col-span-4 min-h-0 flex flex-col">
        <UtilityCard
          title="단속장비 위치 빠른 선택 (487대 연동)"
          badge={<Radio className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="gap-2.5"
        >
          <div className="text-[11.5px] text-[#64748b]">
            장비번호(예: <strong className="text-[#0f172a]">B7272</strong>)나 교차로/학교명을 검색하여 클릭하면 좌측 민원 폼의 <strong className="text-[#2563eb]">위치·구역구분·장비번호</strong>가 자동으로 채워집니다.
          </div>

          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={deviceSearchKw}
              onChange={(e) => setDeviceSearchKw(e.target.value)}
              placeholder="장비번호, 교차로명, 동/읍/면 주소 검색..."
              className="w-full h-[32px] pl-8 pr-2.5 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px] focus:outline-2 focus:outline-[#2563eb]"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {deviceList.map((d) => {
              const isLinked = deviceId === d.deviceId
              return (
                <button
                  key={d.deviceId}
                  type="button"
                  onClick={() => handleSelectDevice(d)}
                  className={`w-full text-left rounded-[8px] border p-2.5 transition-all cursor-pointer ${
                    isLinked
                      ? 'bg-[#eff6ff] border-[#2563eb]'
                      : 'bg-[#f8fafc] hover:bg-[#f1f5f9] border-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#0f172a] text-white text-[10.5px] font-bold">
                        {d.deviceId}
                      </span>
                      <span className="text-[12px] font-bold text-[#0f172a] truncate">
                        {d.deviceName}
                      </span>
                    </div>
                    {isLinked && <CheckCircle2 className="w-3.5 h-3.5 text-[#2563eb] shrink-0" />}
                  </div>
                  <div className="text-[11px] text-[#475569] mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-[#2563eb] shrink-0" />
                    <span className="truncate">{d.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10.5px]">
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-white border border-[#cbd5e1] text-[#334155] font-medium">
                      {d.zoneType}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-white border border-[#cbd5e1] text-[#334155]">
                      {d.category} · {d.enforcementType} ({d.speedLimit}km)
                    </span>
                    <span className="text-[#64748b] ml-auto">{d.installYear}년</span>
                  </div>
                </button>
              )
            })}
          </div>
        </UtilityCard>
      </div>
    </div>
  )
}
