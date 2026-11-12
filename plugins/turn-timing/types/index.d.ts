export type Timing = {
  totalMs: number
  thinkingMs: number
  respondingMs: number
  toolsMs: number
  text: string
}

export type TimingRow = {
  id: string
  messageIds?: string[]
  text: string
  tokens?: string
  isReady: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'turn-timing': {
      rows: Shaped<TimingRow[]>
    }
  }
}
