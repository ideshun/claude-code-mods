import type { CoreEngineInterface } from 'claude-code'
import type { TimingRow } from '../types'

type Host = Pick<CoreEngineInterface, 'env' | 'fs' | 'store'>
const LEGACY_PREFIX = 'history-v1:'

export const limitOf = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value
  return typeof parsed === 'number' && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback
}

export const retain = <T>(values: T[], limit: number): T[] => limit === 0 ? values : values.slice(-limit)

const isRow = (row: unknown): row is TimingRow => {
  if (!row || typeof row !== 'object') return false
  const value = row as Partial<TimingRow>
  return typeof value.id === 'string' && typeof value.answer === 'string' && typeof value.text === 'string' &&
    Array.isArray(value.messageIds) && value.messageIds.every(id => typeof id === 'string') &&
    (value.tokens === undefined || typeof value.tokens === 'string')
}

async function directory($: Host) {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = await $.env.get('HOME') ?? await $.env.get('USERPROFILE')
  if (!config && !home) throw new Error('Cannot locate Claude configuration directory')
  return `${config || `${home}/.claude`}/turn-timing/history`
}
const prefix = (sessionId: string) => `${encodeURIComponent(sessionId)}=`
const pathOf = (root: string, sessionId: string, turnId: string) =>
  `${root}/${prefix(sessionId)}${encodeURIComponent(turnId)}.json`

async function files($: Host, root: string) {
  return await $.fs.exists(root)
  ? (await $.fs.list(root)).filter(file => file.kind === 'file' && file.size > 0 && file.name.includes('=') && file.name.endsWith('.json'))
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name))
  : []
}

export async function saveRow($: Host, sessionId: string, row: TimingRow) {
  const root = await directory($)
  // Each read is limited to 4 MiB by the host. Retain timing and IDs even
  // when a single answer is too large for text-based fallback matching.
  let text = JSON.stringify(row)
  if (text.length > 1000000) text = JSON.stringify({ ...row, answer: '' })
  await $.fs.write(pathOf(root, sessionId, row.id), text)
}

export async function pruneHistory($: Host, sessions: number, turns: number, clearSession?: string) {
  const root = await directory($)
  const list = await files($, root)
  const grouped = new Map<string, typeof list>()
  for (const file of list) {
    const id = file.name.slice(0, file.name.indexOf('=') + 1)
    const group = grouped.get(id) ?? []
    group.push(file)
    // Reinsertion orders sessions by their latest write.
    grouped.delete(id)
    grouped.set(id, group)
  }
  const kept = new Set(retain([...grouped.keys()], sessions))
  for (const [id, group] of grouped) {
    const discarded = id === (clearSession === undefined ? undefined : prefix(clearSession)) || !kept.has(id)
      ? group : turns === 0 ? [] : group.slice(0, Math.max(0, group.length - turns))
    // The host exposes write but no unlink. Truncation releases saved contents;
    // empty entries are ignored on subsequent loads and retention passes.
    for (const file of discarded) await $.fs.write(`${root}/${file.name}`, '')
  }
}

export async function loadHistory($: Host, sessionId: string, sessions: number, turns: number) {
  const legacyKey = LEGACY_PREFIX + sessionId
  const legacy = await $.store.get(legacyKey)
  if (Array.isArray(legacy)) {
    const root = await directory($)
    for (const row of legacy.filter(isRow)) {
      if (!await $.fs.exists(pathOf(root, sessionId, row.id))) await saveRow($, sessionId, row)
    }
    await $.store.delete(legacyKey)
  }
  await pruneHistory($, sessions, turns)
  const root = await directory($)
  const list = (await files($, root)).filter(file => file.name.startsWith(prefix(sessionId)))
  const rows: TimingRow[] = []
  for (const file of retain(list, turns)) {
    try {
      const row: unknown = JSON.parse(await $.fs.read(`${root}/${file.name}`))
      if (isRow(row)) rows.push(row)
    } catch {
      // A damaged record does not prevent other completed turns from loading.
    }
  }
  return rows
}

export async function clearHistory($: Host, sessionId: string) {
  await $.store.delete(LEGACY_PREFIX + sessionId)
  await pruneHistory($, 0, 0, sessionId)
}
