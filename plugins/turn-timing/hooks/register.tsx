import { atom, read, update } from 'claude-code'
import type { Register, TurnCompleteInput } from 'claude-code'

import type { Timing, TimingRow } from '../types'

const HISTORY_LIMIT = 50
const rows = atom({ plugin: 'turn-timing', key: 'rows' } as const, [], { shape: 'rows-10' })

type MainLoop = {
  turnId: string
  thinkingMs: number
  respondingMs: number
  toolsMs: number
  activeTools: number
  toolsStartedAt: number
  messageIds: string[]
  answer: string
  renders: Map<string, { surface: string; id: string; text: string }>
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
    respondingMs: Math.min(modelMs - thinkingMs, Math.round(loop.respondingMs * scale)),
    toolsMs,
    text: '',
  }
  timing.text = label(timing, options, locale)
  return timing
}

const empty = (turnId: string): MainLoop => ({
  turnId, thinkingMs: 0, respondingMs: 0, toolsMs: 0, activeTools: 0, toolsStartedAt: 0,
  messageIds: [], answer: '', renders: new Map(),
})

export const register: Register = (on, options) => {
  let localePromise: Promise<string> | null = null
  let current: MainLoop | null = null
  let generation = 0
  const loops = new Map<string, MainLoop>()
  // Only the retained rows own bindings; rendering never writes engine state.
  const bindings = new Map<string, Map<string, string>>()

  on('turn.start', (_, e, next) => {
    if (e.agentId === undefined) {
      current = empty(e.turnId)
      loops.set(e.turnId, current)
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    generation++
    current = null
    loops.clear()
    bindings.clear()
    localePromise = null
    await update($, rows, () => [])
    return next(e)
  })
  .catch((_, e, next) => next(e))

  on('session.append', { door: 'response' }, async (_, e, next) => {
    const loop = e.agentId === undefined ? current : null
    const result = await next(e)
    if (!loop || result.message?.type !== 'assistant') return result
    const textBlocks = result.message.content.filter(block =>
      block.type === 'text' && typeof block.text === 'string' && block.text !== '',
    )
    const lastText = textBlocks.at(-1)?.text
    if (typeof lastText !== 'string' || lastText.trim() === '') return result

    // API id is optional: the host normally exposes only the stored row UUID.
    const apiId = (result.message as { id?: unknown }).id
    const ids = [result.uuid, ...(typeof apiId === 'string' ? [apiId] : [])]
      .filter((id): id is string => typeof id === 'string')
    loop.messageIds = ids.flatMap(id => [id, `${id}-t${textBlocks.length - 1}`])
    loop.answer = lastText
    return result
  })
  .catch((_, e, next) => next(e))

  // Chunks are model response time; tool time is measured by the tool.call hook.
  on('turn.step', async function* ($, e, next) {
    const loop = e.agentId === undefined ? loops.get(e.turnId) : undefined
    if (!loop) return yield* next(e)
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
    if (e.agentId !== undefined) return next(e)
    const loop = loops.get(e.turnId) ?? empty(e.turnId)
    const sessionGeneration = generation
    loops.delete(e.turnId)
    if (current === loop) current = null
    const endedAt = await $.clock.now()
    const snapshot = {
      ...loop,
      toolsMs: loop.toolsMs + (loop.activeTools > 0 ? Math.max(0, endedAt - loop.toolsStartedAt) : 0),
    }
    const result = await next(e)
    localePromise ??= Promise.all([
      $.env.get('LC_ALL'), $.env.get('LC_MESSAGES'), $.env.get('LANG'),
    ]).then(values => values.find(value => value) ?? 'en')
    const locale = await localePromise
    if (generation !== sessionGeneration) return result

    const timing = timingOf(snapshot, e, options, locale)
    const answer = loop.answer || e.answer
    const row: TimingRow = {
      id: e.turnId, messageIds: loop.messageIds, answer,
      text: timing.text, tokens: tokenTextOf(e, options, locale),
    }
    const bound = new Map<string, string>()
    for (const surface of new Set([...loop.renders.values()].map(render => render.surface))) {
      const candidates = [...loop.renders.values()].filter(render => render.surface === surface)
      const exact = candidates.filter(render => row.messageIds.includes(render.id))
      const byText = candidates.filter(render => answer !== '' && render.text === answer)
      const matches = exact.length ? exact : byText
      // A render-only host can still identify a single reply block.
      const match = matches.length === 1 ? matches[0]
        : answer === '' && candidates.length === 1 ? candidates[0] : undefined
      if (match) {
        bound.set(surface, match.id)
        row.messageIds.push(match.id)
      }
    }
    bindings.set(row.id, bound)
    if (generation !== sessionGeneration) return result
    const saved = await update($, rows, previous => [...previous.filter(one => one.id !== row.id), row].slice(-HISTORY_LIMIT))
    const retained = new Set(saved.map(one => one.id))
    for (const id of bindings.keys()) if (!retained.has(id)) bindings.delete(id)
    return result
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const list = await read($, rows)
    const owner = list.find(one => one.messageIds.includes(e.requestId) ||
      bindings.get(one.id)?.get(e.surface) === e.requestId)
    if (current && !owner && e.props.text.trim() !== '') {
      const key = `${e.surface}\0${e.requestId}`
      current.renders.set(key, { surface: e.surface, id: e.requestId, text: e.props.text })
      if (current.renders.size > 256) current.renders.delete(current.renders.keys().next().value!)
    }
    if (current && !owner) return next(e)

    // Late drawing must not depend on turn.start/complete still being active.
    // Identical answers without an explicit ID are ambiguous: do not guess.
    const isEarlierBlock = list.some(one => one.messageIds.some(id =>
      /-t\d+$/.test(id) && id !== e.requestId &&
      id.replace(/-t\d+$/, '') === e.requestId.replace(/-t\d+$/, ''),
    ))
    const matches = owner ? [owner] : isEarlierBlock ? []
      : list.filter(one => one.answer !== '' && one.answer === e.props.text)
    const row = matches.length === 1 ? matches[0] : undefined
    if (!row) return next(e)
    const bound = bindings.get(row.id) ?? new Map<string, string>()
    const boundId = bound.get(e.surface)
    if (boundId !== undefined && boundId !== e.requestId) return next(e)
    bound.set(e.surface, e.requestId)
    bindings.set(row.id, bound)

    const engine = await next(e)
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {engine}
        <Box marginTop={1}>
          <Text dimColor size="caption" wrap="wrap">
            {row.tokens ? `${row.text} & ${row.tokens}` : row.text}
          </Text>
        </Box>
      </Box>
    )
  })
}
