import type { minwonApi } from '../preload/index'

declare global {
  interface Window {
    minwonApi?: typeof minwonApi
  }
}

declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.ico' {
  const src: string
  export default src
}

export {}
