import React from 'react'
import {
  BarChart3,
  ClipboardList,
  FilePlus2,
  Info,
  LogOut,
  Radio,
  Server,
  Settings,
  Shield,
  UserCheck
} from 'lucide-react'
import { AuthSession, RestServerStatus } from '@shared/types/domain'

export type NavTabId =
  | 'ledger'
  | 'register'
  | 'devices'
  | 'stats'
  | 'server'
  | 'settings'
  | 'about'

interface GlobalNavProps {
  activeTab: NavTabId
  onSelectTab: (tab: NavTabId) => void
  serverStatus: RestServerStatus
  session: AuthSession | null
  canControlServer: boolean
  onToggleServer: (next: boolean) => void
  onOpenAccountModal: () => void
}

const TABS: Array<{ id: NavTabId; label: string; title: string; icon: React.ReactNode }> = [
  {
    id: 'ledger',
    label: '대장',
    title: '민원접수대장 통합 조회 · 기간별 검색 · 엑셀 내보내기',
    icon: <ClipboardList className="w-[16px] h-[16px]" />
  },
  {
    id: 'register',
    label: '등록',
    title: '민원 신규 접수 · 공단 검토결과 입력 및 단속장비 위치 연동',
    icon: <FilePlus2 className="w-[16px] h-[16px]" />
  },
  {
    id: 'devices',
    label: '장비',
    title: '무인교통단속장비 마스터(487대) 및 연도별·유형별 운영현황 통계표',
    icon: <Radio className="w-[16px] h-[16px]" />
  },
  {
    id: 'stats',
    label: '통계',
    title: '민원 처리 현황 및 보호구역·단속유형 시각화 통계',
    icon: <BarChart3 className="w-[16px] h-[16px]" />
  },
  {
    id: 'server',
    label: '서버',
    title: '다중 접속 서버 제어 · 접속 주소 · 사용자 계정 권한 관리',
    icon: <Server className="w-[16px] h-[16px]" />
  },
  {
    id: 'settings',
    label: '설정',
    title: '접수구분·구역구분·검토결과 항목 편집 및 시스템 환경설정',
    icon: <Settings className="w-[16px] h-[16px]" />
  },
  {
    id: 'about',
    label: '정보',
    title: '프로그램 기본 정보 · 버전 기록 · 저장소 폴더 관리',
    icon: <Info className="w-[16px] h-[16px]" />
  }
]

export const GlobalNav: React.FC<GlobalNavProps> = ({
  activeTab,
  onSelectTab,
  serverStatus,
  session,
  canControlServer,
  onToggleServer,
  onOpenAccountModal
}) => {
  const isServerOn = serverStatus.running

  return (
    <aside className="w-[64px] h-full bg-[#090d16] text-slate-300 border-r border-[#1e293b] flex flex-col items-center justify-between py-2 shrink-0 select-none">
      <div className="flex flex-col items-center gap-1.5 w-full">
        <button
          type="button"
          onClick={() => onSelectTab('about')}
          title="자치경찰 무인교통단속장비 민원접수대장 정보"
          className="relative w-[50px] h-[36px] rounded-[8px] bg-[#0f172a] hover:bg-[#1e293b] border border-[#f59e0b]/70 flex flex-col items-center justify-center transition-all duration-150 active:scale-95 cursor-pointer"
        >
          <Shield className="w-3.5 h-3.5 text-[#f59e0b] mb-0.5" />
          <span className="text-[9.5px] font-extrabold tracking-tight text-white leading-none">
            자치경찰
          </span>
          <span
            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#090d16] ${
              isServerOn ? 'bg-[#10b981] animate-pulse' : 'bg-[#64748b]'
            }`}
          />
        </button>

        <div className="w-7 h-[1px] bg-[#1e293b]" />

        <nav className="flex flex-col items-center gap-1 w-full px-1.5">
          {TABS.map((t) => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                type="button"
                title={t.title}
                onClick={() => onSelectTab(t.id)}
                className={`w-full py-1.5 rounded-[7px] flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer ${
                  active
                    ? 'bg-[#2563eb] text-white font-semibold'
                    : 'text-slate-400 hover:bg-[#111827] hover:text-slate-100 font-normal'
                }`}
              >
                {t.icon}
                <span className="text-[10.5px] leading-none">{t.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        <div className="w-7 h-[1px] bg-[#1e293b] mb-0.5" />

        <button
          type="button"
          onClick={() => onToggleServer(!isServerOn)}
          title={
            !canControlServer
              ? '다중 접속 서버 제어는 최고관리자 또는 지정된 관리자(1명)만 가능합니다'
              : isServerOn
                ? `다중 접속 서버 가동 중 (포트 ${serverStatus.port}) — 클릭 시 중지`
                : '다중 접속 서버 꺼짐 — 클릭 시 다른 사용자 접속 허용 시작'
          }
          className={`w-full py-1.5 rounded-[7px] flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer border ${
            isServerOn
              ? 'bg-[#064e3b]/60 text-[#34d399] border-[#059669]/60 hover:bg-[#064e3b]/90'
              : 'bg-[#111827] text-slate-400 border-[#1e293b] hover:bg-[#1e293b] hover:text-white'
          } ${!canControlServer ? 'opacity-60' : ''}`}
        >
          <Server className="w-3.5 h-3.5" />
          <span className="text-[10px] font-medium leading-none">
            {isServerOn ? '서버켜짐' : '서버꺼짐'}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenAccountModal}
          title={
            session
              ? `현재 로그인: ${session.user.displayName} (${session.user.jobTitle}) — 계정 전환/로그아웃`
              : '로그인 창 열기'
          }
          className="w-full py-1.5 rounded-[7px] bg-[#111827] hover:bg-[#1e293b] text-slate-300 hover:text-white border border-[#1e293b] flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95 cursor-pointer"
        >
          {session ? (
            <UserCheck className="w-3.5 h-3.5 text-[#38bdf8]" />
          ) : (
            <LogOut className="w-3.5 h-3.5 text-[#f59e0b]" />
          )}
          <span className="text-[10px] leading-none truncate max-w-[46px]">
            {session ? session.user.displayName.slice(0, 3) : '로그인'}
          </span>
        </button>
      </div>
    </aside>
  )
}
