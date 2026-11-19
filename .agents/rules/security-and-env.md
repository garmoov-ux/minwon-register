---
trigger: always_on
---

# 보안, Electron 프로세스 격리, REST API 인증, SQLite 및 환경변수(.env) 규칙

## 1. 환경변수 (`.env` / `.env.example`) 관리 규칙
- 환경별 설정값(포트, DB 경로, 로그 경로, 초기 시크릿 등)은 `.env` 또는 실행 폴더의 `config.json`을 통해 주입할 수 있도록 구성한다.
- `.env` 파일은 절대 Git에 커밋하지 않으며(`.gitignore` 등록), `.env.example` 파일을 저장소 루트에 유지한다.
- Renderer 프로세스에는 `process.env`를 직접 노출하지 않으며, 검증된 설정값만 IPC 또는 REST API를 통해 전달한다.

## 2. Electron 보안 아키텍처
- `BrowserWindow` 생성 시 다음 보안 옵션을 적용한다:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `webSecurity: true`
- Renderer에서 Main 기능을 호출할 때는 `preload/index.ts`의 `contextBridge.exposeInMainWorld('minwonApi', ...)`에 정의된 명시적 함수만 사용한다.

## 3. 로그인 인증 및 내장 REST API 보안 규칙
- 사용자 비밀번호는 평문으로 저장하지 않고 Node.js `crypto.scryptSync`(솔트 포함)로 안전하게 해싱하여 SQLite `users` 테이블에 저장한다.
- REST API 서버 활성화 시 로그인(`POST /api/v1/auth/login`)을 제외한 모든 데이터 조회/변경 API(`/api/v1/*`)는 `Authorization: Bearer <token>` 헤더의 서명된 토큰(HMAC-SHA256) 및 만료 시간을 검증한다.
- 역할 기반 접근 제어(RBAC)를 적용하여 `VIEWER`(`열람자`) 권한은 쓰기/수정/삭제 API 호출을 차단하고, 사용자 관리 및 전체 초기화는 `ADMIN`(`관리자`) 권한만 허용한다.
- CORS 헤더 및 JSON 바디 크기 제한(최대 10MB)을 적용하여 비정상 요청으로 인한 메모리 고갈을 방지한다.

## 4. SQLite (`better-sqlite3`) 보안 및 무결성 규칙
- 모든 SQL 쿼리는 100% Prepared Statement 및 바인딩 파라미터(`?` 또는 `@param`)만 사용하여 SQL Injection을 원천 차단한다.
- DB 연결 즉시 아래 Pragma를 실행한다:
  - `PRAGMA journal_mode = WAL;`
  - `PRAGMA synchronous = NORMAL;`
  - `PRAGMA foreign_keys = ON;`
  - `PRAGMA busy_timeout = 5000;`
- 대량 장비 시드 적재, 엑셀 일괄 가져오기 및 통계 갱신 시 `db.transaction(...)`을 사용하여 원자성과 속도를 보장한다.
