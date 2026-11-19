import React, { useState } from 'react'
import {
  Briefcase,
  CheckCircle2,
  Copy,
  Globe,
  Mail,
  Phone,
  Play,
  Plus,
  Server,
  Shield,
  Square,
  Trash2,
  Users
} from 'lucide-react'
import {
  AppConfig,
  AuditLogEntry,
  CreateUserPayload,
  RestServerStatus,
  USER_ROLE_LABELS,
  UserAccount,
  UserRole
} from '@shared/types/domain'
import { unifiedApiClient } from '../../services/api-client'
import { UtilityCard } from '../../components/ui/UtilityCard'
import { PillButton } from '../../components/ui/PillButton'

interface ServerControlViewProps {
  config: AppConfig
  serverStatus: RestServerStatus
  users: UserAccount[]
  auditLogs: AuditLogEntry[]
  isSuperAdmin: boolean
  canManageUsers: boolean
  canControlServer: boolean
  onToggleServer: (enabled: boolean, port?: number) => Promise<void>
  onUpdateConfig: (next: AppConfig) => Promise<void>
  onRefreshSnapshot: () => Promise<void>
  onShowToast: (msg: string) => void
}

const ROLE_DESCRIPTION: Record<UserRole, string> = {
  SUPER_ADMIN: '최고관리자 (서버 제어 · 관리자 지정 · 전체 관리)',
  ADMIN: '관리자 (지정된 1명 서버 켜기/끄기 가능)',
  USER: '사용자 (민원접수대장 등록/수정/조회)'
}

export const ServerControlView: React.FC<ServerControlViewProps> = ({
  config,
  serverStatus,
  users,
  auditLogs,
  isSuperAdmin,
  canManageUsers,
  canControlServer,
  onToggleServer,
  onUpdateConfig,
  onRefreshSnapshot,
  onShowToast
}) => {
  const [portInput, setPortInput] = useState<number>(config.server.port)
  const [editingUser, setEditingUser] = useState<CreateUserPayload | null>(null)

  const designatedAdminUser = users.find(
    (u) =>
      u.role === 'ADMIN' &&
      (u.canToggleServer || u.username === config.server.designatedAdminUsername)
  )

  const handleCopyUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      onShowToast(`접속 주소가 복사되었습니다: ${url}`)
    } catch {
      onShowToast(url)
    }
  }

  const handleDesignateServerAdmin = async (username: string): Promise<void> => {
    const res = await unifiedApiClient.designateServerAdmin(username)
    onShowToast(res.message)
    if (res.ok) {
      await onRefreshSnapshot()
    }
  }

  const handleSaveUser = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!editingUser) return
    const res = await unifiedApiClient.upsertUser(editingUser)
    onShowToast(res.message)
    if (res.ok) {
      setEditingUser(null)
      await onRefreshSnapshot()
    }
  }

  const handleDeleteUser = async (username: string): Promise<void> => {
    const res = await unifiedApiClient.deleteUser(username)
    onShowToast(res.message)
    if (res.ok) {
      await onRefreshSnapshot()
    }
  }

  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측 6컬럼: 다중 사용자 접속 서버 제어판 */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="다중 접속 서버 제어"
          badge={<Server className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            <span
              className={`px-2 py-0.5 rounded-[5px] text-[10.5px] font-bold ${
                canControlServer
                  ? 'bg-[#ecfdf5] text-[#047857] border border-[#a7f3d0]'
                  : 'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]'
              }`}
            >
              {canControlServer ? '서버 제어 가능' : '서버 제어 권한 없음'}
            </span>
          }
          className="shrink-0"
        >
          <div className="space-y-2.5">
            <div
              className={`rounded-[10px] border p-3 flex items-center justify-between gap-3 ${
                serverStatus.running
                  ? 'bg-[#ecfdf5] border-[#34d399]'
                  : 'bg-[#f8fafc] border-[#cbd5e1]'
              }`}
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      serverStatus.running ? 'bg-[#10b981] animate-pulse' : 'bg-[#64748b]'
                    }`}
                  />
                  <span className="text-[13.5px] font-extrabold text-[#0f172a] whitespace-nowrap">
                    {serverStatus.running
                      ? `서버 가동 중 (포트 ${serverStatus.port})`
                      : '서버 중지됨 (로컬 모드)'}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#475569] truncate">
                  서버 허용: 최고관리자(admin) · 지정 관리자(
                  {designatedAdminUser ? designatedAdminUser.displayName : config.server.designatedAdminUsername}
                  )
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(Number(e.target.value))}
                  disabled={serverStatus.running || !canControlServer}
                  className="w-[72px] h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-center font-bold text-[12.5px] disabled:bg-[#e2e8f0]"
                  title="서버 포트 번호"
                />
                {serverStatus.running ? (
                  <PillButton
                    variant="dark-utility"
                    disabled={!canControlServer}
                    onClick={() => void onToggleServer(false, portInput)}
                  >
                    <Square className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span>서버 끄기</span>
                  </PillButton>
                ) : (
                  <PillButton
                    variant="primary"
                    disabled={!canControlServer}
                    onClick={() => void onToggleServer(true, portInput)}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>서버 켜기</span>
                  </PillButton>
                )}
              </div>
            </div>

            {/* 접속 주소 및 원격 권한 */}
            <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-[#0f172a] inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#2563eb]" />
                  접속 주소
                </span>
                <span className="text-[11px] text-[#64748b]">
                  연결 {serverStatus.activeConnections}명 · 요청{' '}
                  {serverStatus.totalRequests.toLocaleString()}회
                </span>
              </div>

              {serverStatus.running && serverStatus.urls.length > 0 ? (
                <div className="space-y-1.5">
                  {serverStatus.urls.map((url) => (
                    <div
                      key={url}
                      className="rounded-[7px] bg-white border border-[#cbd5e1] px-3 py-1.5 flex items-center justify-between text-[12.5px]"
                    >
                      <span className="font-bold text-[#2563eb] select-all">{url}</span>
                      <button
                        type="button"
                        onClick={() => void handleCopyUrl(url)}
                        className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] hover:bg-[#dbeafe] text-[#1d4ed8] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>복사</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11.5px] text-[#64748b] py-1">
                  서버를 켜면 다른 컴퓨터 접속 주소가 표시됩니다.
                </div>
              )}

              {/* 서버 옵션 스위치 */}
              <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#334155]">원격 접속 권한</span>
                <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
                  <button
                    type="button"
                    disabled={!canControlServer}
                    onClick={() =>
                      void onUpdateConfig({
                        ...config,
                        server: { ...config.server, allowRemoteWrite: true }
                      })
                    }
                    className={`px-2.5 py-0.5 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                      config.server.allowRemoteWrite
                        ? 'bg-[#2563eb] text-white'
                        : 'text-[#64748b]'
                    }`}
                  >
                    등록·수정 허용
                  </button>
                  <button
                    type="button"
                    disabled={!canControlServer}
                    onClick={() =>
                      void onUpdateConfig({
                        ...config,
                        server: { ...config.server, allowRemoteWrite: false }
                      })
                    }
                    className={`px-2.5 py-0.5 rounded-[5px] text-[11px] font-semibold cursor-pointer ${
                      !config.server.allowRemoteWrite
                        ? 'bg-[#0f172a] text-white'
                        : 'text-[#64748b]'
                    }`}
                  >
                    열람 전용
                  </button>
                </div>
              </div>
            </div>
          </div>
        </UtilityCard>

        {/* 감사 기록 */}
        <UtilityCard
          title="사용자 접속 및 작업 기록"
          badge={<Shield className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto"
        >
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead className="sticky top-0 bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1] font-bold">
              <tr>
                <th className="py-1.5 px-2 w-[140px]">시각</th>
                <th className="py-1.5 px-2 w-[72px]">아이디</th>
                <th className="py-1.5 px-2 w-[100px]">작업 구분</th>
                <th className="py-1.5 px-2">상세 내역</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#f8fafc]">
                  <td className="py-1.5 px-2 text-[#64748b] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('ko-KR')}
                  </td>
                  <td className="py-1.5 px-2 font-bold text-[#0f172a]">{log.username}</td>
                  <td className="py-1.5 px-2 font-semibold text-[#2563eb]">{log.action}</td>
                  <td className="py-1.5 px-2 text-[#334155] truncate max-w-[240px]" title={log.detail}>
                    {log.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </UtilityCard>
      </div>

      {/* 우측 6컬럼: 사용자 계정 관리 */}
      <div className="col-span-6 min-h-0 flex flex-col">
        <UtilityCard
          title="사용자 계정 관리 (최고관리자 · 관리자 · 사용자)"
          badge={<Users className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            canManageUsers && (
              <PillButton
                variant="primary"
                size="sm"
                onClick={() =>
                  setEditingUser({
                    username: '',
                    password: '',
                    displayName: '',
                    jobTitle: '주무관',
                    email: '',
                    contact: '',
                    role: 'USER',
                    canToggleServer: false,
                    active: true
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>신규 사용자 등록</span>
              </PillButton>
            )
          }
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto space-y-2 pr-1"
        >
          {users.map((u) => {
            const isDesignatedServerAdmin =
              u.role === 'ADMIN' &&
              (u.canToggleServer || u.username === config.server.designatedAdminUsername)

            return (
              <div
                key={u.username}
                className={`rounded-[9px] border p-3 flex items-center justify-between gap-3 ${
                  u.role === 'SUPER_ADMIN'
                    ? 'bg-[#fffbeb] border-[#fde68a]'
                    : isDesignatedServerAdmin
                      ? 'bg-[#eff6ff] border-[#93c5fd]'
                      : 'bg-[#f8fafc] border-[#cbd5e1]'
                }`}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13.5px] font-extrabold text-[#0f172a]">
                      {u.displayName}
                    </span>
                    <span className="px-2 py-0.5 rounded-[5px] bg-white border border-[#cbd5e1] text-[11px] font-bold text-[#334155]">
                      {u.username}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-[5px] text-[11px] font-bold ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-[#fef3c7] text-[#b45309] border border-[#fde68a]'
                          : u.role === 'ADMIN'
                            ? 'bg-[#dbeafe] text-[#1d4ed8]'
                            : 'bg-[#e2e8f0] text-[#334155]'
                      }`}
                    >
                      {USER_ROLE_LABELS[u.role]}
                    </span>
                    {(u.role === 'SUPER_ADMIN' || isDesignatedServerAdmin) && (
                      <span className="px-2 py-0.5 rounded-[5px] bg-[#064e3b] text-[#34d399] text-[10.5px] font-bold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        서버 허용
                      </span>
                    )}
                  </div>

                  {/* 직책, 연락처, 이메일이 잘리지 않도록 여유 있게 배치 */}
                  <div className="flex items-center gap-3 flex-wrap text-[11.5px] text-[#475569]">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Briefcase className="w-3 h-3 text-[#64748b]" />
                      <strong className="text-[#0f172a]">{u.jobTitle || '-'}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <Phone className="w-3 h-3 text-[#64748b]" />
                      {u.contact || '-'}
                    </span>
                    <span className="inline-flex items-center gap-1 truncate" title={u.email}>
                      <Mail className="w-3 h-3 text-[#64748b]" />
                      {u.email || '-'}
                    </span>
                  </div>
                </div>

                {canManageUsers && (
                  <div className="flex items-center gap-1 shrink-0">
                    {isSuperAdmin && u.username !== 'admin' && !isDesignatedServerAdmin && (
                      <PillButton
                        variant="secondary-pill"
                        size="sm"
                        onClick={() => void handleDesignateServerAdmin(u.username)}
                      >
                        서버 관리자 지정
                      </PillButton>
                    )}
                    <PillButton
                      variant="pearl-capsule"
                      size="sm"
                      onClick={() =>
                        setEditingUser({
                          username: u.username,
                          password: '',
                          displayName: u.displayName,
                          jobTitle: u.jobTitle,
                          email: u.email,
                          contact: u.contact,
                          role: u.role,
                          canToggleServer: u.canToggleServer,
                          active: u.active
                        })
                      }
                    >
                      수정
                    </PillButton>
                    {isSuperAdmin && u.username !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteUser(u.username)}
                        className="p-1.5 rounded-[6px] bg-[#fef2f2] hover:bg-[#fee2e2] text-[#dc2626] cursor-pointer"
                        title="계정 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </UtilityCard>
      </div>

      {/* 사용자 계정 등록/수정 모달 */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/60 flex items-center justify-center p-4">
          <div className="w-[460px] rounded-[12px] bg-white border border-[#cbd5e1] p-4 space-y-3 apple-product-shadow">
            <h3 className="text-[14px] font-bold text-[#0f172a]">
              사용자 계정 정보 등록 및 수정
            </h3>
            <form onSubmit={(e) => void handleSaveUser(e)} className="space-y-2.5 text-[12px]">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">아이디</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, username: e.target.value })
                    }
                    placeholder="예: manager"
                    required
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">
                    비밀번호 (수정 시 공란 유지 가능)
                  </label>
                  <input
                    type="password"
                    value={editingUser.password || ''}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, password: e.target.value })
                    }
                    placeholder="비밀번호 입력"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">이름</label>
                  <input
                    type="text"
                    value={editingUser.displayName}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, displayName: e.target.value })
                    }
                    placeholder="예: 김자치"
                    required
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">직책</label>
                  <input
                    type="text"
                    value={editingUser.jobTitle}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, jobTitle: e.target.value })
                    }
                    placeholder="예: 교통시설관리 팀장 / 주무관"
                    required
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">이메일</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, email: e.target.value })
                    }
                    placeholder="예: user@jeju.go.kr"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">연락처</label>
                  <input
                    type="text"
                    value={editingUser.contact}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, contact: e.target.value })
                    }
                    placeholder="예: 010-1234-5678 / 064-710-0000"
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">사용자 권한 등급</label>
                <select
                  value={editingUser.role}
                  disabled={editingUser.username === 'admin'}
                  onChange={(e) => {
                    const nextRole = e.target.value as UserRole
                    setEditingUser({
                      ...editingUser,
                      role: nextRole,
                      canToggleServer: nextRole !== 'USER'
                    })
                  }}
                  className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1] disabled:bg-[#e2e8f0]"
                >
                  <option value="SUPER_ADMIN">{ROLE_DESCRIPTION.SUPER_ADMIN}</option>
                  <option value="ADMIN">{ROLE_DESCRIPTION.ADMIN}</option>
                  <option value="USER">{ROLE_DESCRIPTION.USER}</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <PillButton
                  type="button"
                  variant="pearl-capsule"
                  size="sm"
                  onClick={() => setEditingUser(null)}
                >
                  취소
                </PillButton>
                <PillButton type="submit" variant="primary" size="sm">
                  계정 저장
                </PillButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
