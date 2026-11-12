import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const turn = { text: 'hello', turnId: 'turn-1' } as const

const complete = (durationMs: number, turnId = 'turn-1', usage?: any) => ({
  ...turn,
  turnId,
  answer: '',
  durationMs,
  isAborted: false,
  reason: 'answer' as const,
  ...(usage ? { usage } : {}),
})

const assistant = (requestId: string) => ({
  plugin: 'turn-timing',
  component: 'AssistantMessage',
  requestId,
  props: { text: 'engine answer', isFirstOfReply: true },
} as const)

const bottom = (on: Parameters<TestBody>[1], locale = 'en_US.UTF-8') => {
  mock.clock(on)
  mock.env(on, { LANG: locale })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e as never)
    return <Text>engine answer</Text>
  })
}

const timing = async (ui: any) => (await ui.find({ type: 'Text', text: /Worked|工作|作業|Total/ }))?.text
const tokenText = async (ui: any) => (await ui.find({ type: 'Text', text: /Tokens|Token/ }))?.text

const showAnswer = async ($: any, id = 'msg-1') => {
  await $.session.append({
    uuid: id, door: 'response', origin: { kind: 'model', model: 'test' },
    message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text: 'engine answer' }] },
  })
  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  await ui.unmount()
  return id
}

test('each reply appends timing to its own final assistant message', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  await $.turn.start(turn)
  const firstId = await showAnswer($, 'msg-1')
  await $.turn.complete(complete(90000))

  await $.turn.start({ ...turn, turnId: 'turn-2' })
  const secondId = await showAnswer($, 'msg-2')
  await $.turn.complete(complete(20000, 'turn-2'))

  const first = await $.ui.mount({ ...assistant(firstId), surface: 'desktop' })
  expect(await timing(first)).toContain('Worked 1m30s')
  expect(await timing(first)).not.toContain('Worked 20s')
  await first.unmount()

  const second = await $.ui.mount({ ...assistant(secondId), surface: 'desktop' })
  expect(await timing(second)).toContain('Worked 20s')
  expect(await timing(second)).not.toContain('Worked 1m30s')
  await second.unmount()
})


test('a running reply has no timing until it completes', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-1')

  const running = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(running)).toBeUndefined()
  await running.unmount()

  await $.turn.complete(complete(30000))
  const done = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})

test('Auto follows an explicit Chinese locale', { options: { language: 'Auto' } }, async ($, on) => {
  bottom(on, 'zh_CN.UTF-8')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-1')
  await $.turn.complete(complete(30000))

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(ui)).toContain('工作 30s')
  await ui.unmount()
})

test('English is the default language', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-1')
  await $.turn.complete(complete(30000))

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(ui)).toContain('Worked 30s')
  await ui.unmount()
})

test('token totals and cache hit rate use the whole input', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-tokens')
  await $.turn.complete(complete(30000, 'turn-1', {
    model: 'test', input_tokens: 2000, output_tokens: 1000,
    cache_read_input_tokens: 8000, cache_creation_input_tokens: 2000,
  }))

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await tokenText(ui)).toContain('Tools 0s & Tokens 13k · Input 12k · Cache 8k (67%) · Output 1k')
  await ui.unmount()
})

test('showTokens false hides the token line', { options: { showTokens: false } }, async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-no-tokens')
  await $.turn.complete(complete(30000, 'turn-1', {
    model: 'test', input_tokens: 2000, output_tokens: 1000,
    cache_read_input_tokens: 8000, cache_creation_input_tokens: 2000,
  }))

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(ui)).toContain('Worked 30s')
  expect(await tokenText(ui)).toBeUndefined()
  await ui.unmount()
})

test('timing estimates split a 90s reply', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e as never)
    return <Text>engine answer</Text>
  })
  on('tool.call', async () => {
    await clock.sleep(60000)
    return { result: {} }
  })
  on('turn.step', async function* () {
    yield { kind: 'thinking', index: 0, text: 'hmm' }
    await clock.sleep(20000)
    yield { kind: 'text', index: 1, text: 'done' }
    await clock.sleep(10000)
    return { turnId: 'turn-1', index: 0, answer: 'done', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-1')
  const step = $.turn.step({ turnId: 'turn-1', index: 0, model: 'test', messageCount: 1 })
  const draining = (async () => { for await (const _ of step) void _ })()
  const tool = $.tool.call({ tool: 'Bash', command: 'sleep 1' })
  await Promise.all([draining, clock.set(30000), clock.set(90000), tool])
  await $.turn.complete(complete(90000))

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(ui)).toContain('Worked 1m30s · Thought 20s · Responded 10s · Tools 1m')
  await ui.unmount()
})

test('custom prefix and labels override built-in language', { options: {
  language: 'Custom', prefix: '⏱', totalLabel: 'Total', thinkingLabel: 'Think', respondingLabel: 'Reply', toolsLabel: 'Tools',
} }, async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-1')
  await $.turn.complete(complete(30000))

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(ui)).toContain('⏱ Total 30s · Think 0s · Reply 30s · Tools 0s')
  await ui.unmount()
})

test('interrupted replies report elapsed time', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const id = await showAnswer($, 'msg-1')
  await $.turn.complete({ ...complete(12000), isAborted: true, reason: 'aborted' })

  const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
  expect(await timing(ui)).toContain('Worked 12s')
  await ui.unmount()
})

test('subagent turns are ignored', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ ...complete(5000), agentId: 'agent-1' })

  const ui = await $.ui.mount({ ...assistant('turn-turn-1'), surface: 'desktop' })
  expect(await timing(ui)).toBeUndefined()
  await ui.unmount()
})

test('repainting history does not reassign current reply timing', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await showAnswer($, 'old-message')
  await $.turn.complete(complete(90000))
  await $.turn.start({ ...turn, turnId: 'turn-2' })
  await showAnswer($, 'new-message')
  const history = await $.ui.mount({ ...assistant('old-message'), surface: 'desktop' })
  await history.unmount()
  await $.turn.complete(complete(20000, 'turn-2'))
  const old = await $.ui.mount({ ...assistant('old-message'), surface: 'desktop' })
  expect(await timing(old)).toContain('Worked 1m30s')
  await old.unmount()
  const fresh = await $.ui.mount({ ...assistant('new-message'), surface: 'desktop' })
  expect(await timing(fresh)).toContain('Worked 20s')
  await fresh.unmount()
})

test('falls back to render tracking when no append binding exists', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const rendered = await $.ui.mount({ ...assistant('render-only'), surface: 'desktop' })
  await rendered.unmount()
  await $.turn.complete(complete(30000))
  const done = await $.ui.mount({ ...assistant('render-only'), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})

test('falls back to the first unseen render when append IDs do not match', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.session.append({
    uuid: 'row-3', door: 'response', origin: { kind: 'model', model: 'test' },
    message: {
      id: 'msg-3', type: 'assistant', role: 'assistant',
      content: [{ type: 'text', text: 'engine answer' }],
    } as any,
  })
  const rendered = await $.ui.mount({ ...assistant('render-3'), surface: 'desktop' })
  await rendered.unmount()
  await $.turn.complete(complete(30000))
  const done = await $.ui.mount({ ...assistant('render-3'), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})

test('binds timing to the rendered API message id when the row uuid differs', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.session.append({
    uuid: 'row-1', door: 'response', origin: { kind: 'model', model: 'test' },
    message: {
      id: 'msg-1', type: 'assistant', role: 'assistant',
      content: [{ type: 'text', text: 'engine answer' }],
    } as any,
  })
  const rendered = await $.ui.mount({ ...assistant('msg-1'), surface: 'desktop' })
  await rendered.unmount()
  await $.turn.complete(complete(30000))
  const done = await $.ui.mount({ ...assistant('msg-1'), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})

test('binds timing to the row uuid when the render uses it', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.session.append({
    uuid: 'row-2', door: 'response', origin: { kind: 'model', model: 'test' },
    message: {
      id: 'msg-2', type: 'assistant', role: 'assistant',
      content: [{ type: 'text', text: 'engine answer' }],
    } as any,
  })
  const rendered = await $.ui.mount({ ...assistant('row-2'), surface: 'desktop' })
  await rendered.unmount()
  await $.turn.complete(complete(30000))
  const done = await $.ui.mount({ ...assistant('row-2'), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})

test('built-in language ignores saved custom labels', { options: {
  language: 'English', totalLabel: 'Total', thinkingLabel: 'Think', respondingLabel: 'Reply', toolsLabel: 'Tools',
} }, async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await showAnswer($)
  await $.turn.complete(complete(30000))
  const ui = await $.ui.mount({ ...assistant('msg-1'), surface: 'desktop' })
  expect(await timing(ui)).toContain('Worked 30s')
  await ui.unmount()
})

test('overlapping tool calls count wall-clock time once', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e as never)
    return <Text>engine answer</Text>
  })
  on('tool.call', async () => {
    await clock.sleep(10000)
    return { result: {} }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await showAnswer($)
  const a = $.tool.call({ tool: 'Bash', command: 'a' })
  const b = $.tool.call({ tool: 'Bash', command: 'b' })
  await Promise.all([a, b, clock.set(10000)])
  await $.turn.complete(complete(20000))
  const ui = await $.ui.mount({ ...assistant('msg-1'), surface: 'desktop' })
  expect(await timing(ui)).toContain('Responded 10s · Tools 10s')
  await ui.unmount()
})

test('final main message gets timing without rendering before completion', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  for (const [uuid, text, agentId] of [
    ['intermediate', 'working', undefined],
    ['final', 'done', undefined],
    ['child', 'child answer', 'agent-1'],
    ['blank', '  ', undefined],
  ] as const) {
    await $.session.append({
      uuid, agentId, door: 'response', origin: { kind: 'model', model: 'test' },
      message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text }] },
    })
  }
  await $.turn.complete(complete(30000))
  for (const id of ['intermediate', 'final', 'child', 'blank']) {
    const ui = await $.ui.mount({ ...assistant(id), surface: 'desktop' })
    if (id === 'final') expect(await timing(ui)).toContain('Worked 30s')
    else expect(await timing(ui)).toBeUndefined()
    await ui.unmount()
  }
})

test('partially overlapping and sequential tools count only occupied intervals', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e as never)
    return <Text>engine answer</Text>
  })
  on('tool.call', async () => {
    await clock.sleep(10000)
    return { result: {} }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await showAnswer($)
  const a = $.tool.call({ tool: 'Bash', command: 'a' })
  await clock.set(5000)
  const b = $.tool.call({ tool: 'Bash', command: 'b' })
  await Promise.all([a, b, clock.set(15000)])
  await clock.set(20000)
  const c = $.tool.call({ tool: 'Bash', command: 'c' })
  await Promise.all([c, clock.set(30000)])
  await $.turn.complete(complete(40000))
  const ui = await $.ui.mount({ ...assistant('msg-1'), surface: 'desktop' })
  expect(await timing(ui)).toContain('Responded 15s · Tools 25s')
  await ui.unmount()
})

test('Desktop streaming block binding survives a later transcript append', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  const streaming = await $.ui.mount({ ...assistant('desktop-api-t0'), surface: 'desktop' })
  await streaming.unmount()
  await $.session.append({
    uuid: 'desktop-row', door: 'response', origin: { kind: 'model', model: 'test' },
    message: {
      id: 'desktop-api', type: 'assistant', role: 'assistant',
      content: [{ type: 'text', text: 'engine answer' }],
    } as any,
  })
  await $.turn.complete(complete(30000))
  const done = await $.ui.mount({ ...assistant('desktop-api-t0'), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})

test('Desktop block first rendered after completion gets timing on its final text block', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.session.append({
    uuid: 'late-row', door: 'response', origin: { kind: 'model', model: 'test' },
    message: {
      id: 'late-api', type: 'assistant', role: 'assistant',
      content: [
        { type: 'text', text: 'intermediate' },
        { type: 'thinking', thinking: 'thinking' },
        { type: 'text', text: 'engine answer' },
      ],
    } as any,
  })
  await $.turn.complete(complete(30000))
  const first = await $.ui.mount({ ...assistant('late-api-t0'), surface: 'desktop' })
  expect(await timing(first)).toBeUndefined()
  await first.unmount()
  const done = await $.ui.mount({ ...assistant('late-api-t1'), surface: 'desktop' })
  expect(await timing(done)).toContain('Worked 30s')
  await done.unmount()
})
