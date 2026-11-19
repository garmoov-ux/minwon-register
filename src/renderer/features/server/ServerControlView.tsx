import React, { useState } from 'react'
import {
  Copy,
  Globe,
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
  isAdmin: boolean
  onToggleServer: (enabled: boolean, port?: number) => Promise<void>
  onUpdateConfig: (next: AppConfig) => Promise<void>
  onRefreshSnapshot: () => Promise<void>
  onShowToast: (msg: string) => void
}

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: '시스템 관리자 (전체 권한)',
  OPERATOR: '민원 담당자 (등록/수정/내보내기)',
  VIEWER: '현황 열람자 (조회/내보내기 전용)'
}

export const ServerControlView: React.FC<ServerControlViewProps> = ({
  config,
  serverStatus,
  users,
  auditLogs,
  isAdmin,
  onToggleServer,
  onUpdateConfig,
  onRefreshSnapshot,
  onShowToast
}) => {
  const [portInput, setPortInput] = useState<number>(config.server.port)
  const [editingUser, setEditingUser] = useState<CreateUserPayload | null>(null)

  const handleCopyUrl = async (url: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url)
      onShowToast(`접속 주소가 복사되었습니다: ${url}`)
    } catch {
      onShowToast(url)
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
      {/* 좌측 6컬럼: 다중 사용자 접속용 내장 REST API & 웹 서버 제어판 */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="다중 사용자 접속 REST API 서버 제어판"
          badge={<Server className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="shrink-0"
        >
          <div className="space-y-3">
            <div
              className={`rounded-[10px] border p-3.5 flex items-center justify-between ${
                serverStatus.running
                  ? 'bg-[#ecfdf5] border-[#34d399]'
                  : 'bg-[#f8fafc] border-[#cbd5e1]'
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      serverStatus.running ? 'bg-[#10b981] animate-pulse' : 'bg-[#64748b]'
                    }`}
                  />
                  <span className="text-[14px] font-extrabold text-[#0f172a]">
                    {serverStatus.running
                      ? `다중 접속 서버 가동 중 (포트 ${serverStatus.port})`
                      : '다중 접속 서버 중지됨 (단독 로컬 모드)'}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#475569]">
                  {serverStatus.running
                    ? '같은 네트워크(사내망/공유기)의 다른 PC에서 아래 주소로 웹 브라우저 또는 클라이언트로 즉시 접속할 수 있습니다.'
                    : '서버 기능을 켜면 다른 PC 사용자들이 REST API 및 웹 브라우저로 동시 접속하여 민원접수대장을 함께 사용할 수 있습니다.'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(Number(e.target.value))}
                  disabled={serverStatus.running}
                  className="w-[74px] h-[32px] px-2 rounded-[6px] border border-[#cbd5e1] bg-white text-center font-bold text-[12.5px] disabled:bg-[#e2e8f0]"
                  title="서버 포트 번호 (기본 8090)"
                />
                {serverStatus.running ? (
                  <PillButton
                    variant="dark-utility"
                    onClick={() => void onToggleServer(false, portInput)}
                  >
                    <Square className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span>서버 기능 끄기</span>
                  </PillButton>
                ) : (
                  <PillButton
                    variant="primary"
                    onClick={() => void onToggleServer(true, portInput)}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>서버 기능 켜기</span>
                  </PillButton>
                )}
              </div>
            </div>

            {/* 접속 주소 목록 */}
            <div className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-bold text-[#0f172a] inline-flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#2563eb]" />
                  다른 사용자 접속 주소 (웹 브라우저 및 REST API 겸용)
                </span>
                <span className="text-[11px] text-[#64748b]">
                  실시간 연결: {serverStatus.activeConnections}명 · 누적 요청:{' '}
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
                        <span>주소 복사</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-[#64748b] py-2">
                  [서버 기능 켜기] 버튼을 누르면 사내망 다른 PC에서 접속할 수 있는 IP 주소가 표시됩니다.
                </div>
              )}

              {/* 서버 옵션 스위치 */}
              <div className="pt-2 border-t border-[#e2e8f0] flex items-center justify-between text-[12px]">
                <span className="font-medium text-[#334155]">
                  원격 접속 사용자의 민원 등록·수정 허용 (끄면 열람 전용)
                </span>
                <div className="inline-flex rounded-[6px] border border-[#cbd5e1] bg-white p-0.5">
                  <button
                    type="button"
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

        {/* 감사 로그 (누가 언제 로그인/민원 등록·수정했는지 추적) */}
        <UtilityCard
          title="다중 사용자 접속 및 작업 이력 (Audit Log)"
          badge={<Shield className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto"
        >
          <table className="w-full border-collapse text-left text-[11.5px]">
            <thead className="sticky top-0 bg-[#f1f5f9] text-[#334155] border-b border-[#cbd5e1] font-bold">
              <tr>
                <th className="py-1.5 px-2 w-[135px]">시각</th>
                <th className="py-1.5 px-2 w-[70px]">계정</th>
                <th className="py-1.5 px-2 w-[95px]">작업</th>
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
                  <td className="py-1.5 px-2 text-[#334155] truncate max-w-[200px]" title={log.detail}>
                    {log.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </UtilityCard>
      </div>

      {/* 우측 6컬럼: 접속 사용자 계정 및 권한(RBAC) 관리 */}
      <div className="col-span-6 min-h-0 flex flex-col">
        <UtilityCard
          title="사용자 계정 및 접속 권한(RBAC) 관리"
          badge={<Users className="w-3.5 h-3.5 text-[#2563eb]" />}
          rightAction={
            isAdmin && (
              <PillButton
                variant="primary"
                size="sm"
                onClick={() =>
                  setEditingUser({
                    username: '',
                    password: '',
                    displayName: '',
                    department: '교통단속장비운영팀',
                    role: 'OPERATOR',
                    active: true
                  })
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>신규 사용자 추가</span>
              </PillButton>
            )
          }
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto space-y-2 pr-1"
        >
          <div className="text-[11.5px] text-[#64748b] mb-1">
            다중 접속 서버를 켰을 때 다른 PC에서 로그인할 수 있는 사용자 계정 목록입니다.
          </div>

          {users.map((u) => (
            <div
              key={u.username}
              className="rounded-[9px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[#0f172a]">
                    {u.displayName}
                  </span>
                  <span className="px-2 py-0.5 rounded-[5px] bg-white border border-[#cbd5e1] text-[11px] font-bold text-[#2563eb]">
                    ID: {u.username}
                  </span>
                  <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#1d4ed8] text-[11px] font-semibold">
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </div>
                <div className="text-[11.5px] text-[#64748b]">
                  소속: {u.department} · 최근 로그인:{' '}
                  {u.lastLoginAt
                    ? new Date(u.lastLoginAt).toLocaleString('ko-KR')
                    : '기록 없음'}
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <PillButton
                    variant="pearl-capsule"
                    size="sm"
                    onClick={() =>
                      setEditingUser({
                        username: u.username,
                        password: '',
                        displayName: u.displayName,
                        department: u.department,
                        role: u.role,
                        active: u.active
                      })
                    }
                  >
                    수정/비번재설정
                  </PillButton>
                  {u.username !== 'admin' && (
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
          ))}
        </UtilityCard>
      </div>

      {/* 사용자 계정 추가/수정 모달 */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-[#090d16]/60 flex items-center justify-center p-4">
          <div className="w-[420px] rounded-[12px] bg-white border border-[#cbd5e1] p-4 space-y-3 apple-product-shadow">
            <h3 className="text-[14px] font-bold text-[#0f172a]">
              사용자 계정 등록 / 권한 설정
            </h3>
            <form onSubmit={(e) => void handleSaveUser(e)} className="space-y-2.5 text-[12px]">
              <div>
                <label className="block font-semibold text-[#475569] mb-1">아이디 (Username)</label>
                <input
                  type="text"
                  value={editingUser.username}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, username: e.target.value })
                  }
                  placeholder="예: hong"
                  required
                  className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">
                  비밀번호 (수정 시 비워두면 기존 비밀번호 유지)
                </label>
                <input
                  type="password"
                  value={editingUser.password || ''}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, password: e.target.value })
                  }
                  placeholder="초기 비밀번호 입력"
                  className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">담당자 이름</label>
                  <input
                    type="text"
                    value={editingUser.displayName}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, displayName: e.target.value })
                    }
                    placeholder="예: 홍길동"
                    required
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#475569] mb-1">소속 부서</label>
                  <input
                    type="text"
                    value={editingUser.department}
                    onChange={(e) =>
                      setEditingUser({ ...editingUser, department: e.target.value })
                    }
                    className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#475569] mb-1">권한 등급</label>
                <select
                  value={editingUser.role}
                  onChange={(e) =>
                    setEditingUser({ ...editingUser, role: e.target.value as UserRole })
                  }
                  className="w-full h-[32px] px-2.5 rounded-[6px] border border-[#cbd5e1]"
                >
                  <option value="ADMIN">시스템 관리자 (전체 관리)</option>
                  <option value="OPERATOR">민원 담당자 (민원/장비 등록·수정·내보내기)</option>
                  <option value="VIEWER">현황 열람자 (조회·내보내기 전용)</option>
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
