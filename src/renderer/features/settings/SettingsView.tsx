import React, { useEffect, useState } from 'react'
import { AlertTriangle, Clock, ListPlus, Plus, RefreshCw, Save, Settings, Trash2 } from 'lucide-react'
import { AppConfig, CodeCategory } from '@shared/types/domain'
import { unifiedApiClient } from '../../services/api-client'
import { UtilityCard } from '../../components/ui/UtilityCard'
import { PillButton } from '../../components/ui/PillButton'

const AUTO_LOGOUT_PRESETS = [
  { seconds: 60, label: '1분(60초)' },
  { seconds: 180, label: '3분(180초)' },
  { seconds: 300, label: '5분(300초)' },
  { seconds: 600, label: '10분(권장)' },
  { seconds: 900, label: '15분' },
  { seconds: 1800, label: '30분' }
]

interface SettingsViewProps {
  config: AppConfig
  codes: Record<CodeCategory, string[]>
  canWrite: boolean
  canControlServer: boolean
  isSuperAdmin: boolean
  onSaveConfig: (next: AppConfig) => Promise<void>
  onRefreshSnapshot: () => Promise<void>
  onShowToast: (msg: string) => void
}

const CODE_CATEGORIES: CodeCategory[] = ['접수구분', '구역구분', '검토결과']

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  codes,
  canWrite,
  canControlServer,
  isSuperAdmin,
  onSaveConfig,
  onRefreshSnapshot,
  onShowToast
}) => {
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config)
  const [selectedCategory, setSelectedCategory] = useState<CodeCategory>('접수구분')
  const [newCodeText, setNewCodeText] = useState<string>('')
  const [confirmResetOpen, setConfirmResetOpen] = useState<boolean>(false)

  useEffect(() => {
    setDraftConfig(config)
  }, [config])

  const applyAndSaveConfig = (next: AppConfig): void => {
    setDraftConfig(next)
    if (canControlServer) {
      void onSaveConfig(next)
    }
  }

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

  const handleReloadMinwonCsv = async (): Promise<void> => {
    const res = await unifiedApiClient.reloadMinwonCsv()
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
      {/* 좌측 6컬럼: 접수구분 / 구역구분 / 공단 검토결과 동적 코드 항목 관리 */}
      <div className="col-span-6 min-h-0 flex flex-col">
        <UtilityCard
          title="민원 선택 항목 관리 (접수구분 · 구역구분 · 공단 검토결과)"
          badge={<ListPlus className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="gap-3"
        >
          <div className="text-[11.5px] text-[#64748b]">
            민원 등록 및 검색 시 선택하는 접수구분, 구역구분, 공단 검토결과 항목을 자유롭게 추가·삭제할 수 있습니다.
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

      {/* 우측 6컬럼: 시스템 환경설정 & 기존 민원 데이터 동기화 / 초기화 */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="시스템 및 다중 접속 서버 환경설정"
          badge={<Settings className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            canControlServer && (
              <PillButton
                variant="primary"
                size="sm"
                onClick={() => void onSaveConfig(draftConfig)}
              >
                <Save className="w-3.5 h-3.5" />
                <span>설정 저장</span>
              </PillButton>
            )
          }
          className="flex-1 min-h-0"
          bodyClassName="space-y-2.5 overflow-y-auto pr-1"
        >
          {/* 로그인 모달 강제 여부 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[#0f172a]">
                프로그램 시작 시 로그인 창 인증 필수
              </div>
              <div className="text-[11px] text-[#64748b]">
                사용함으로 설정하면 시작 시 항상 사용자 계정 로그인을 확인합니다.
              </div>
            </div>
            <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
              <button
                type="button"
                disabled={!canControlServer}
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
                disabled={!canControlServer}
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

          {/* 무동작(이벤트 미발생) 자동 로그아웃 설정 및 초(Seconds) 선택 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[12.5px] font-bold text-[#0f172a] inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span>무동작 시 자동 로그아웃 (보안 세션 보호)</span>
                </div>
                <div className="text-[11px] text-[#64748b]">
                  마우스·키보드 입력 이벤트가 지정된 시간(초) 동안 발생하지 않으면 자동으로 로그아웃됩니다.
                </div>
              </div>
              <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5 shrink-0">
                <button
                  type="button"
                  disabled={!canControlServer}
                  onClick={() =>
                    applyAndSaveConfig({
                      ...draftConfig,
                      system: { ...draftConfig.system, autoLogoutEnabled: true }
                    })
                  }
                  className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                    draftConfig.system.autoLogoutEnabled
                      ? 'bg-[#2563eb] text-white'
                      : 'text-[#64748b]'
                  }`}
                >
                  사용함
                </button>
                <button
                  type="button"
                  disabled={!canControlServer}
                  onClick={() =>
                    applyAndSaveConfig({
                      ...draftConfig,
                      system: { ...draftConfig.system, autoLogoutEnabled: false }
                    })
                  }
                  className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                    !draftConfig.system.autoLogoutEnabled
                      ? 'bg-[#0f172a] text-white'
                      : 'text-[#64748b]'
                  }`}
                >
                  사용 안 함
                </button>
              </div>
            </div>

            {draftConfig.system.autoLogoutEnabled && (
              <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between gap-1.5 flex-nowrap">
                <div className="flex items-center gap-1 flex-nowrap">
                  {AUTO_LOGOUT_PRESETS.map((preset) => {
                    const selected = draftConfig.system.autoLogoutSeconds === preset.seconds
                    return (
                      <button
                        key={preset.seconds}
                        type="button"
                        disabled={!canControlServer}
                        onClick={() =>
                          applyAndSaveConfig({
                            ...draftConfig,
                            system: {
                              ...draftConfig.system,
                              autoLogoutSeconds: preset.seconds
                            }
                          })
                        }
                        className={`h-[26px] px-2 rounded-[5px] text-[11px] font-bold border transition-colors whitespace-nowrap cursor-pointer ${
                          selected
                            ? 'bg-[#2563eb] text-white border-[#2563eb]'
                            : 'bg-white hover:bg-[#eff6ff] text-[#334155] border-[#cbd5e1]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>

                <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                  <span className="text-[11px] text-[#64748b] font-semibold">직접 입력:</span>
                  <input
                    type="number"
                    min={10}
                    max={86400}
                    disabled={!canControlServer}
                    value={draftConfig.system.autoLogoutSeconds || 600}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        system: {
                          ...draftConfig.system,
                          autoLogoutSeconds: Math.max(10, Number(e.target.value) || 60)
                        }
                      })
                    }
                    onBlur={() => applyAndSaveConfig(draftConfig)}
                    className="w-[64px] h-[26px] px-1.5 rounded-[5px] border border-[#cbd5e1] bg-white text-center font-extrabold text-[11.5px] text-[#2563eb]"
                  />
                  <span className="text-[11px] font-bold text-[#334155]">초</span>
                </div>
              </div>
            )}
          </div>

          {/* 프로그램 시작 시 다중 접속 서버 자동 기동 */}
          <div className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between">
            <div>
              <div className="text-[12.5px] font-bold text-[#0f172a]">
                프로그램 시작 시 다중 접속 서버 자동 켜기
              </div>
              <div className="text-[11px] text-[#64748b]">
                켜 두면 프로그램을 실행할 때 다른 사용자 접속용 서버가 자동으로 함께 기동됩니다.
              </div>
            </div>
            <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
              <button
                type="button"
                disabled={!canControlServer}
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
                disabled={!canControlServer}
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
                창 닫기 버튼 클릭 시 작업표시줄 트레이로 숨기기
              </div>
              <div className="text-[11px] text-[#64748b]">
                다중 접속 서버가 켜진 상태에서 창을 닫아도 백그라운드 서버가 유지됩니다.
              </div>
            </div>
            <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
              <button
                type="button"
                disabled={!canControlServer}
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
                disabled={!canControlServer}
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
                다중 접속 서버 기본 포트 번호
              </div>
              <div className="text-[11px] text-[#64748b]">
                다른 컴퓨터 사용자들이 접속할 포트 번호입니다 (기본값: 8090).
              </div>
            </div>
            <input
              type="number"
              disabled={!canControlServer}
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

        {/* 기존 민원 데이터(114건) 복원 및 전체 초기화 */}
        <UtilityCard
          title="기존 민원접수대장 데이터 복원 및 초기화"
          badge={<AlertTriangle className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11.5px] text-[#64748b]">
              기존 민원접수대장 데이터(114건)를 다시 불러오거나 전체 초기화합니다.
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {canWrite && (
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => void handleReloadMinwonCsv()}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#059669]" />
                  <span>기존 민원(114건) 복원</span>
                </PillButton>
              )}
              {isSuperAdmin && !confirmResetOpen && (
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => setConfirmResetOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#dc2626]" />
                  <span className="text-[#dc2626] font-bold">전체 초기화</span>
                </PillButton>
              )}
              {isSuperAdmin && confirmResetOpen && (
                <>
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
                </>
              )}
            </div>
          </div>
        </UtilityCard>
      </div>
    </div>
  )
}
