import React, { useEffect, useState } from 'react'
import { Clock, FolderOpen, Globe, ShieldCheck, User } from 'lucide-react'
import { AppSnapshot, AuthSession, USER_ROLE_LABELS } from '@shared/types/domain'
import { getClientConnectionConfig } from '../../services/api-client'

interface StatusFooterProps {
  snapshot: AppSnapshot
  session: AuthSession | null
  onOpenFolder: (kind: 'DATA' | 'EXPORT' | 'LOGS' | 'CONFIG') => void
  onOpenServerTab: () => void
  onOpenLoginModal: () => void
}

export const StatusFooter: React.FC<StatusFooterProps> = ({
  snapshot,
  session,
  onOpenFolder,
  onOpenServerTab,
  onOpenLoginModal
}) => {
  const [clockText, setClockText] = useState<string>(() => new Date().toLocaleTimeString('ko-KR'))

  useEffect(() => {
    const timer = setInterval(() => {
      setClockText(new Date().toLocaleTimeString('ko-KR'))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const { serverStatus, minwonSummary, totalDeviceCount } = snapshot
  const connCfg = getClientConnectionConfig()

  const serverText =
    connCfg.mode === 'REMOTE'
      ? `원격 접속 중 (${connCfg.remoteServerUrl})`
      : serverStatus.running
        ? `가동 중 (${serverStatus.urls[0] || `포트 ${serverStatus.port}`})`
        : '꺼짐 (단독 로컬 모드)'

  return (
    <footer className="h-[28px] shrink-0 bg-[#ffffff] border-t border-[#cbd5e1] px-3.5 flex items-center justify-between text-[11.5px] text-[#64748b]">
      <div className="flex items-center gap-3 min-w-0 overflow-hidden">
        <button
          type="button"
          onClick={onOpenLoginModal}
          className="inline-flex items-center gap-1 whitespace-nowrap hover:text-[#2563eb] cursor-pointer"
        >
          <User className="w-3.5 h-3.5 text-[#2563eb]" />
          <strong className="text-[#0f172a] font-semibold">접속 계정:</strong>
          {session ? (
            <span className="text-[#0f172a] font-medium">
              {session.user.displayName} (
              {session.user.jobTitle === USER_ROLE_LABELS[session.user.role]
                ? session.user.jobTitle
                : `${session.user.jobTitle} · ${USER_ROLE_LABELS[session.user.role]}`}
              )
            </span>
          ) : (
            <span className="text-[#dc2626] font-semibold">미로그인</span>
          )}
        </button>

        <span className="text-[#cbd5e1]">|</span>

        <button
          type="button"
          onClick={onOpenServerTab}
          className="inline-flex items-center gap-1 whitespace-nowrap truncate hover:text-[#2563eb] cursor-pointer"
        >
          <Globe
            className={`w-3.5 h-3.5 ${
              serverStatus.running || connCfg.mode === 'REMOTE'
                ? 'text-[#10b981]'
                : 'text-[#64748b]'
            }`}
          />
          <strong className="text-[#0f172a] font-semibold">다중 접속 서버:</strong>
          <span
            className={
              serverStatus.running || connCfg.mode === 'REMOTE'
                ? 'text-[#059669] font-semibold'
                : 'text-[#64748b]'
            }
          >
            {serverText}
          </span>
        </button>

        <span className="text-[#cbd5e1]">|</span>

        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5 text-[#2563eb]" />
          <strong className="text-[#0f172a] font-semibold">누적 민원:</strong>
          {minwonSummary.totalMinwonCount.toLocaleString()}건 (단속장비{' '}
          {totalDeviceCount.toLocaleString()}대)
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 text-[#0f172a] font-semibold text-[11.5px] mr-1">
          <Clock className="w-3 h-3 text-[#2563eb]" />
          {clockText}
        </span>
        <button
          type="button"
          onClick={() => onOpenFolder('EXPORT')}
          className="h-[21px] px-2 rounded-[5px] bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#cbd5e1] text-[#334155] inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap cursor-pointer"
        >
          <FolderOpen className="w-3 h-3 text-[#2563eb]" />
          <span>엑셀 폴더</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenFolder('DATA')}
          className="h-[21px] px-2 rounded-[5px] bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#cbd5e1] text-[#334155] inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap cursor-pointer"
        >
          <FolderOpen className="w-3 h-3 text-[#2563eb]" />
          <span>데이터 폴더</span>
        </button>
      </div>
    </footer>
  )
}
