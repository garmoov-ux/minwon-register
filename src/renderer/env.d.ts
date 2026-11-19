import type { minwonApi } from '../../preload/index'

declare global {
  interface Window {
    minwonApi?: typeof minwonApi
  }
}

export {}
