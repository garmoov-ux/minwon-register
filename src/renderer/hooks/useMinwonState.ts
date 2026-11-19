import { useCallback, useEffect, useState } from 'react'
import {
  AppConfig,
  AppSnapshot,
  AuthSession,
  MinwonUpsertPayload
} from '@shared/types/domain'
import {
  getClientConnectionConfig,
  getSavedAuthSession,
  isElectronEnvironment,
  unifiedApiClient
} from '../services/api-client'

export function useMinwonState() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [session, setSession] = useState<AuthSession | null>(() => getSavedAuthSession())
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(() => !getSavedAuthSession())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState<number>(0)

  const showToast = useCallback((msg: string): void => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3500)
  }, [])

  const refreshSnapshot = useCallback(async (): Promise<void> => {
    const snap = await unifiedApiClient.getSnapshot()
    if (snap) {
      setSnapshot(snap)
      setRefreshTick((t) => t + 1)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refreshSnapshot()

    if (isElectronEnvironment() && window.minwonApi) {
      const unsubscribe = window.minwonApi.onStateUpdated((nextSnap: AppSnapshot) => {
        setSnapshot(nextSnap)
        setRefreshTick((t) => t + 1)
      })
      return () => unsubscribe()
    }

    // 웹 브라우저 또는 원격 서버 모드에서는 SSE 실시간 동기화 구독
    const conn = getClientConnectionConfig()
    if (!isElectronEnvironment() || conn.mode === 'REMOTE') {
      const base = isElectronEnvironment()
        ? conn.remoteServerUrl.replace(/\/+$/, '')
        : window.location.origin
      try {
        const es = new EventSource(`${base}/api/v1/events`)
        es.onmessage = () => {
          void refreshSnapshot()
        }
        return () => es.close()
      } catch {
        // ignore
      }
    }
    return undefined
  }, [refreshSnapshot])

  const handleLoginSuccess = useCallback(
    (newSession: AuthSession, message: string): void => {
      setSession(newSession)
      setLoginModalOpen(false)
      showToast(message)
      void refreshSnapshot()
    },
    [refreshSnapshot, showToast]
  )

  const handleLogout = useCallback(async (): Promise<void> => {
    await unifiedApiClient.logout()
    setSession(null)
    setLoginModalOpen(true)
    showToast('로그아웃되었습니다.')
  }, [showToast])

  const upsertMinwon = useCallback(
    async (payload: MinwonUpsertPayload): Promise<boolean> => {
      const res = await unifiedApiClient.upsertMinwon(payload)
      showToast(res.message)
      if (res.ok) {
        await refreshSnapshot()
      }
      return res.ok
    },
    [refreshSnapshot, showToast]
  )

  const deleteMinwon = useCallback(
    async (id: number): Promise<void> => {
      const res = await unifiedApiClient.deleteMinwon(id)
      showToast(res.message)
      if (res.ok) {
        await refreshSnapshot()
      }
    },
    [refreshSnapshot, showToast]
  )

  const toggleServer = useCallback(
    async (enabled: boolean, port?: number): Promise<void> => {
      const res = await unifiedApiClient.toggleServer(enabled, port)
      showToast(res.message)
      await refreshSnapshot()
    },
    [refreshSnapshot, showToast]
  )

  const updateConfig = useCallback(
    async (nextConfig: AppConfig): Promise<void> => {
      const res = await unifiedApiClient.updateConfig(nextConfig)
      showToast(res.message)
      await refreshSnapshot()
    },
    [refreshSnapshot, showToast]
  )

  return {
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
  }
}
