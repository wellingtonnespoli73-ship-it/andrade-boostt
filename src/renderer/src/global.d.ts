import type { AndradeBoostApi } from '../../shared/contracts'

declare global {
  interface Window {
    andradeBoost: AndradeBoostApi
  }
}

export {}
