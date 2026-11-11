import { atom, derive, read, update } from 'claude-code'
import type { EngineInterface, Register, TurnCompleteInput, TurnCompleteResult } from 'claude-code'

import type { Timing, TimingRow } from '../types'

const rows = atom({ plugin: 'turn-timing', key: 'rows' } as const, [], { shape: 'rows-9' })
const byId = derive([rows], list => new Map(list.map(row => [row.id, row])))

type MainLoop = {
  turnId: string
  thinkingMs: number
  respondingMs: number
  toolsMs: number
  activeTools: number
  toolsStartedAt: number
  lastMessageId?: string
}

type Options = Parameters<Register>[1]

const duration = (ms: number) => {
  const seconds = Math.floor(Math.max(0, ms) / 1000)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m${seconds % 60 ? `${seconds % 60}s` : ''}`
  return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`
}

const WORDS = {
  '中文': ['工作', '思考', '回答', '工具'],
  English: ['Worked', 'Thought', 'Responded', 'Tools'],
  '日本語': ['作業', '思考', '回答', 'ツール'],
} as const

const TOKEN_WORDS = {
  '中文': ['Token', '输入', '缓存', '输出'],
  English: ['Tokens', 'Input', 'Cache', 'Output'],
  '日本語': ['Token', '入力', 'キャッシュ', '出力'],
} as const

const languageOf = (options: Options, locale: string) => {
  const configured = { auto: 'Auto', 'zh-CN': '中文', en: 'English', 'ja-JP': '日本語', custom: 'Custom' }[String(options.language ?? 'English')] ?? String(options.language ?? 'English')
  return configured === 'Auto'
    ? (/^zh/i.test(locale) ? '中文' : /^ja/i.test(locale) ? '日本語' : 'English')
    : configured
}

const wordsOf = (options: Options, locale: string) => {
  const language = languageOf(options, locale)
  const builtIn = WORDS[language as keyof typeof WORDS]
  const custom = [options.totalLabel, options.thinkingLabel, options.respondingLabel, options.toolsLabel]
    .map(value => String(value ?? '').trim())
  return language === 'Custom' && custom.every(value => value.length > 0) ? custom : (builtIn ?? WORDS.English)
}

const label = (timing: Timing, options: Options, locale: string) => {
  const [total, thinking, responding, tools] = wordsOf(options, locale)
  const values = [timing.totalMs, timing.thinkingMs, timing.respondingMs, timing.toolsMs]
  const body = [total, thinking, responding, tools]
    .map((word, i) => `${word} ${duration(values[i] ?? 0)}`)
    .join(' · ')
  const prefix = String(options.prefix ?? '').trim()
  return prefix ? `${prefix} ${body}` : body
}

const compactTokens = (value: number) => {
  const count = Math.max(0, Math.round(value))
  if (count < 1000) return String(count)
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
}

const tokenTextOf = (e: TurnCompleteInput, options: Options, locale: string) => {
  if (options.showTokens === false || !e.usage) return undefined

  const usage = e.usage
  const input = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
  const total = input + usage.output_tokens
  const hitRate = input > 0 ? Math.round((usage.cache_read_input_tokens / input) * 100) : 0
  const [totalWord, inputWord, cacheWord, outputWord] =
    TOKEN_WORDS[languageOf(options, locale) as keyof typeof TOKEN_WORDS] ?? TOKEN_WORDS.English

  return `${totalWord} ${compactTokens(total)} · ${inputWord} ${compactTokens(input)} · ${cacheWord} ${compactTokens(usage.cache_read_input_tokens)} (${hitRate}%) · ${outputWord} ${compactTokens(usage.output_tokens)}`
}

const timingOf = (loop: MainLoop, e: TurnCompleteInput, options: Options, locale: string): Timing => {
  const toolsMs = Math.min(loop.toolsMs, e.durationMs)
  const modelMs = Math.max(0, e.durationMs - toolsMs)
  const measured = loop.thinkingMs + loop.respondingMs
  const scale = measured > modelMs ? modelMs / measured : 1
  const thinkingMs = Math.min(modelMs, Math.round(loop.thinkingMs * scale))
  const timing: Timing = {
    totalMs: e.durationMs,
    thinkingMs,
    respondingMs: modelMs - thinkingMs,
    toolsMs,
    text: '',
  }
  timing.text = label(timing, options, locale)
  return timing
}

const empty = (turnId: string): MainLoop => ({
  turnId, thinkingMs: 0, respondingMs: 0, toolsMs: 0, activeTools: 0, toolsStartedAt: 0,
})

async function finish(
  $: EngineInterface,
  e: TurnCompleteInput,
  result: TurnCompleteResult,
  loop: MainLoop,
  options: Options,
  locale: string,
): Promise<TurnCompleteResult> {
  const timing = timingOf(loop, e, options, locale)
  const id = loop.lastMessageId ?? `turn-${e.turnId.replace(/[^A-Za-z0-9_-]/g, '') || 'main'}`
  const row: TimingRow = { id, text: timing.text, tokens: tokenTextOf(e, options, locale), isReady: true }
  await update($, rows, list => [...list.filter(one => one.id !== id), row].slice(-50))
  return result
}

export const register: Register = (on, options) => {
  let localePromise: Promise<string> | null = null
  let current: MainLoop | null = null

  on('turn.start', (_, e, next) => {
    if (e.agentId === undefined) current = empty(e.turnId)
    return next(e)
  })

  on('session.append', { door: 'response' }, async (_, e, next) => {
    const loop = e.agentId === undefined ? current : null
    const result = await next(e)
    const content = result.message?.type === 'assistant' && Array.isArray(result.message.content)
      ? result.message.content
      : []
    if (loop && content.some(block => block.type === 'text' && typeof block.text === 'string' && block.text.trim() !== '')) {
      loop.lastMessageId = result.uuid
    }
    return result
  })

  // Chunks are model response time; tool time is measured by the tool.call hook.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined || !current) return yield* next(e)

    const loop = current
    let mode: 'thinking' | 'responding' | 'idle' = 'idle'
    let since = await $.clock.now()

    for await (const chunk of next(e)) {
      const nextMode: 'thinking' | 'responding' | 'idle' =
        chunk.kind === 'thinking'
          ? 'thinking'
          : chunk.kind === 'text' || chunk.kind === 'tool' || chunk.kind === 'input'
            ? 'responding'
            : 'idle'
      const now = await $.clock.now()

      if (nextMode !== mode) {
        if (mode === 'thinking') loop.thinkingMs += Math.max(0, now - since)
        else if (mode === 'responding') loop.respondingMs += Math.max(0, now - since)
        since = now
        mode = nextMode
      }

      yield chunk
    }

    const endedAt = await $.clock.now()
    if (mode === 'thinking') loop.thinkingMs += Math.max(0, endedAt - since)
    else if (mode === 'responding') loop.respondingMs += Math.max(0, endedAt - since)
  })

  on('tool.call', async ($, e, next) => {
    const loop = e.agentId === undefined ? current : null
    if (!loop) return next(e)

    const startedAt = await $.clock.now()
    if (loop.activeTools++ === 0) loop.toolsStartedAt = startedAt
    try {
      return await next(e)
    } finally {
      const endedAt = await $.clock.now()
      if (--loop.activeTools === 0) loop.toolsMs += Math.max(0, endedAt - loop.toolsStartedAt)
    }
  })
  .catch((_, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined) return result
    localePromise ??= Promise.all([
      $.env.get('LC_ALL'),
      $.env.get('LC_MESSAGES'),
      $.env.get('LANG'),
    ]).then(values => values.find(value => value && value !== 'C') ?? 'en')
    await finish($, e, result, current ?? empty(e.turnId), options, await localePromise)
    current = null
    return result
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = (await read($, byId)).get(e.requestId)
    if (!row) return next(e)

    const engine = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {engine}
        <Box marginTop={1}>
          <Text dimColor size="caption" wrap="truncate-end">
            {row.tokens ? `${row.text} & ${row.tokens}` : row.text}
          </Text>
        </Box>
      </Box>
    )
  })
}
