import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  FilePlus2,
  MapPin,
  RotateCcw,
  Save,
  Search,
  Trash2,
  User
} from 'lucide-react'
import {
  CodeCategory,
  MinwonRecord,
  MinwonUpsertPayload
} from '@shared/types/domain'
import { formatIsoDate, generateJspdDocumentNo } from '@shared/date-ranges'
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

  const [allMinwonRecords, setAllMinwonRecords] = useState<MinwonRecord[]>([])
  const [editingTarget, setEditingTarget] = useState<MinwonRecord | null>(initialRecord)

  const [id, setId] = useState<number>(initialRecord?.id || nextSuggestedId)
  const [receivedDate, setReceivedDate] = useState<string>(
    initialRecord?.receivedDate || todayStr
  )
  const [receptionType, setReceptionType] = useState<string>(
    initialRecord?.receptionType || codes.접수구분[0] || '국민신문고'
  )
  const [receptionNo, setReceptionNo] = useState<string>(
    initialRecord?.receptionNo || `JSPD-${todayStr}-01`
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

  // 우측: 기존 민원접수대장 검색 및 값 가져오기 패널 상태
  const [minwonSearchKw, setMinwonSearchKw] = useState<string>('')
  const [minwonResultFilter, setMinwonResultFilter] = useState<string>('전체')
  const [selectedRefId, setSelectedRefId] = useState<number | null>(initialRecord?.id || null)

  const loadExistingMinwon = async (): Promise<MinwonRecord[]> => {
    const list = await unifiedApiClient.listMinwon({})
    setAllMinwonRecords(list)
    return list
  }

  useEffect(() => {
    void loadExistingMinwon().then((list) => {
      if (!initialRecord) {
        const autoDocNo = generateJspdDocumentNo(todayStr, list)
        setReceptionNo(autoDocNo)
      }
    })
  }, [])

  useEffect(() => {
    setEditingTarget(initialRecord)
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
      setSelectedRefId(initialRecord.id)
    } else {
      setId(nextSuggestedId)
      setReceptionNo(generateJspdDocumentNo(receivedDate, allMinwonRecords))
      setSelectedRefId(null)
    }
  }, [initialRecord, nextSuggestedId])

  const handleReceivedDateChange = (nextDate: string): void => {
    setReceivedDate(nextDate)
    // 신규 작성 중이고 문서번호가 자동 채번 형식(JSPD-...)일 때 접수일자에 맞춰 자동 갱신
    if (!editingTarget && (!receptionNo.trim() || receptionNo.startsWith('JSPD-'))) {
      setReceptionNo(generateJspdDocumentNo(nextDate, allMinwonRecords))
    }
  }

  const handleResetNew = (): void => {
    onClearInitial()
    setEditingTarget(null)
    setSelectedRefId(null)
    setId(nextSuggestedId)
    setReceivedDate(todayStr)
    setReceptionType(codes.접수구분[0] || '국민신문고')
    setReceptionNo(generateJspdDocumentNo(todayStr, allMinwonRecords))
    setComplainantName('')
    setContact('')
    setLocation('')
    setZoneType(codes.구역구분[0] || '일반구역')
    setContent('')
    setReviewDate('')
    setReviewResult('대기중')
    setImprovementResult('')
    setNote('')
  }

  /**
   * 우측 기존 민원 카드 클릭 시: 신규 작성 중이면 위치/구역구분/민원내용 등을 현재 폼으로 가져오고,
   *[이 민원 수정] 버튼을 누르면 해당 연번의 수정 모드로 전환한다.
   */
  const handleCopyFromExisting = (rec: MinwonRecord): void => {
    setSelectedRefId(rec.id)
    setLocation(rec.location)
    setZoneType(rec.zoneType || '일반구역')
    setContent(rec.content)
    if (rec.receptionType) setReceptionType(rec.receptionType)
    if (!note.includes(`#${rec.id}`)) {
      setNote((prev) =>
        prev
          ? `${prev} / 기존민원 참조(#${rec.id} ${rec.receivedDate} ${rec.reviewResult})`
          : `기존민원 참조(#${rec.id} ${rec.receivedDate} ${rec.reviewResult})`
      )
    }
  }

  const handleSwitchToEdit = (rec: MinwonRecord): void => {
    setEditingTarget(rec)
    setSelectedRefId(rec.id)
    setId(rec.id)
    setReceivedDate(rec.receivedDate)
    setReceptionType(rec.receptionType)
    setReceptionNo(rec.receptionNo)
    setComplainantName(rec.complainantName)
    setContact(rec.contact)
    setLocation(rec.location)
    setZoneType(rec.zoneType)
    setContent(rec.content)
    setReviewDate(rec.reviewDate)
    setReviewResult(rec.reviewResult)
    setImprovementResult(rec.improvementResult)
    setNote(rec.note)
  }

  const savePayload = async (stayAndNew: boolean): Promise<void> => {
    const ok = await onSaveRecord({
      id: editingTarget ? editingTarget.id : id,
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
      note
    })
    if (!ok) return

    const updatedList = await loadExistingMinwon()

    if (stayAndNew) {
      onClearInitial()
      setEditingTarget(null)
      setSelectedRefId(null)
      const nextId = id + 1
      setId(nextId)
      setReceivedDate(todayStr)
      setReceptionNo(generateJspdDocumentNo(todayStr, updatedList))
      setComplainantName('')
      setContact('')
      setLocation('')
      setContent('')
      setReviewDate('')
      setReviewResult('대기중')
      setImprovementResult('')
      setNote('')
    } else {
      onBackToLedger()
    }
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    await savePayload(false)
  }

  // 우측 기존 민원 필터링
  const filteredExistingMinwon = allMinwonRecords.filter((r) => {
    if (
      minwonResultFilter !== '전체' &&
      r.reviewResult !== minwonResultFilter
    ) {
      return false
    }
    const kw = minwonSearchKw.trim().toLowerCase()
    if (!kw) return true
    return (
      r.location.toLowerCase().includes(kw) ||
      r.content.toLowerCase().includes(kw) ||
      r.complainantName.toLowerCase().includes(kw) ||
      r.receptionNo.toLowerCase().includes(kw) ||
      r.note.toLowerCase().includes(kw) ||
      r.improvementResult.toLowerCase().includes(kw) ||
      String(r.id).includes(kw)
    )
  })

  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측 8컬럼: 민원접수대장 등록/수정 시트 */}
      <div className="col-span-8 min-h-0 flex flex-col">
        <UtilityCard
          title={
            editingTarget
              ? `민원접수 내역 수정 (연번 #${editingTarget.id})`
              : `신규 민원접수 등록 (연번 #${id})`
          }
          badge={
            <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#2563eb] border border-[#bfdbfe] text-[11px] font-semibold">
              {editingTarget ? '수정 모드' : '신규 작성'}
            </span>
          }
          rightAction={
            <div className="flex items-center gap-1.5">
              <PillButton variant="pearl-capsule" size="sm" onClick={handleResetNew}>
                <RotateCcw className="w-3.5 h-3.5 text-[#2563eb]" />
                <span>신규 작성(초기화)</span>
              </PillButton>
              {editingTarget && canWrite && (
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => void onDeleteRecord(editingTarget.id)}
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

                {/* 연번 / 접수일자 / 문서(접수)번호 (JSPD-년-월-일-순번 자동채번) / 이름 / 연락처 */}
                <div className="grid grid-cols-12 gap-2.5">
                  <div className="col-span-1">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1 whitespace-nowrap">
                      연번
                    </label>
                    <input
                      type="number"
                      value={id}
                      onChange={(e) => setId(Number(e.target.value))}
                      disabled={Boolean(editingTarget)}
                      className="w-full h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] font-bold text-[#0f172a] disabled:bg-[#e2e8f0] text-center"
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
                        onChange={(e) => handleReceivedDateChange(e.target.value)}
                        required
                        className="w-full h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] text-[#0f172a]"
                      />
                      <button
                        type="button"
                        onClick={() => handleReceivedDateChange(todayStr)}
                        className="h-[32px] px-2 rounded-[6px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] text-[11px] font-bold whitespace-nowrap cursor-pointer"
                      >
                        오늘
                      </button>
                    </div>
                  </div>

                  <div className="col-span-3">
                    <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                      문서(접수)번호
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={receptionNo}
                        onChange={(e) => setReceptionNo(e.target.value)}
                        placeholder="JSPD-년-월-일-01"
                        className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] font-bold text-[#2563eb]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setReceptionNo(generateJspdDocumentNo(receivedDate, allMinwonRecords))
                        }
                        title="관공서 문서번호(JSPD-년-월-일-순번) 자동 생성"
                        className="h-[32px] px-2 rounded-[6px] bg-white hover:bg-[#eff6ff] border border-[#cbd5e1] text-[11px] font-semibold text-[#334155] whitespace-nowrap cursor-pointer"
                      >
                        자동채번
                      </button>
                    </div>
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

                {/* 구역구분 원클릭 칩 */}
                <div>
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

                {/* 민원 위치 */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                    민원 위치 (주소 / 교차로 / 학교명 — 우측 기존 민원 목록에서 선택하면 값을 가져올 수 있습니다)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="예: 제주시 아라일동 1960-1 아라요양병원 앞"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] text-[#0f172a]"
                  />
                </div>

                {/* 민원내용 + 다음 행에 자주 쓰는 문구 칩 배치 */}
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
                  {!editingTarget && (
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
                    <span>{editingTarget ? '민원 수정사항 저장' : '민원접수대장에 등록'}</span>
                  </PillButton>
                </div>
              )}
            </div>
          </form>
        </UtilityCard>
      </div>

      {/* 우측 4컬럼: 기존 민원내용·위치·민원인 검색 및 값 가져오기 사이드패널 */}
      <div className="col-span-4 min-h-0 flex flex-col">
        <UtilityCard
          title={`기존 민원내용 검색 및 값 가져오기 (${filteredExistingMinwon.length}건)`}
          badge={<ClipboardList className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="gap-2"
        >
          <div className="relative shrink-0">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={minwonSearchKw}
              onChange={(e) => setMinwonSearchKw(e.target.value)}
              placeholder="기존 민원 위치(동/리), 민원내용, 민원인, 비고 검색..."
              className="w-full h-[32px] pl-8 pr-2.5 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12px] focus:outline-2 focus:outline-[#2563eb]"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap shrink-0">
            {['전체', '대기중', '적합', '부적합', '불합리', '검토완료'].map((resLabel) => (
              <button
                key={resLabel}
                type="button"
                onClick={() => setMinwonResultFilter(resLabel)}
                className={`px-2 py-1 rounded-[5px] text-[11px] font-semibold border cursor-pointer ${
                  minwonResultFilter === resLabel
                    ? 'bg-[#2563eb] text-white border-[#2563eb]'
                    : 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]'
                }`}
              >
                {resLabel}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {filteredExistingMinwon.map((rec) => {
              const isSelected = selectedRefId === rec.id
              return (
                <div
                  key={rec.id}
                  onClick={() => handleCopyFromExisting(rec)}
                  className={`w-full text-left rounded-[8px] border p-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#eff6ff] border-[#2563eb]'
                      : 'bg-[#f8fafc] hover:bg-[#f1f5f9] border-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#0f172a] text-white text-[10.5px] font-bold">
                        #{rec.id}
                      </span>
                      <span className="text-[11px] font-semibold text-[#64748b]">
                        {rec.receivedDate}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-white border border-[#cbd5e1] text-[10.5px] font-semibold text-[#334155]">
                        {rec.receptionType}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[#fef3c7] text-[#b45309] text-[10.5px] font-bold">
                        {rec.reviewResult || '대기중'}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#2563eb]" />}
                    </div>
                  </div>

                  <div className="text-[12px] font-bold text-[#0f172a] mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#2563eb] shrink-0" />
                    <span className="truncate" title={rec.location}>
                      {rec.location}
                    </span>
                  </div>

                  <div className="text-[11.5px] text-[#334155] mt-0.5 truncate" title={rec.content}>
                    {rec.content}
                  </div>

                  {rec.note && (
                    <div className="text-[10.5px] text-[#64748b] mt-0.5 truncate" title={rec.note}>
                      비고: {rec.note}
                    </div>
                  )}

                  <div
                    className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#e2e8f0] text-[10.5px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="inline-flex items-center gap-1 text-[#475569] font-medium">
                      <User className="w-3 h-3 text-[#64748b]" />
                      {rec.complainantName || '-'} · {rec.zoneType}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyFromExisting(rec)}
                        className="px-2 py-0.5 rounded-[4px] bg-white hover:bg-[#eff6ff] border border-[#cbd5e1] text-[#2563eb] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                        title="위치·구역구분·민원내용을 신규 작성 폼으로 가져오기"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>값 가져오기</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchToEdit(rec)}
                        className="px-2 py-0.5 rounded-[4px] bg-white hover:bg-[#f1f5f9] border border-[#cbd5e1] text-[#334155] font-bold inline-flex items-center gap-0.5 cursor-pointer"
                        title="이 민원 내역 자체를 수정 모드로 열기"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>바로 수정</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </UtilityCard>
      </div>
    </div>
  )
}
