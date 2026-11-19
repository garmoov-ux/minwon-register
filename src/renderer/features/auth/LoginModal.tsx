import React, { useState } from 'react'
import { Globe, KeyRound, Lock, LogIn, LogOut, Shield, User, X } from 'lucide-react'
import { AuthSession } from '@shared/types/domain'
import {
  getClientConnectionConfig,
  isElectronEnvironment,
  setClientConnectionConfig,
  unifiedApiClient
} from '../../services/api-client'
import { PillButton } from '../../components/ui/PillButton'

interface LoginModalProps {
  open: boolean
  session: AuthSession | null
  requireLogin: boolean
  onClose: () => void
  onLoginSuccess: (session: AuthSession, message: string) => void
  onLogout: () => void
  onShowToast: (msg: string) => void
}

const ROLE_BADGES: Record<string, { label: string; cls: string }> = {
  ADMIN: { label: '시스템 관리자', cls: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]' },
  OPERATOR: { label: '민원접수 담당자', cls: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]' },
  VIEWER: { label: '현황 열람자', cls: 'bg-[#f8fafc] text-[#475569] border-[#cbd5e1]' }
}

export const LoginModal: React.FC<LoginModalProps> = ({
  open,
  session,
  requireLogin,
  onClose,
  onLoginSuccess,
  onLogout,
  onShowToast
}) => {
  const initialConn = getClientConnectionConfig()
  const [connMode, setConnMode] = useState<'LOCAL' | 'REMOTE'>(initialConn.mode)
  const [remoteUrl, setRemoteUrl] = useState<string>(initialConn.remoteServerUrl)

  const [username, setUsername] = useState<string>(session?.user.username || 'admin')
  const [password, setPassword] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  // 비밀번호 변경 모드
  const [changingPw, setChangingPw] = useState<boolean>(false)
  const [oldPw, setOldPw] = useState<string>('')
  const [newPw, setNewPw] = useState<string>('')

  if (!open) return null

  const canClose = Boolean(session) || !requireLogin

  const handleQuickFill = (u: string, p: string): void => {
    setUsername(u)
    setPassword(p)
    setErrorMsg('')
  }

  const handleLoginSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    if (isElectronEnvironment()) {
      setClientConnectionConfig(connMode, remoteUrl)
    }

    const res = await unifiedApiClient.login({
      username: username.trim(),
      password: password.trim()
    })

    setSubmitting(false)

    if (!res.ok || !res.data) {
      setErrorMsg(res.message || '로그인에 실패했습니다.')
      return
    }

    setPassword('')
    onLoginSuccess(res.data, res.message)
  }

  const handleChangePassword = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!session) return
    if (!oldPw.trim() || !newPw.trim()) {
      setErrorMsg('현재 비밀번호와 새 비밀번호를 입력해 주세요.')
      return
    }
    const res = await unifiedApiClient.changePassword({
      username: session.user.username,
      oldPassword: oldPw.trim(),
      newPassword: newPw.trim()
    })
    if (!res.ok) {
      setErrorMsg(res.message)
      return
    }
    setOldPw('')
    setNewPw('')
    setChangingPw(false)
    setErrorMsg('')
    onShowToast(res.message)
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#090d16]/65 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="w-[430px] rounded-[14px] bg-[#ffffff] border border-[#cbd5e1] overflow-hidden apple-product-shadow">
        {/* 상단 다크 헤더 */}
        <div className="bg-[#090d16] text-white px-5 py-4 flex items-center justify-between border-b border-[#1e293b]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#2563eb] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[14.5px] font-bold leading-tight">
                무인교통단속장비 민원접수대장 인증
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                담당자 계정 로그인 및 다중 접속 REST API 서버 연동
              </p>
            </div>
          </div>
          {canClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-[6px] bg-[#1e293b] hover:bg-[#334155] text-slate-300 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* 이미 로그인된 상태일 때 현재 세션 정보 카드 */}
          {session && !changingPw && (
            <div className="rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#2563eb]" />
                  <span className="text-[13.5px] font-bold text-[#0f172a]">
                    {session.user.displayName} ({session.user.username})
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-[5px] border text-[11px] font-semibold ${
                    ROLE_BADGES[session.user.role]?.cls || ''
                  }`}
                >
                  {ROLE_BADGES[session.user.role]?.label || session.user.role}
                </span>
              </div>
              <div className="text-[12px] text-[#64748b] flex items-center justify-between">
                <span>소속: {session.user.department}</span>
                <span>연결 모드: {connMode === 'REMOTE' ? '원격 REST 서버' : '로컬 DB'}</span>
              </div>
              <div className="pt-1 flex items-center gap-2">
                <PillButton
                  variant="pearl-capsule"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setChangingPw(true)
                    setErrorMsg('')
                  }}
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#2563eb]" />
                  <span>비밀번호 변경</span>
                </PillButton>
                <PillButton
                  variant="dark-utility"
                  size="sm"
                  className="flex-1"
                  onClick={onLogout}
                >
                  <LogOut className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span>로그아웃 / 계정 전환</span>
                </PillButton>
              </div>
            </div>
          )}

          {/* 비밀번호 변경 폼 */}
          {session && changingPw && (
            <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3">
              <div className="text-[13px] font-bold text-[#0f172a]">
                {session.user.displayName} 계정 비밀번호 변경
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  placeholder="현재 비밀번호 입력"
                  className="w-full h-[34px] px-3 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12.5px] focus:outline-2 focus:outline-[#2563eb]"
                />
              </div>
              <div>
                <label className="block text-[11.5px] font-semibold text-[#475569] mb-1">
                  새 비밀번호
                </label>
                <input
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="변경할 새 비밀번호 입력"
                  className="w-full h-[34px] px-3 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[12.5px] focus:outline-2 focus:outline-[#2563eb]"
                />
              </div>
              {errorMsg && (
                <div className="rounded-[7px] bg-[#fef2f2] border border-[#fecaca] px-3 py-2 text-[12px] text-[#dc2626] font-medium">
                  {errorMsg}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <PillButton
                  type="button"
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => {
                    setChangingPw(false)
                    setErrorMsg('')
                  }}
                >
                  취소
                </PillButton>
                <PillButton type="submit" variant="primary" size="sm">
                  비밀번호 저장
                </PillButton>
              </div>
            </form>
          )}

          {/* 로그인 입력 폼 */}
          {!changingPw && (
            <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-3.5">
              {isElectronEnvironment() && (
                <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px] font-bold text-[#334155] inline-flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-[#2563eb]" />
                      데이터베이스 연결 방식
                    </span>
                    <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setConnMode('LOCAL')}
                        className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                          connMode === 'LOCAL'
                            ? 'bg-[#2563eb] text-white'
                            : 'text-[#64748b] hover:text-[#0f172a]'
                        }`}
                      >
                        내 PC 로컬 대장
                      </button>
                      <button
                        type="button"
                        onClick={() => setConnMode('REMOTE')}
                        className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                          connMode === 'REMOTE'
                            ? 'bg-[#2563eb] text-white'
                            : 'text-[#64748b] hover:text-[#0f172a]'
                        }`}
                      >
                        다른 PC 서버 접속
                      </button>
                    </div>
                  </div>

                  {connMode === 'REMOTE' && (
                    <div>
                      <label className="block text-[11px] text-[#64748b] mb-1">
                        접속할 민원접수대장 REST API 서버 주소 (예: http://192.168.0.10:8090)
                      </label>
                      <input
                        type="text"
                        value={remoteUrl}
                        onChange={(e) => setRemoteUrl(e.target.value)}
                        placeholder="http://192.168.0.10:8090"
                        className="w-full h-[30px] px-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12px] text-[#0f172a] focus:outline-2 focus:outline-[#2563eb]"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">
                  사용자 아이디
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="아이디 입력 (예: admin)"
                    autoFocus
                    className="w-full h-[36px] pl-8.5 pr-3 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[13px] text-[#0f172a] focus:outline-2 focus:outline-[#2563eb]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#334155] mb-1">
                  비밀번호
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full h-[36px] pl-8.5 pr-3 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[13px] text-[#0f172a] focus:outline-2 focus:outline-[#2563eb]"
                  />
                </div>
              </div>

              {/* 빠른 기본 계정 자동입력 도우미 */}
              <div className="rounded-[8px] bg-[#f1f5f9] border border-[#e2e8f0] p-2.5 flex items-center justify-between text-[11px] text-[#475569]">
                <span className="font-semibold">빠른 계정 선택:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickFill('admin', 'admin1234')}
                    className="px-2 py-0.5 rounded-[5px] bg-white hover:bg-[#eff6ff] border border-[#cbd5e1] text-[#1d4ed8] font-semibold cursor-pointer"
                  >
                    관리자(admin)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('operator', 'oper1234')}
                    className="px-2 py-0.5 rounded-[5px] bg-white hover:bg-[#ecfdf5] border border-[#cbd5e1] text-[#047857] font-semibold cursor-pointer"
                  >
                    담당자(operator)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickFill('viewer', 'view1234')}
                    className="px-2 py-0.5 rounded-[5px] bg-white hover:bg-[#f8fafc] border border-[#cbd5e1] text-[#334155] font-semibold cursor-pointer"
                  >
                    열람자(viewer)
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-[7px] bg-[#fef2f2] border border-[#fecaca] px-3 py-2 text-[12px] text-[#dc2626] font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="pt-1 flex items-center justify-end gap-2">
                {canClose && (
                  <PillButton
                    type="button"
                    variant="pearl-capsule"
                    onClick={onClose}
                  >
                    닫기
                  </PillButton>
                )}
                <PillButton
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                  className="w-full"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{submitting ? '인증 확인 중...' : '민원접수대장 로그인'}</span>
                </PillButton>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
