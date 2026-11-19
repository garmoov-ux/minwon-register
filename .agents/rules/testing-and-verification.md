---
trigger: always_on
---

# 테스트 및 품질 검증 규칙 (Testing & Verification)

## 1. 핵심 기능 단위 및 통합 테스트 (`Vitest`) 필수
- **민원접수대장 CRUD 및 복합 검색 테스트**:
  - 인메모리 SQLite(`:memory:`) 기반으로 민원 13개 필드 등록/수정/삭제, 접수구분 신규 입력 시 코드 자동 등록, 빠른 기간 필터(`당월`, `3개월`, `6개월`, `9개월`, `금년`) 및 검색구분+검토결과 복합 필터 쿼리가 정확히 동작하는지 검증한다.
- **무인교통단속장비 마스터(`device.csv`) 시드 및 운영현황 통계(`operator-status.xlsx`) 정합성 테스트**:
  - `_ref_VBA/device.csv`(487대) 데이터를 적재했을 때 연도별·보호구역별(`일반구역` 221, `어린이보호구역` 237, `노인보호구역` 28, `장애인보호구역` 1)·단속종류별(`신호과속(고)` 204, `과속(고)` 233, `구간(고)` 27, `운행제한(고)` 2, `진입금지(고)` 2, `과속(이)` 19, 총합계 487대) 집계 결과가 기존 `_ref_VBA/operator-status.xlsx`와 100% 일치하는지 검증한다.
- **로그인 인증(RBAC) 및 내장 REST API 서버 통합 테스트**:
  - 비밀번호 해싱/검증, 토큰 발급, 내장 HTTP REST API 서버 기동 후 `POST /api/v1/auth/login`, `GET/POST/PUT/DELETE /api/v1/minwon`, `GET /api/v1/stats` 및 권한별 접근 제어가 정상 작동하는지 실제 HTTP 요청으로 검증한다.

## 2. 구현 완료 전 필수 검증 절차 (Definition of Done)
코드를 수정하거나 기능을 구현한 뒤에는 반드시 아래 3단계를 실행하여 통과를 확인한다:
1. **타입 검사**: `npm run typecheck` (`tsc --noEmit`) 에러 0건
2. **단위/통합 테스트**: `npm test` (`vitest run`) 전체 통과
3. **빌드 검증**: `npm run build` 정상 빌드 확인
