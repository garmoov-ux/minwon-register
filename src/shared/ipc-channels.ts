export const IPC_CHANNELS = {
  GET_SNAPSHOT: 'minwon:get-snapshot',
  STATE_UPDATED: 'minwon:state-updated',

  // 인증 및 계정 관리
  AUTH_LOGIN: 'minwon:auth-login',
  AUTH_LOGOUT: 'minwon:auth-logout',
  AUTH_CHANGE_PASSWORD: 'minwon:auth-change-password',
  USER_UPSERT: 'minwon:user-upsert',
  USER_DELETE: 'minwon:user-delete',

  // 민원접수대장 CRUD 및 검색
  MINWON_LIST: 'minwon:list',
  MINWON_UPSERT: 'minwon:upsert',
  MINWON_DELETE: 'minwon:delete',
  MINWON_RESET_ALL: 'minwon:reset-all',

  // 무인교통단속장비 마스터 CRUD 및 통계
  DEVICE_LIST: 'minwon:device-list',
  DEVICE_UPSERT: 'minwon:device-upsert',
  DEVICE_DELETE: 'minwon:device-delete',
  DEVICE_RELOAD_CSV: 'minwon:device-reload-csv',

  // 코드 항목 관리 (접수구분, 구역구분, 검토결과)
  CODE_ADD: 'minwon:code-add',
  CODE_DELETE: 'minwon:code-delete',

  // 엑셀 / CSV 내보내기
  EXPORT_MINWON_EXCEL: 'minwon:export-minwon-excel',
  EXPORT_DEVICE_STATS_EXCEL: 'minwon:export-device-stats-excel',

  // 내장 REST API 서버 제어 및 설정
  SERVER_TOGGLE: 'minwon:server-toggle',
  CONFIG_UPDATE: 'minwon:config-update',
  OPEN_FOLDER: 'minwon:open-folder'
} as const
