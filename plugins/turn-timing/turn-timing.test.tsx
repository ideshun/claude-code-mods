import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const turn = { text: 'hello', turnId: 'turn-1' } as const

const complete = (durationMs: number, turnId = 'turn-1') => ({
  ...turn,
  turnId,
  answer: '',
  durationMs,
  isAborted: false,
  reason: 'answer' as const,
})

const placed = (id: string) => ({
  plugin: 'turn-timing',
  component: 'Placed',
  requestId: id,
  props: { id, plugin: 'turn-timing' },
} as const)

const bottom = (on: Parameters<TestBody>[1], locale = 'en_US.UTF-8') => {
  mock.clock(on)
  mock.env(on, { LANG: locale })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.place', () => ({ value: { isPlaced: true, requestId: 'ignored' } }))
  on('tool.call', () => ({ result: {} }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e as never)
    return <Text>engine</Text>
  })
}

const text = async (ui: any) => (await ui.find({ type: 'Text' }))?.text

const mount = ($: any, id: string) => $.ui.mount({ ...placed(id), surface: 'desktop' })

test('one placed row per reply, with independent values', async ($, on) => {
  bottom(on)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await $.turn.complete(complete(90000))

  await $.turn.start({ ...turn, turnId: 'turn-2' })
  await $.turn.complete(complete(20000, 'turn-2'))

  const first = await mount($, 'turn-turn-1')
  expect(await text(first)).toContain('Worked 1m30s')
  expect(await text(first)).not.toContain('Worked 20s')
  await first.unmount()

  const second = await mount($, 'turn-turn-2')
  expect(await text(second)).toContain('Worked 20s')
  expect(await text(second)).not.toContain('Worked 1m30s')
  await second.unmount()
})

test('no timing row is placed while a reply is running', async ($, on) => {
  let places = 0
  mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.place', () => {
    places += 1
    return { value: { isPlaced: true, requestId: 'ignored' } }
  })
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(places).toBe(0)
  await $.turn.complete(complete(30000))
  expect(places).toBe(1)
})

test('auto follows an English host locale', async ($, on) => {
  bottom(on, 'en_US.UTF-8')
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.turn.complete(complete(30000))
  const ui = await mount($, 'turn-turn-1')
  expect(await text(ui)).toContain('Worked 30s')
  await ui.unmount()
})

test('Chinese language labels are used', { options: { language: '中文' } }, async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.turn.complete(complete(30000))
  const ui = await mount($, 'turn-turn-1')
  expect(await text(ui)).toContain('工作 30s')
  await ui.unmount()
})

test('timing estimates split a 90s reply', async ($, on) => {
  const clock = mock.clock(on)
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('ui.place', () => ({ value: { isPlaced: true, requestId: 'ignored' } }))
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
  const step = $.turn.step({ turnId: 'turn-1', index: 0, model: 'test', messageCount: 1 })
  const draining = (async () => { for await (const _ of step) void _ })()
  const tool = $.tool.call({ tool: 'Bash', command: 'sleep 1' })
  await Promise.all([draining, clock.set(30000), clock.set(90000), tool])
  await $.turn.complete(complete(90000))

  const ui = await mount($, 'turn-turn-1')
  expect(await text(ui)).toContain('Worked 1m30s · Thought 20s · Responded 10s · Tools 1m')
  await ui.unmount()
})

test('custom prefix and labels override built-in language', { options: {
  language: 'Custom', prefix: '⏱', totalLabel: 'Total', thinkingLabel: 'Think', respondingLabel: 'Reply', toolsLabel: 'Tools',
} }, async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.turn.complete(complete(30000))
  const ui = await mount($, 'turn-turn-1')
  expect(await text(ui)).toContain('⏱ Total 30s · Think 0s · Reply 30s · Tools 0s')
  await ui.unmount()
})

test('interrupted replies report elapsed time', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start(turn)
  await $.turn.complete({ ...complete(12000), isAborted: true, reason: 'aborted' })
  const ui = await mount($, 'turn-turn-1')
  expect(await text(ui)).toContain('Worked 12s')
  await ui.unmount()
})

test('subagent turns are ignored', async ($, on) => {
  bottom(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.complete({ ...complete(5000), agentId: 'agent-1' })
  const ui = await mount($, 'turn-turn-1')
  expect(await text(ui)).not.toContain('Worked')
  await ui.unmount()
})
