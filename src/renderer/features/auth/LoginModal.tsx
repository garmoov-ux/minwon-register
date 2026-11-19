import React, { useEffect, useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Phone,
  Radio,
  Search,
  Server,
  User,
  X
} from 'lucide-react'
import { AuthSession, USER_ROLE_LABELS, UserRole } from '@shared/types/domain'
import {
  getClientConnectionConfig,
  isElectronEnvironment,
  unifiedApiClient
} from '../../services/api-client'
import { PillButton } from '../../components/ui/PillButton'
import logoUrl from '../../assets/logo.svg'
import backgroundUrl from '../../assets/background.jpg'

interface LoginModalProps {
  open: boolean
  session: AuthSession | null
  requireLogin: boolean
  onClose: () => void
  onLoginSuccess: (session: AuthSession, message: string) => void
  onLogout: () => void
  onShowToast: (msg: string) => void
}

const ROLE_BADGES: Record<UserRole, { label: string; cls: string }> = {
  SUPER_ADMIN: {
    label: '최고관리자',
    cls: 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]'
  },
  ADMIN: {
    label: '관리자',
    cls: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]'
  },
  USER: {
    label: '사용자',
    cls: 'bg-[#ecfdf5] text-[#047857] border-[#a7f3d0]'
  }
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
  const savedConn = getClientConnectionConfig()
  const initialAddr =
    savedConn.mode === 'REMOTE'
      ? savedConn.remoteServerUrl.replace(/^https?:\/\//i, '')
      : '127.0.0.1:8090'

  const [serverAddress, setServerAddress] = useState<string>(initialAddr)
  const [discoveredServers, setDiscoveredServers] = useState<
    Array<{ host: string; port: number; url: string; serverName: string }>
  >([])
  const [discovering, setDiscovering] = useState<boolean>(false)

  const [username, setUsername] = useState<string>(session?.user.username || '')
  const [password, setPassword] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [submitting, setSubmitting] = useState<boolean>(false)

  // 비밀번호 변경 모드
  const [changingPw, setChangingPw] = useState<boolean>(false)
  const [oldPw, setOldPw] = useState<string>('')
  const [newPw, setNewPw] = useState<string>('')

  // 미로그인 상태에서 로그인 창이 열릴 때 백그라운드로 사내망 서버를 자동 탐색해 목록으로 제안
  useEffect(() => {
    if (!open || session || !isElectronEnvironment()) return
    let cancelled = false
    void unifiedApiClient.discoverServers().then((list) => {
      if (cancelled) return
      setDiscoveredServers(list)
      if (list.length > 0 && (serverAddress === '127.0.0.1:8090' || !serverAddress.trim())) {
        setServerAddress(`${list[0].host}:${list[0].port}`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, session])

  if (!open) return null

  const canClose = Boolean(session) || !requireLogin
  const isLocalTarget =
    !serverAddress.trim() ||
    serverAddress.includes('127.0.0.1') ||
    serverAddress.includes('localhost') ||
    serverAddress.includes('내 컴퓨터')

  const handleAutoDiscoverClick = async (): Promise<void> => {
    setDiscovering(true)
    setErrorMsg('')
    try {
      const list = await unifiedApiClient.discoverServers()
      setDiscoveredServers(list)
      if (list.length > 0) {
        const picked = `${list[0].host}:${list[0].port}`
        setServerAddress(picked)
        onShowToast(`사내망 서버(${picked})를 찾아 접속 주소에 입력했습니다.`)
      } else {
        onShowToast('사내망에서 켜져 있는 서버를 찾지 못했습니다. 서버 IP를 직접 입력하거나 내 컴퓨터로 접속하세요.')
      }
    } finally {
      setDiscovering(false)
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await unifiedApiClient.login({
        username: username.trim(),
        password: password.trim(),
        serverAddress: serverAddress.trim()
      })

      if (!res.ok || !res.data) {
        setErrorMsg(res.message || '로그인에 실패했습니다.')
        return
      }

      setPassword('')
      onLoginSuccess(res.data, res.message)
    } catch (err) {
      setErrorMsg(`로그인 처리 중 오류가 발생했습니다: ${(err as Error).message}`)
    } finally {
      setSubmitting(false)
    }
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

  // 1. 미로그인(로그인 화면): 제주자치경찰단 청사 풀스크린 배경 + 자치경찰 공식 로그인 카드
  if (!session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 select-none overflow-hidden">
        {/* 제주자치경찰단 청사 배경 이미지 + 그라데이션 오버레이 */}
        <img
          src={backgroundUrl}
          alt="제주자치경찰단 청사 배경"
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#090d16]/75 via-[#090d16]/45 to-[#090d16]/80" />

        {/* 중앙 스플릿 카드 (좌측: 제주자치경찰단 청사 조망 배너 / 우측: 서버 주소 + 로그인 입력 폼) */}
        <div className="relative z-10 w-[860px] max-w-full rounded-[18px] border border-white/25 bg-[#090d16]/45 backdrop-blur-md overflow-hidden grid grid-cols-12 apple-product-shadow">
          {/* 좌측 6컬럼: 제주자치경찰단 비주얼 쇼케이스 */}
          <div className="col-span-6 relative p-7 flex flex-col justify-between text-white overflow-hidden">
            <img
              src={backgroundUrl}
              alt="제주자치경찰단"
              className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/35 to-[#090d16]/65" />

            <div className="relative z-10 flex items-center gap-3">
              <div className="w-11 h-11 rounded-[11px] bg-[#090d16]/85 border border-[#f59e0b] p-1.5 flex items-center justify-center shadow-md">
                <img src={logoUrl} alt="자치경찰 참수리 로고" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-[11px] font-extrabold tracking-wide text-[#fcd34d]">
                  제주특별자치도 · 교통생활안전과
                </div>
                <div className="text-[16px] font-extrabold tracking-tight text-white">
                  제주자치경찰단
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-2.5 pt-24">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f59e0b]/20 border border-[#f59e0b]/60 text-[#fde68a] text-[11px] font-bold">
                <Radio className="w-3.5 h-3.5 text-[#f59e0b]" />
                <span>교통생활안전과 · 무인교통단속장비 통합 관제</span>
              </div>
              <h1 className="text-[22px] font-extrabold leading-snug text-white tracking-tight">
                무인교통단속장비
                <br />
                민원접수대장 관리 시스템
              </h1>
              <p className="text-[12px] text-slate-200/90 leading-relaxed">
                민원접수대장 통합 이력 관리, 단속장비 487대 위치·보호구역 자동 연동 및 다중 사용자 실시간 서버 접속을 지원합니다.
              </p>
            </div>
          </div>

          {/* 우측 6컬럼: 화이트 로그인 & 서버 주소 입력 카드 */}
          <div className="col-span-6 bg-white p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                <div>
                  <h2 className="text-[16px] font-extrabold text-[#0f172a]">
                    시스템 로그인
                  </h2>
                  <p className="text-[11.5px] text-[#64748b] mt-0.5">
                    접속할 서버 주소와 계정 정보를 입력해 주세요.
                  </p>
                </div>
                {canClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 rounded-[6px] bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <form onSubmit={(e) => void handleLoginSubmit(e)} className="space-y-3.5 mt-4">
                {/* 접속 서버 주소 입력란 (내 컴퓨터 로컬 또는 원격 서버 IP:포트 직접 입력) */}
                {isElectronEnvironment() && (
                  <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11.5px] font-extrabold text-[#0f172a] inline-flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-[#2563eb]" />
                        <span>접속 서버 주소 (아이피:포트)</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setServerAddress('127.0.0.1:8090')}
                          className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold border cursor-pointer ${
                            isLocalTarget
                              ? 'bg-[#0f172a] text-white border-[#0f172a]'
                              : 'bg-white text-[#475569] border-[#cbd5e1] hover:bg-[#f1f5f9]'
                          }`}
                        >
                          내 컴퓨터(로컬)
                        </button>
                        <button
                          type="button"
                          disabled={discovering}
                          onClick={() => void handleAutoDiscoverClick()}
                          className="px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] border border-[#bfdbfe] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Search className="w-2.5 h-2.5" />
                          <span>{discovering ? '탐색 중...' : '서버 자동찾기'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-[#2563eb] absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={serverAddress}
                        onChange={(e) => setServerAddress(e.target.value)}
                        placeholder="예: 192.168.0.9:8090 (내 컴퓨터는 127.0.0.1:8090)"
                        className="w-full h-[32px] pl-8 pr-2.5 rounded-[6px] border border-[#cbd5e1] bg-white text-[12.5px] font-bold text-[#1d4ed8] focus:outline-2 focus:outline-[#2563eb]"
                      />
                    </div>

                    {discoveredServers.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        <span className="text-[10.5px] text-[#64748b] font-semibold">발견된 서버:</span>
                        {discoveredServers.map((srv) => {
                          const addr = `${srv.host}:${srv.port}`
                          const active = serverAddress.includes(addr)
                          return (
                            <button
                              key={srv.url}
                              type="button"
                              onClick={() => setServerAddress(addr)}
                              className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-bold border cursor-pointer ${
                                active
                                  ? 'bg-[#2563eb] text-white border-[#2563eb]'
                                  : 'bg-white text-[#2563eb] border-[#93c5fd] hover:bg-[#eff6ff]'
                              }`}
                            >
                              {addr} ({srv.serverName})
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[12px] font-bold text-[#334155] mb-1">
                    아이디
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="아이디 입력"
                      autoFocus
                      className="w-full h-[36px] pl-8.5 pr-3 rounded-[7px] border border-[#cbd5e1] bg-[#f8fafc] focus:bg-white text-[13px] font-semibold text-[#0f172a] focus:outline-2 focus:outline-[#2563eb]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#334155] mb-1">
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

                {errorMsg && (
                  <div className="rounded-[7px] bg-[#fef2f2] border border-[#fecaca] px-3 py-2 text-[11.5px] text-[#dc2626] font-semibold leading-snug">
                    {errorMsg}
                  </div>
                )}

                <div className="pt-1">
                  <PillButton
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={submitting}
                    className="w-full"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>
                      {submitting
                        ? '인증 및 서버 연결 확인 중...'
                        : isLocalTarget
                          ? '내 컴퓨터(로컬 대장) 로그인'
                          : `서버(${serverAddress}) 접속 로그인`}
                    </span>
                  </PillButton>
                </div>
              </form>
            </div>

            <div className="pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] text-[#64748b]">
              <span>제주특별자치도 자치경찰단</span>
              <span>최고관리자 · 관리자 · 사용자 권한 자동 식별</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 2. 로그인된 상태에서 계정/로그아웃 버튼 클릭 시: 제주자치경찰단 청사 배너가 적용된 계정 프로필 & 로그아웃 창
  return (
    <div
      className="fixed inset-0 z-50 bg-[#090d16]/65 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      onClick={() => canClose && onClose()}
    >
      <div
        className="w-[440px] rounded-[15px] bg-[#ffffff] border border-[#cbd5e1] overflow-hidden apple-product-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 제주자치경찰단 청사 이미지 배너 헤더 */}
        <div className="relative h-[132px] bg-[#090d16] text-white p-4 flex flex-col justify-between overflow-hidden border-b border-[#1e293b]">
          <img
            src={backgroundUrl}
            alt="제주자치경찰단 청사"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-75"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090d16]/95 via-[#090d16]/50 to-[#090d16]/65" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[8px] bg-[#090d16]/85 border border-[#f59e0b] p-1 flex items-center justify-center">
                <img src={logoUrl} alt="자치경찰 로고" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="text-[13px] font-extrabold text-white leading-tight">
                  제주특별자치도 자치경찰단
                </div>
                <div className="text-[10.5px] text-[#fcd34d] font-semibold">
                  무인교통단속장비 민원접수대장
                </div>
              </div>
            </div>
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-[6px] bg-[#090d16]/75 hover:bg-[#1e293b] text-slate-200 border border-white/15 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative z-10 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-extrabold text-white">
                  {session.user.displayName}
                </span>
                <span className="text-[12px] text-slate-300 font-medium">
                  ({session.user.username})
                </span>
              </div>
              <div className="text-[11.5px] text-slate-300 mt-0.5">
                {session.user.jobTitle || '자치경찰단 담당자'}
              </div>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-[5px] border text-[11px] font-extrabold ${
                ROLE_BADGES[session.user.role]?.cls || ''
              }`}
            >
              {USER_ROLE_LABELS[session.user.role] || session.user.role}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {!changingPw ? (
            <>
              <div className="rounded-[10px] border border-[#cbd5e1] bg-[#f8fafc] p-3.5 space-y-2.5 text-[12px]">
                <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                  <span className="text-[#64748b] font-semibold inline-flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#2563eb]" />
                    현재 접속 위치
                  </span>
                  <span className="font-extrabold text-[#1d4ed8] inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />
                    {savedConn.mode === 'REMOTE'
                      ? `다중 접속 서버 (${savedConn.remoteServerUrl})`
                      : '내 컴퓨터 (로컬 대장)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[#334155]">
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>직책: <strong>{session.user.jobTitle || '-'}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>연락처: <strong>{session.user.contact || '-'}</strong></span>
                  </div>
                  <div className="col-span-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#64748b]" />
                    <span>이메일: <strong>{session.user.email || '-'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PillButton
                  variant="pearl-capsule"
                  size="md"
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
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    setUsername('')
                    setPassword('')
                    setErrorMsg('')
                    onLogout()
                  }}
                >
                  <LogOut className="w-3.5 h-3.5 text-[#f59e0b]" />
                  <span>로그아웃 / 서버 전환</span>
                </PillButton>
              </div>
            </>
          ) : (
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
        </div>
      </div>
    </div>
  )
}
