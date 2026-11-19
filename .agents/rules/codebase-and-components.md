---
trigger: always_on
---

# 코드베이스 구조 및 컴포넌트 모듈화 규칙

## 1. 1파일 1책임 (Single Responsibility) 및 모듈 단위 개발 원칙
코드가 짧더라도 한 파일에 여러 컴포넌트나 비즈니스 로직을 몰아넣지 않고, 역할별로 명확히 분리된 모듈/컴포넌트 단위로 개발한다.

### 파일 및 함수 크기 제한
- **UI 컴포넌트 (`.tsx`)**: 권장 200행 이내 (최대 300행 이내 -> 하위 컴포넌트 및 커스텀 훅으로 분리)
- **비즈니스/서비스 모듈 (`.ts`)**: 권장 200행 이내 (최대 300행 이내 -> 라우터, 서비스, 리포지토리로 분리)
- **단일 함수 본문**: 권장 40행 이내 (최대 80행 이내)

## 2. 표준 디렉터리 및 모듈 아키텍처

```plaintext
src/
├── shared/                       # Main, Renderer, REST API가 공유하는 순수 타입, 상수, IPC 채널 규격
│   ├── types/                    # 도메인 모델(민원, 단속장비, 코드항목, 사용자/인증, 통계, 서버상태, 설정)
│   └── ipc-channels.ts           # 타입 안전한 IPC 채널명 정의
├── main/                         # Electron Main 프로세스 (Node.js 환경)
│   ├── index.ts                  # 앱 생명주기, 단일 인스턴스 락, 창/트레이/REST 서버 초기화
│   ├── tray.ts                   # 작업표시줄 트레이 아이콘 및 컨텍스트 메뉴
│   ├── config/                   # 포터블 경로 해석(app-paths) 및 config.json 원자적 읽기/쓰기
│   ├── db/                       # SQLite(better-sqlite3) 초기화, 스키마, 시드, Repository
│   │   ├── connection.ts         # WAL 모드, pragma 설정, DB 연결 싱글톤
│   │   ├── schema.ts             # users, minwon_records, devices, code_items, audit_logs DDL
│   │   ├── seed.ts               # 초기 관리자 계정, 기본 코드 항목, device.csv(487대) 자동 시드
│   │   ├── user-repo.ts          # 사용자 계정 조회/생성/비밀번호 검증 및 감사 로그
│   │   ├── minwon-repo.ts        # 민원 CRUD, 날짜/키워드 복합 검색, 기간별 통계 집계
│   │   ├── device-repo.ts        # 단속장비 CRUD, 검색, 연도별/구역별/단속종류별 운영현황 집계
│   │   └── code-repo.ts          # 접수구분, 구역구분, 검토결과 동적 항목 관리
│   ├── auth/                     # 인증 및 토큰 매니저
│   │   └── auth-service.ts       # scrypt 비밀번호 해싱, HMAC-SHA256 토큰 발급/검증, 세션 관리
│   ├── excel/                    # 엑셀/CSV 입출력 및 보고서 생성기
│   │   └── excel-service.ts      # 표준 서식(맑은 고딕 10pt, 행높이 25, 틀고정, 자동필터) 엑셀/CSV 내보내기 및 가져오기
│   ├── server/                   # 다중 사용자 접속용 내장 REST API & 웹 서버
│   │   ├── rest-server.ts        # HTTP 서버 기동/중지, 정적 웹 클라이언트 서빙, SSE 실시간 브로드캐스트, LAN IP 탐지
│   │   └── api-router.ts         # /api/v1/* REST 엔드포인트 라우팅 및 권한 미들웨어
│   └── ipc/                      # 도메인별 IPC 핸들러 등록
├── preload/                      # ContextBridge 보안 브릿지
│   └── index.ts                  # window.minwonApi 노출
└── renderer/                     # React 19 + Tailwind CSS v4 프론트엔드 (데스크톱 & 웹 브라우저 겸용)
    ├── assets/fonts/             # Pretendard 오프라인 폰트 (.woff2)
    ├── services/
    │   └── api-client.ts         # Electron IPC 및 REST API(Fetch) 하이브리드 통합 클라이언트
    ├── components/
    │   ├── ui/                   # 원자적 공통 UI (PillButton, UtilityCard, OptionChip, SearchInput, SegmentedControl)
    │   └── layout/               # GlobalNav, StatusFooter
    ├── features/
    │   ├── auth/                 # 로그인 모달 폼(LoginModal), 계정 전환 및 비밀번호 변경 모달, 원격 서버 연결 설정
    │   ├── minwon/               # 민원접수대장 메인(복합 검색 바, 고밀도 테이블, 신규 등록/수정 폼 모달, 장비 위치 연동)
    │   ├── devices/              # 무인교통단속장비 마스터 관리 및 연도별·유형별 운영현황 통계표
    │   ├── stats/                # 민원 접수/처리 통계 및 장비 현황 시각화 대시보드
    │   ├── server/               # 다중 사용자 REST API 서버 제어판, 접속 주소 안내, 사용자 계정(RBAC) 및 감사 로그 관리
    │   ├── settings/             # 코드 항목(접수구분/구역구분/검토결과) 편집, 자동 서버 시작, 포트 및 백업 설정
    │   └── about/                # 프로그램 기본 정보, 버전 기록, 저장소 폴더 관리 도구
    ├── hooks/                    # 상태 동기화 및 인증 관리 커스텀 훅
    └── styles/                   # DESIGN.md 토큰 및 Pretendard 기반 글로벌 스타일
```
