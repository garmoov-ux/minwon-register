import React, { useState } from 'react'
import { MinwonRecord } from '@shared/types/domain'
import { useMinwonState } from './hooks/useMinwonState'
import { unifiedApiClient } from './services/api-client'
import { GlobalNav, NavTabId } from './components/layout/GlobalNav'
import { StatusFooter } from './components/layout/StatusFooter'
import { LoginModal } from './features/auth/LoginModal'
import { MinwonLedgerView } from './features/minwon/MinwonLedgerView'
import { MinwonFormView } from './features/minwon/MinwonFormView'
import { DeviceManagementView } from './features/devices/DeviceManagementView'
import { StatsDashboardView } from './features/stats/StatsDashboardView'
import { ServerControlView } from './features/server/ServerControlView'
import { SettingsView } from './features/settings/SettingsView'
import { ProgramInfoView } from './features/about/ProgramInfoView'

export const App: React.FC = () => {
  const {
    snapshot,
    loading,
    session,
    loginModalOpen,
    setLoginModalOpen,
    toastMessage,
    showToast,
    refreshTick,
    refreshSnapshot,
    handleLoginSuccess,
    handleLogout,
    upsertMinwon,
    deleteMinwon,
    toggleServer,
    updateConfig
  } = useMinwonState()

  const [activeTab, setActiveTab] = useState<NavTabId>('ledger')
  const [editingRecord, setEditingRecord] = useState<MinwonRecord | null>(null)

  if (loading && !snapshot) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#f1f5f9] flex items-center justify-center text-[#0f172a] select-none">
        <p className="text-[13.5px] font-semibold">
          자치경찰 무인교통단속장비 민원접수대장 시스템을 불러오는 중입니다...
        </p>
      </div>
    )
  }

  const safeSnapshot = snapshot || {
    config: {
      server: {
        enabled: false,
        port: 8090,
        host: '0.0.0.0',
        autoStartOnBoot: false,
        allowRemoteWrite: true,
        designatedAdminUsername: 'manager'
      },
      system: {
        minimizeToTray: true,
        startMinimized: false,
        requireLoginOnStart: true,
        autoBackupDaily: true,
        retentionDays: 365
      },
      remoteClient: { mode: 'LOCAL' as const, remoteServerUrl: 'http://127.0.0.1:8090' }
    },
    serverStatus: {
      running: false,
      port: 8090,
      host: '0.0.0.0',
      urls: [],
      adapters: [],
      activeConnections: 0,
      startedAt: null,
      totalRequests: 0,
      lastError: null
    },
    codes: {
      접수구분: ['국민신문고', '전화민원', '공문', '방문민원', '도지사에바란다', '자치도에 바란다'],
      구역구분: ['일반구역', '어린이보호구역', '노인보호구역', '장애인보호구역'],
      검토결과: ['대기중', '적합', '조건부 적합', '부적합', '불합리', '검토완료', '검토불필요', '설치불가']
    },
    minwonSummary: {
      totalMinwonCount: 0,
      thisMonthCount: 0,
      pendingReviewCount: 0,
      completedReviewCount: 0,
      byReceptionType: [],
      byReviewResult: [],
      byZoneType: [],
      monthlyTrend: []
    },
    deviceStats: {
      rows: [],
      totals: {
        zoneGeneral: 0,
        zoneChild: 0,
        zoneElder: 0,
        zoneDisabled: 0,
        fixedSignalSpeed: 0,
        fixedSpeed: 0,
        fixedSection: 0,
        fixedRestriction: 0,
        fixedNoEntry: 0,
        mobileSpeed: 0,
        totalCount: 0
      }
    },
    totalDeviceCount: 0,
    users: [],
    recentAuditLogs: [],
    storageInfo: []
  }

  const currentUser = session?.user || null
  const isSuperAdmin = Boolean(currentUser && currentUser.role === 'SUPER_ADMIN')
  const canManageUsers = Boolean(
    currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN')
  )
  const canControlServer = Boolean(
    currentUser &&
      (currentUser.role === 'SUPER_ADMIN' ||
        (currentUser.role === 'ADMIN' &&
          (currentUser.canToggleServer ||
            currentUser.username === safeSnapshot.config.server.designatedAdminUsername)))
  )
  const canWrite = Boolean(currentUser)

  const handleGoNewRegister = (): void => {
    setEditingRecord(null)
    setActiveTab('register')
  }

  const handleSelectEdit = (record: MinwonRecord): void => {
    setEditingRecord(record)
    setActiveTab('register')
  }

  const handleOpenFolder = (kind: 'DATA' | 'EXPORT' | 'LOGS' | 'CONFIG'): void => {
    unifiedApiClient.openFolder(kind)
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#f1f5f9] text-[#0f172a] select-none">
      {/* 로그인 모달 폼 */}
      <LoginModal
        open={loginModalOpen || (safeSnapshot.config.system.requireLoginOnStart && !session)}
        session={session}
        requireLogin={safeSnapshot.config.system.requireLoginOnStart}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onLogout={() => void handleLogout()}
        onShowToast={showToast}
      />

      {/* 좌측 다크 아이콘 사이드바 (#090d16) */}
      <GlobalNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        serverStatus={safeSnapshot.serverStatus}
        session={session}
        canControlServer={canControlServer}
        onToggleServer={(next) => void toggleServer(next)}
        onOpenAccountModal={() => setLoginModalOpen(true)}
      />

      {/* 우측 화이트/슬레이트 콘텐츠 영역 */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
        {toastMessage && (
          <div className="fixed bottom-10 right-6 z-50 bg-[#0f172a] text-white px-4 py-2 rounded-[8px] text-[12px] font-medium border border-[#334155] apple-product-shadow">
            {toastMessage}
          </div>
        )}

        <main className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'ledger' && (
            <MinwonLedgerView
              codes={safeSnapshot.codes}
              summary={safeSnapshot.minwonSummary}
              canWrite={canWrite}
              refreshTick={refreshTick}
              onSelectEdit={handleSelectEdit}
              onGoNewRegister={handleGoNewRegister}
              onDeleteRecord={deleteMinwon}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'register' && (
            <MinwonFormView
              codes={safeSnapshot.codes}
              initialRecord={editingRecord}
              nextSuggestedId={safeSnapshot.minwonSummary.totalMinwonCount + 1}
              canWrite={canWrite}
              onSaveRecord={upsertMinwon}
              onDeleteRecord={async (id) => {
                await deleteMinwon(id)
                setEditingRecord(null)
                setActiveTab('ledger')
              }}
              onSelectRecord={(rec) => setEditingRecord(rec)}
              onClearInitial={() => setEditingRecord(null)}
              onBackToLedger={() => setActiveTab('ledger')}
            />
          )}

          {activeTab === 'devices' && (
            <DeviceManagementView
              deviceStats={safeSnapshot.deviceStats}
              totalDeviceCount={safeSnapshot.totalDeviceCount}
              canWrite={canWrite}
              refreshTick={refreshTick}
              onShowToast={showToast}
              onRefreshSnapshot={refreshSnapshot}
            />
          )}

          {activeTab === 'stats' && (
            <StatsDashboardView
              minwonSummary={safeSnapshot.minwonSummary}
              deviceStats={safeSnapshot.deviceStats}
              onExportMinwonExcel={async () => {
                const res = await unifiedApiClient.exportMinwonExcel({ prefix: '전체' })
                showToast(res.message)
              }}
              onExportDeviceStatsExcel={async () => {
                const res = await unifiedApiClient.exportDeviceStatsExcel()
                showToast(res.message)
              }}
            />
          )}

          {activeTab === 'server' && (
            <ServerControlView
              config={safeSnapshot.config}
              serverStatus={safeSnapshot.serverStatus}
              users={safeSnapshot.users}
              auditLogs={safeSnapshot.recentAuditLogs}
              isSuperAdmin={isSuperAdmin}
              canManageUsers={canManageUsers}
              canControlServer={canControlServer}
              onToggleServer={toggleServer}
              onUpdateConfig={updateConfig}
              onRefreshSnapshot={refreshSnapshot}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              config={safeSnapshot.config}
              codes={safeSnapshot.codes}
              canWrite={canWrite}
              canControlServer={canControlServer}
              isSuperAdmin={isSuperAdmin}
              onSaveConfig={updateConfig}
              onRefreshSnapshot={refreshSnapshot}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'about' && (
            <ProgramInfoView
              storageInfo={safeSnapshot.storageInfo}
              serverRunning={safeSnapshot.serverStatus.running}
              canControlServer={canControlServer}
              onOpenFolder={handleOpenFolder}
              onToggleServer={() => void toggleServer(!safeSnapshot.serverStatus.running)}
            />
          )}
        </main>

        <StatusFooter
          snapshot={safeSnapshot}
          session={session}
          onOpenFolder={handleOpenFolder}
          onOpenServerTab={() => setActiveTab('server')}
          onOpenLoginModal={() => setLoginModalOpen(true)}
        />
      </div>
    </div>
  )
}
