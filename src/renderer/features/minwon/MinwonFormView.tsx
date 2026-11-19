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

const QUICK_CONTENT_TEMPLATES = [
  '과속단속장비 설치요청',
  '신호과속단속장비 설치요청',
  '전·후면 과속단속장비 설치요청',
  '과속단속장비 이설요청',
  '제한속도 하향 및 표지판 정비 요청',
  '이동식 단속부스 설치요청'
]

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
  const [receptionNo, setReceptionNo] = useState<string>(
    initialRecord?.receptionNo || String(nextSuggestedId)
  )
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
    initialRecord?.reviewResult || codes.검토결과[0] || '대기중'
  )
  const [improvementResult, setImprovementResult] = useState<string>(
    initialRecord?.improvementResult || ''
  )
  const [note, setNote] = useState<string>(initialRecord?.note || '')
  const [deviceId, setDeviceId] = useState<string>(initialRecord?.deviceId || '')

  // 우측 단속장비 위치 빠른 검색 연동
  const [deviceSearchKw, setDeviceSearchKw] = useState<string>('')
  const [deviceZoneFilter, setDeviceZoneFilter] = useState<string>('전체')
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
      setReceptionNo(String(nextSuggestedId))
    }
  }, [initialRecord, nextSuggestedId])

  useEffect(() => {
    const loadDevices = async (): Promise<void> => {
      const list = await unifiedApiClient.listDevices({
        keyword: deviceSearchKw,
        zoneType: deviceZoneFilter === '전체' ? '' : deviceZoneFilter
      })
      setDeviceList(list.slice(0, 80))
    }
    void loadDevices()
  }, [deviceSearchKw, deviceZoneFilter])

  const handleResetNew = (): void => {
    onClearInitial()
    setId(nextSuggestedId)
    setReceivedDate(todayStr)
    setReceptionType(codes.접수구분[0] || '국민신문고')
    setReceptionNo(String(nextSuggestedId))
    setComplainantName('')
    setContact('')
    setLocation('')
    setZoneType(codes.구역구분[0] || '일반구역')
    setContent('')
    setReviewDate('')
    setReviewResult('대기중')
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
        prev
          ? `${prev} / 장비:${d.deviceId}(${d.enforcementType} ${d.speedLimit}km)`
          : `장비:${d.deviceId}(${d.enforcementType} ${d.speedLimit}km)`
      )
    }
  }

  const savePayload = async (stayAndNew: boolean): Promise<void> => {
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
    if (!ok) return

    if (stayAndNew) {
      handleResetNew()
      setId(id + 1)
      setReceptionNo(String(id + 1))
    } else {
      onBackToLedger()
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await savePayload(false)
  }

  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측 8컬럼: 민원접수대장 등록/수정 시트 (원클릭 칩 버튼 + 직접입력 결합) */}
      <div className="col-span-8 min-h-0 flex flex-col">
        <UtilityCard
          title={
            initialRecord
              ? `민원접수 내역 수정 (연번 #${initialRecord.id})`
              : `신규 민원접수 등록 (연번 #${id})`
          }
          badge={
            <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] text-[11px] font-semibold">
              {initialRecord ? '수정 모드' : '신규 작성'}
            </span>
          }
          rightAction={
            <div className="flex items-center gap-1.5">
              <PillButton variant="pearl-capsule" size="sm" onClick={handleResetNew}>
                <RotateCcw className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>입력 초기화</span>
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
            <div className="space-y-2.5">
              {/* 섹션 1: 민원 접수 기본 정보 */}
              <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2.5">
                <div className="text-[12px] font-bold text-[#0f172a]">
                  1. 민원 접수 및 민원인 기본 정보
                </div>

                {/* 연번 / 접수일자 / 접수번호 / 민원인 이름 / 연락처 */}
                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      연번
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
                        className="h-[32px] px-2 rounded-[6px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] text-[11px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        오늘
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      접수번호
                    </label>
                    <input
                      type="text"
                      value={receptionNo}
                      onChange={(e) => setReceptionNo(e.target.value)}
                      placeholder="접수번호"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      민원인 이름
                    </label>
                    <input
                      type="text"
                      value={complainantName}
                      onChange={(e) => setComplainantName(e.target.value)}
                      placeholder="성명 (없으면 -)"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] font-semibold text-[#0f172a]"
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
                </div>

                {/* 접수구분: 원클릭 선택 칩 + 직접 입력 */}
                <div className="grid grid-cols-12 gap-2.5 items-center">
                  <div className="col-span-8">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      접수구분 빠른 선택
                    </label>
                    <div className="flex items-center gap-1 flex-wrap">
                      {codes.접수구분.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setReceptionType(item)}
                          className={`h-[29px] px-2.5 rounded-[6px] text-[11.5px] font-semibold border transition-all cursor-pointer ${
                            receptionType === item
                              ? 'bg-[#2563eb] text-white border-[#2563eb]'
                              : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      접수구분 직접 입력 (자동 추가)
                    </label>
                    <input
                      type="text"
                      value={receptionType}
                      onChange={(e) => setReceptionType(e.target.value)}
                      placeholder="새로운 접수구분 입력"
                      className="w-full h-[30px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] font-semibold text-[#0f172a]"
                    />
                  </div>
                </div>

                {/* 구역구분 원클릭 칩 + 연결 장비번호 */}
                <div className="grid grid-cols-12 gap-2.5 items-center">
                  <div className="col-span-8">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      구역구분 선택
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {codes.구역구분.map((z) => (
                        <button
                          key={z}
                          type="button"
                          onClick={() => setZoneType(z)}
                          className={`h-[29px] px-3 rounded-[6px] text-[11.5px] font-semibold border transition-all cursor-pointer ${
                            zoneType === z
                              ? 'bg-[#0f172a] text-white border-[#0f172a]'
                              : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]'
                          }`}
                        >
                          {z}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      연결 장비번호 (우측 장비 클릭 시 자동 입력)
                    </label>
                    <input
                      type="text"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      placeholder="예: B7272"
                      className="w-full h-[30px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] font-bold text-[#2563eb]"
                    />
                  </div>
                </div>

                {/* 위치 */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                    민원 위치 (직접 입력하거나 우측 단속장비 목록에서 클릭하면 자동 입력됩니다)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: 제주시 아라일동 1960-1 아라요양병원 앞"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                  />
                </div>

                {/* 민원내용 + 다음 행에 자주 쓰는 문구 칩 배치 (빠른 문구 텍스트 없이) */}
                <div className="space-y-1.5">
                  <label className="block text-[11.5px] font-semibold text-[#475569] whitespace-nowrap">
                    민원내용
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QUICK_CONTENT_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => setContent(tpl)}
                        className="px-2.5 py-1 rounded-[5px] bg-white hover:bg-[#eff6ff] border border-[#cbd5e1] text-[11px] font-semibold text-[#334155] hover:text-[#1d4ed8] transition-colors cursor-pointer"
                      >
                        {tpl}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="민원 상세 요청 사항을 입력해 주세요."
                    className="w-full p-2 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a] resize-none"
                  />
                </div>
              </div>

              {/* 섹션 2: 공단 검토 및 개선 결과 */}
              <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2.5">
                <div className="text-[12px] font-bold text-[#0f172a]">
                  2. 공단 검토 및 현장 개선 결과
                </div>

                {/* 공단 검토결과 원클릭 칩 */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                    공단 검토결과 빠른 선택
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {codes.검토결과.map((resItem) => (
                      <button
                        key={resItem}
                        type="button"
                        onClick={() => setReviewResult(resItem)}
                        className={`h-[29px] px-2.5 rounded-[6px] text-[11.5px] font-semibold border transition-all cursor-pointer ${
                          reviewResult === resItem
                            ? 'bg-[#2563eb] text-white border-[#2563eb]'
                            : 'bg-white hover:bg-[#f1f5f9] text-[#334155] border-[#cbd5e1]'
                        }`}
                      >
                        {resItem}
                      </button>
                    ))}
                  </div>
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
                        className="h-[32px] px-2 rounded-[6px] bg-[#ecfdf5] hover:bg-[#d1fae5] text-[#047857] border border-[#a7f3d0] text-[11px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        오늘
                      </button>
                    </div>
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      개선결과 (조치 및 답변 내역)
                    </label>
                    <input
                      type="text"
                      value={improvementResult}
                      onChange={(e) => setImprovementResult(e.target.value)}
                      placeholder="예: 검토 완료 후 회신 예정 / 설치불가능"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>

                  <div className="col-span-4">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      비고 (국민신문고 번호 / 현장면담 등)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="예: 1AA-2611-0520856"
                      className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between shrink-0">
              <PillButton
                type="button"
                variant="pearl-capsule"
                onClick={onBackToLedger}
              >
                대장 목록으로 이동
              </PillButton>

              {canWrite && (
                <div className="flex items-center gap-2">
                  {!initialRecord && (
                    <PillButton
                      type="button"
                      variant="secondary-pill"
                      onClick={() => void savePayload(true)}
                    >
                      <FilePlus2 className="w-4 h-4" />
                      <span>등록 후 계속 추가</span>
                    </PillButton>
                  )}
                  <PillButton type="submit" variant="primary">
                    <Save className="w-4 h-4" />
                    <span>{initialRecord ? '민원 수정사항 저장' : '민원접수대장에 등록'}</span>
                  </PillButton>
                </div>
              )}
            </div>
          </form>
        </UtilityCard>
      </div>

      {/* 우측 4컬럼: 무인교통단속장비 마스터(487대) 검색 및 원클릭 위치 연동 */}
      <div className="col-span-4 min-h-0 flex flex-col">
        <UtilityCard
          title="단속장비 위치 빠른 선택 (487대)"
          badge={<Radio className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="gap-2"
        >
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={deviceSearchKw}
              onChange={(e) => setDeviceSearchKw(e.target.value)}
              placeholder="장비번호(B7272), 교차로명, 동/읍/면 주소 검색..."
              className="w-full h-[32px] pl-8 pr-2.5 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px] focus:outline-2 focus:outline-[#2563eb]"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap shrink-0">
            {['전체', '일반구역', '어린이보호구역', '노인보호구역'].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setDeviceZoneFilter(z)}
                className={`px-2 py-1 rounded-[5px] text-[11px] font-semibold border cursor-pointer ${
                  deviceZoneFilter === z
                    ? 'bg-[#2563eb] text-white border-[#2563eb]'
                    : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]'
                }`}
              >
                {z}
              </button>
            ))}
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
