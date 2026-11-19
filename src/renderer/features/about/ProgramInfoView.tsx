import React from 'react'
import { FolderOpen, History, Info, Server, Wrench } from 'lucide-react'
import { StorageFolderItem } from '@shared/types/domain'
import { UtilityCard } from '../../components/ui/UtilityCard'
import { PillButton } from '../../components/ui/PillButton'

interface ProgramInfoViewProps {
  storageInfo: StorageFolderItem[]
  serverRunning: boolean
  onOpenFolder: (kind: 'DATA' | 'EXPORT' | 'LOGS' | 'CONFIG') => void
  onToggleServer: () => void
}

function formatKoreanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} 바이트`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} 킬로바이트`
  return `${(bytes / (1024 * 1024)).toFixed(1)} 메가바이트`
}

const RELEASE_HISTORY = [
  {
    version: '버전 1.0.0',
    date: '2026-11-19',
    badge: '현재 운영 버전',
    items: [
      '기존 Excel VBA 민원접수대장(13개 표준 항목, 빠른 기간 필터, 복합 검색, 동적 코드 추가) 100% 통합 및 고도화',
      '무인교통단속장비 마스터(device.csv 487대) 내장 및 설치년도·보호구역·단속종류별 운영현황 통계표 자동 집계',
      '담당자 로그인 모달 폼(관리자·담당자·열람자 권한 분리) 및 작업 감사 로그(Audit Log) 적용',
      '다중 사용자 동시 접속용 내장 REST API & 웹 서버(On/Off 전환, 실시간 SSE 화면 동기화) 탑재'
    ]
  }
]

export const ProgramInfoView: React.FC<ProgramInfoViewProps> = ({
  storageInfo,
  serverRunning,
  onOpenFolder,
  onToggleServer
}) => {
  return (
    <div className="h-full p-3.5 w-full min-h-0 grid grid-cols-12 gap-3">
      {/* 좌측: 프로그램 기본 정보 + 버전 기록 */}
      <div className="col-span-6 min-h-0 flex flex-col gap-3">
        <UtilityCard
          title="프로그램 기본 정보"
          badge={<Info className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="shrink-0"
        >
          <div className="border border-[#cbd5e1] rounded-[8px] overflow-hidden bg-[#ffffff] divide-y divide-[#e2e8f0] text-[13px]">
            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">프로그램명</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-extrabold text-[#0f172a] text-[14px]">
                Minwon Register (민원접수대장)
              </span>
            </div>
            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">시스템 구분</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-semibold text-[#0f172a]">
                무인교통단속장비 민원접수 및 운영현황 관리 시스템
              </span>
            </div>
            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">버전</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-bold text-[#2563eb]">
                버전 1.0.0 (2026.11.19)
              </span>
            </div>
            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">핵심 기능</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-semibold text-[#0f172a]">
                민원 대장 · 장비 통계 · 로그인 인증 · 다중 접속 서버
              </span>
            </div>

            <div className="bg-[#f1f5f9] px-3.5 py-1 text-[11px] font-bold text-[#475569]">
              개발 및 기술지원
            </div>

            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">회사</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-bold text-[#0f172a]">
                ㈜ 이노네트웍스
              </span>
            </div>
            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">제작자</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-semibold text-[#0f172a]">강홍선</span>
            </div>
            <div className="grid grid-cols-12 items-center px-3.5 py-2">
              <span className="col-span-4 text-[#64748b] font-medium">이메일</span>
              <span className="col-span-1 text-center text-[#94a3b8]">:</span>
              <span className="col-span-7 text-right font-semibold text-[#2563eb]">
                s_gain@naver.com
              </span>
            </div>
          </div>
        </UtilityCard>

        <UtilityCard
          title="버전별 업데이트 기록"
          badge={<History className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="overflow-y-auto space-y-2 pr-1"
        >
          {RELEASE_HISTORY.map((rel) => (
            <div
              key={rel.version}
              className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 shrink-0"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-bold text-[#0f172a]">{rel.version}</span>
                  <span className="px-2 py-0.5 rounded-[5px] bg-[#eff6ff] text-[#1d4ed8] border border-[#bfdbfe] text-[10.5px] font-semibold">
                    {rel.badge}
                  </span>
                </div>
                <span className="text-[11.5px] text-[#64748b]">{rel.date}</span>
              </div>
              <ul className="space-y-1 text-[12px] text-[#334155] list-disc list-inside">
                {rel.items.map((item, i) => (
                  <li key={i} className="leading-snug">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </UtilityCard>
      </div>

      {/* 우측: 경로 및 저장소 관리 */}
      <div className="col-span-6 min-h-0 flex flex-col">
        <UtilityCard
          title="현장 유지보수 편의 도구 (경로 및 저장소 관리)"
          badge={<Wrench className="w-3.5 h-3.5 text-[#2563eb]" />}
          className="flex-1 min-h-0"
          bodyClassName="justify-between gap-3"
        >
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
            {storageInfo.map((f) => (
              <div
                key={f.key}
                className="rounded-[8px] border border-[#cbd5e1] bg-[#f8fafc] p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[#0f172a]">{f.label}</span>
                    <span className="px-2 py-0.5 rounded-[5px] bg-[#ffffff] border border-[#cbd5e1] text-[11px] font-semibold text-[#334155]">
                      파일 {f.fileCount.toLocaleString()}개 · {formatKoreanBytes(f.totalBytes)}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-[#64748b] mt-0.5">{f.description}</div>
                  <div
                    className="text-[11.5px] text-[#334155] mt-1 truncate"
                    title={f.resolvedPath}
                  >
                    {f.resolvedPath}
                  </div>
                </div>

                <PillButton
                  variant="secondary-pill"
                  size="sm"
                  onClick={() => onOpenFolder(f.key)}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>폴더 열기</span>
                </PillButton>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#e2e8f0] flex items-center justify-between gap-2 shrink-0">
            <span className="text-[12px] text-[#64748b]">다중 사용자 REST API 서버 빠른 제어</span>
            <PillButton
              variant={serverRunning ? 'dark-utility' : 'primary'}
              size="sm"
              onClick={onToggleServer}
            >
              <Server className="w-3.5 h-3.5" />
              <span>{serverRunning ? '다중 접속 서버 끄기' : '다중 접속 서버 켜기'}</span>
            </PillButton>
          </div>
        </UtilityCard>
      </div>
    </div>
  )
}
