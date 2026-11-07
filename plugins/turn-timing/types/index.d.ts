export type Timing = {
  totalMs: number
  thinkingMs: number
  respondingMs: number
  toolsMs: number
  text: string
}

export type TimingRow = {
  id: string
  text: string
  isReady: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'turn-timing': {
      last: Timing | null
      rows: Shaped<TimingRow[]>
    }
  }
}
