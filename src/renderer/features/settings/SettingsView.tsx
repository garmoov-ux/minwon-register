import React, { useState } from 'react'
import { AlertTriangle, ListPlus, Plus, Save, Settings, Trash2 } from 'lucide-react'
import { AppConfig, CodeCategory } from '@shared/types/domain'
import { unifiedApiClient } from '../../services/api-client'
import { UtilityCard } from '../../components/ui/UtilityCard'
import { PillButton } from '../../components/ui/PillButton'

interface SettingsViewProps {
  config: AppConfig
  codes: Record<CodeCategory, string[]>
  canWrite: boolean
  isAdmin: boolean
  onSaveConfig: (next: AppConfig) => Promise<void>
  onRefreshSnapshot: () => Promise<void>
  onShowToast: (msg: string) => void
}

const CODE_CATEGORIES: CodeCategory[] = ['접수구분', '구역구분', '검토결과']

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  codes,
  canWrite,
  isAdmin,
  onSaveConfig,
  onRefreshSnapshot,
  onShowToast
}) => {
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config)
  const [selectedCategory, setSelectedCategory] = useState<CodeCategory>('접수구분')
  const [newCodeText, setNewCodeText] = useState<string>('')
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false)

  const handleAddCode = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newCodeText.trim()) return
    const res = await unifiedApiClient.addCodeItem(selectedCategory, newCodeText.trim())
    onShowToast(res.message)
    setNewCodeText('')
    await onRefreshSnapshot()
  }

  const handleDeleteCode = async (value: string): Promise<void> => {
    const res = await unifiedApiClient.deleteCodeItem(selectedCategory, value)
    onShowToast(res.message)
    await onRefreshSnapshot()
  }

  const handleResetAllMinwon = async (): Promise<void> => {
    const res = await unifiedApiClient.resetAllMinwon()
    onShowToast(res.message)
    setConfirmResetOpen(false)
    await onRefreshSnapshot()
  }

  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측 6컬럼: 접수구분 / 구역구분 / 공단 검토결과 동적 코드 항목 관리 (기존 VBA Sheet2~Sheet4) */}
      <div className="col-span-6 min-h-0 flex flex-col">
        <UtilityCard
          title="민원 선택 항목 관리 (접수구분 · 구역구분 · 공단 검토결과)"
          badge={<ListPlus className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="gap-3"
        >
          <div className="text-[11.5px] text-[#64748b]">
            기존 엑셀 숨김 시트(Sheet2~Sheet4)에서 관리하던 선택 목록을 이곳에서 손쉽게 추가·삭제할 수 있습니다.
          </div>

          <div className="inline-flex rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] p-0.5 shrink-0">
            {CODE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`flex-1 h-[28px] rounded-[6px] text-[12px] font-bold cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#475569] hover:text-[#0f172a]'
                }`}
              >
                {cat} ({codes[cat]?.length || 0})
              </button>
            ))}
          </div>

          {canWrite && (
            <form onSubmit={(e) => void handleAddCode(e)} className="flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={newCodeText}
                onChange={(e) => setNewCodeText(e.target.value)}
                placeholder={`새로운 [${selectedCategory}] 항목명 입력...`}
                className="flex-1 h-[32px] px-3 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12.5px]"
              />
              <PillButton type="submit" variant="primary" size="sm">
                <Plus className="w-3.5 h-3.5" />
                <span>항목 추가</span>
              </PillButton>
            </form>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
            {(codes[selectedCategory] || []).map((val) => (
              <div
                key={val}
                className="rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] px-3 py-2 flex items-center justify-between text-[12.5px]"
              >
                <span className="font-semibold text-[#0f172a]">{val}</span>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteCode(val)}
                    className="p-1 rounded-[5px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] cursor-pointer"
                    title="항목 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </UtilityCard>
      </div>

      {/* 우측 6컬럼: 시스템 환경설정 & 데이터 초기화 */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="시스템 및 다중 접속 서버 환경설정"
          badge={<Settings className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            <PillButton
              variant="primary"
              size="sm"
              onClick={() => void onSaveConfig(draftConfig)}
            >
              <Save className="w-3.5 h-3.5" />
              <span>설정 저장</span>
            </PillButton>
          }
          className="flex-1 min-h-0"
          bodyClassName="space-y-2.5 overflow-y-auto pr-1"
        >
          {/* 로그인 모달 강제 여부 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[#0f172a]">
                프로그램 시작 시 로그인 모달 인증 필수
              </div>
              <div className="text-[11px] text-[#64748b]">
                사용함으로 설정하면 시작 시 항상 담당자 계정 로그인을 확인합니다.
              </div>
            </div>
            <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
              <button
                type="button"
                onClick={() =>
                  setDraftConfig({
                    ...draftConfig,
                    system: { ...draftConfig.system, requireLoginOnStart: true }
                  })
                }
                className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                  draftConfig.system.requireLoginOnStart
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#64748b]'
                }`}
              >
                사용함
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftConfig({
                    ...draftConfig,
                    system: { ...draftConfig.system, requireLoginOnStart: false }
                  })
                }
                className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                  !draftConfig.system.requireLoginOnStart
                    ? 'bg-[#0f172a] text-white'
                    : 'text-[#64748b]'
                }`}
              >
                사용 안 함
              </button>
            </div>
          </div>

          {/* 프로그램 시작 시 REST API 서버 자동 기동 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[#0f172a]">
                프로그램 시작 시 다중 접속 REST API 서버 자동 켜기
              </div>
              <div className="text-[11px] text-[#64748b]">
                켜 두면 앱을 실행할 때 다른 사용자 접속용 서버가 자동으로 함께 기동됩니다.
              </div>
            </div>
            <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
              <button
                type="button"
                onClick={() =>
                  setDraftConfig({
                    ...draftConfig,
                    server: {
                      ...draftConfig.server,
                      autoStartOnBoot: true,
                      enabled: true
                    }
                  })
                }
                className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                  draftConfig.server.autoStartOnBoot
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#64748b]'
                }`}
              >
                자동 켜기
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftConfig({
                    ...draftConfig,
                    server: { ...draftConfig.server, autoStartOnBoot: false }
                  })
                }
                className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                  !draftConfig.server.autoStartOnBoot
                    ? 'bg-[#0f172a] text-white'
                    : 'text-[#64748b]'
                }`}
              >
                수동 제어
              </button>
            </div>
          </div>

          {/* 창 닫기 시 트레이 최소화 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[#0f172a]">
                창 닫기(X) 클릭 시 작업표시줄 트레이로 숨기기
              </div>
              <div className="text-[11px] text-[#64748b]">
                다중 접속 서버가 켜진 상태에서 실수로 창을 닫아도 백그라운드 서버가 유지됩니다.
              </div>
            </div>
            <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
              <button
                type="button"
                onClick={() =>
                  setDraftConfig({
                    ...draftConfig,
                    system: { ...draftConfig.system, minimizeToTray: true }
                  })
                }
                className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                  draftConfig.system.minimizeToTray
                    ? 'bg-[#2563eb] text-white'
                    : 'text-[#64748b]'
                }`}
              >
                사용함
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraftConfig({
                    ...draftConfig,
                    system: { ...draftConfig.system, minimizeToTray: false }
                  })
                }
                className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                  !draftConfig.system.minimizeToTray
                    ? 'bg-[#0f172a] text-white'
                    : 'text-[#64748b]'
                }`}
              >
                즉시 종료
              </button>
            </div>
          </div>

          {/* 다중 접속 서버 포트 설정 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[#0f172a]">
                다중 접속 REST API 서버 기본 포트
              </div>
              <div className="text-[11px] text-[#64748b]">
                다른 사용자들이 접속할 TCP 포트 번호입니다 (기본값: 8090).
              </div>
            </div>
            <input
              type="number"
              value={draftConfig.server.port}
              onChange={(e) =>
                setDraftConfig({
                  ...draftConfig,
                  server: { ...draftConfig.server, port: Number(e.target.value) }
                })
              }
              className="w-[90px] h-[30px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-center font-bold text-[12.5px]"
            />
          </div>
        </UtilityCard>

        {/* 민원 데이터 전체 초기화 (기존 VBA InitData 2단계 안전 확인 계승) */}
        {isAdmin && (
          <UtilityCard
            title="데이터 안전 초기화 (관리자 전용)"
            badge={<AlertTriangle className="w-3.5 h-3.5 text-[#dc2626]" />}
            className="shrink-0"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11.5px] text-[#64748b]">
                등록된 민원접수대장 레코드를 모두 초기화합니다. (단속장비 487대 마스터와 사용자 계정은 유지됩니다)
              </div>
              {!confirmResetOpen ? (
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => setConfirmResetOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
                  <span className="text-[#dc2626] font-bold">민원 전체 초기화</span>
                </PillButton>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <PillButton
                    variant="pearl-capsule"
                    size="sm"
                    onClick={() => setConfirmResetOpen(false)}
                  >
                    취소
                  </PillButton>
                  <PillButton
                    variant="dark-utility"
                    size="sm"
                    onClick={() => void handleResetAllMinwon()}
                  >
                    <span className="text-[#fca5a5] font-bold">최종 삭제 확인</span>
                  </PillButton>
                </div>
              )}
            </div>
          </UtilityCard>
        )}
      </div>
    </div>
  )
}
