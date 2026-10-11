import { expect, mock, test } from 'claude-code/testing'
import { actionPrompt, clean, clipBytes, fold, freshness, history, termMatch, isSourcePath, LIMITS, parent, searchNotes, section } from '../hooks/register.mjs'

const STATE = '# Continuation state\nUpdated: 2026-10-10\n\n## Startup summary\n- Continue the example task.\n\n## Active work\nExample task\n\n## Blockers and pending decisions\nAwaiting evidence\n\n## Next step\nRead the relevant note.'
const NOTE = '# Source preservation\nKeep original sources intact.\nKeywords: source, evidence'
const PANE = {
  plugin: 'selective-wiki-ui', component: 'Pane', requestId: 'selective-wiki-dashboard',
  viewport: { columns: 100, rows: 30 },
  props: { title: 'Selective Wiki', isFocused: true, bodyColumns: 60,
    placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

// All filesystem/model/UI operations are stubs. Tests never touch a real wiki.
function setup(on, options: { missing?: boolean, state?: string, badState?: boolean, hugeState?: boolean, noHook?: boolean, large?: boolean, many?: boolean, unplaced?: boolean } = {}) {
  let state = options.state ?? STATE
  const reads: string[] = [], prompts: string[] = [], writes: string[] = [], opens: string[] = []
  const logs: string[] = [], openRequests: any[] = []
  const clock = mock.clock(on)
  on('session.cwd', () => ({ value: '/work/wiki-project/nested' }))
  on('fs.exists', ($, e) => ({ value: !options.missing && ['/work/wiki-project/state.md', '/work/wiki-project/index.md',
    ...(options.noHook ? [] : ['/work/wiki-project/scripts/session_start.py'])].includes(e.path) }))
  on('fs.stat', ($, e) => ({ value: {
    kind: /\.md$/.test(e.path) ? 'file' : 'dir',
    size: e.path.endsWith('state.md') && options.hugeState ? LIMITS.bytes + 1 :
      e.path.endsWith('state.md') && options.badState ? LIMITS.state + 1 :
      e.path.endsWith('large.md') ? LIMITS.note + 1 : 100,
    mtimeMs: 0, isLink: false,
    realPath: e.path.endsWith('escape.md') ? '/private/escape.md' : e.path,
  } }))
  on('fs.read', ($, e) => {
    reads.push(e.path)
    return { value: e.path.endsWith('state.md') ? state : e.path.endsWith('log.md')
      ? '# Log\n\n## 2026-10-09\nEarlier evidence\n\n## 2026-10-10\nSaved a durable decision' : NOTE }
  })
  on('fs.list', () => ({ value: options.many ? Array.from({ length: 200 }, (_, i) => ({ name: `note-${i}.md`, kind: 'file', size: 100, isLink: false })) : [
    { name: 'sources.md', kind: 'file', size: 100, isLink: false },
    { name: 'escape.md', kind: 'file', size: 100, isLink: false },
    { name: 'linked.md', kind: 'other', size: 100, isLink: true },
    ...(options.large ? [{ name: 'large.md', kind: 'file', size: LIMITS.note + 1, isLink: false }] : []),
  ] }))
  on('fs.write', ($, e) => { writes.push(e.path); return { value: undefined } })
  on('model.complete', () => { throw new Error('Unexpected direct model call') })
  on('prompt.submit', ($, e) => { prompts.push(e.text); return { text: e.text } })
  on('command.register', () => ({ value: undefined }))
  on('ui.open', ($, e) => { opens.push(e.id); openRequests.push(e); return { value: { isPlaced: !options.unplaced || e.focus === true, reason: 'narrow terminal' } } })
  on('ui.log', ($, e) => { logs.push(e.text); return { value: undefined } })
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['host interface'] }))
  on('session.start', () => ({ cwd: '/work/wiki-project/nested' }))
  on('classic.SessionStart', () => ({}))
  on('turn.complete', () => ({ text: '' }))
  return { reads, prompts, writes, opens, logs, openRequests, clock, setState: (value: string) => { state = value } }
}

async function start($, interactive = true) {
  await $.session.start({ cwd: '/work/wiki-project/nested', isInteractive: interactive, surface: interactive ? 'terminal' : null })
}

test('sections stop at the next heading and handle absent fields', () => {
  expect(section(STATE, 'active work')).toBe('Example task')
  expect(section(STATE, 'unknown')).toBe('Not recorded.')
})

test('display text removes terminal escapes and enforces caps', () => {
  expect(clean('\x1b[31mhello\x1b[0m\x00\x07')).toBe('hello')
  expect(clean('abcdefgh', 3)).toBe('abc')
})

test('freshness reports age without inventing live verification', () => {
  expect(freshness(STATE, Date.parse('2026-10-11T12:00:00Z')).label).toContain('1 day(s)')
  expect(freshness(STATE).label).toContain('verification unknown')
  expect(freshness('Updated: not initialized').label).toContain('Undated')
  expect(freshness('Updated: 2026-02-30').label).toContain('Undated')
  expect(freshness('Updated: 2099-01-01', 0).label).toContain('Future')
})

test('history retains multiline dated entries newest first with a cap', () => {
  const records = Array.from({ length: 8 }, (_, i) => `## 2026-10-0${i + 1}\nChange ${i}\nEvidence`).join('\n\n')
  const recent = history(`# Log\n\n${records}`)
  expect(recent.length).toBe(5)
  expect(recent[0]).toContain('Change 7\nEvidence')
})

test('root parent reaches filesystem root', () => {
  expect(parent('/work/nested/')).toBe('/work')
  expect(parent('/work')).toBe('/')
  expect(parent('/')).toBe('/')
})

test('research requires a question and only conversation save authorizes writing', () => {
  expect(() => actionPrompt('research', '/work', '')).toThrow()
  expect(actionPrompt('research', '/work', 'source')).toContain('read-only')
  expect(actionPrompt('audit', '/work')).toContain('report mode; no repairs')
  expect(actionPrompt('save', '/work')).toContain('conversation mode')
})

test('each action loads only its own project skill and stops if the skill is missing', () => {
  for (const [action, skill] of [['research', 'query'], ['audit', 'lint'], ['save', 'ingest']]) {
    const prompt = actionPrompt(action, '/work/project with spaces', 'evidence');
    expect(prompt).toContain(JSON.stringify(`/work/project with spaces/.claude/skills/${skill}/SKILL.md`));
    expect(prompt).toContain('if not already loaded');
    expect(prompt).toContain('If the skill is missing, report it and stop without writing');
    for (const other of ['query', 'lint', 'ingest'].filter(name => name !== skill)) {
      expect(prompt.includes(`/skills/${other}/SKILL.md`)).toBe(false);
    }
  }
})

test('action messages keep instructions in skills instead of repeating workflow details', () => {
  for (const kind of ['save', 'audit', 'research']) {
    const prompt = actionPrompt(kind, '/work', 'topic');
    expect(prompt.length < 430).toBe(true);
    expect(prompt.includes('wiki-reader')).toBe(false);
    expect(prompt.includes('wiki-auditor')).toBe(false);
    expect(prompt.includes('Startup summary')).toBe(false);
  }
})

test('audit preserves note, topic and default scopes while remaining report-only', () => {
  const root = '/work/wiki-project';
  expect(actionPrompt('audit', root, '', 'wiki/decision.md')).toContain('Selected note: "wiki/decision.md"');
  expect(actionPrompt('audit', root, 'Redis')).toContain('User scope/question: "Redis"');
  const both = actionPrompt('audit', root, 'Redis', 'wiki/decision.md');
  expect(both).toContain('Selected note: "wiki/decision.md"');
  expect(both).toContain('User scope/question: "Redis"');
  expect(actionPrompt('audit', root)).toContain('current continuation and relevant notes');
  expect(actionPrompt('audit', root, 'fix everything')).toContain('report mode; no repairs');
  expect(both).toContain('report mode; no repairs');
})

test('startup discovers nested wiki and reads only state and log', async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.reads).toEqual(['/work/wiki-project/state.md', '/work/wiki-project/log.md'])
  expect(s.opens).toEqual(['selective-wiki-dashboard'])
  expect(s.prompts).toEqual([])
  expect(s.writes).toEqual([])
})

test('headless startup opens no UI and status has a text fallback', async ($, on) => {
  const s = setup(on)
  await start($, false)
  const answer = await $.command.run({ command: 'wiki-status' })
  expect(answer.text).toContain('Example task')
  expect(s.opens).toEqual([])
  expect(s.prompts).toEqual([])
})

test('missing wiki is a useful empty state and launches no action', async ($, on) => {
  const s = setup(on, { missing: true })
  await start($, false)
  const answer = await $.command.run({ command: 'wiki-status' })
  expect(answer.text).toContain('No wiki found')
  expect(s.reads).toEqual([])
  expect(s.opens).toEqual([])
})

test('oversized state is clipped with a visible warning, absurd size fails without reading', async ($, on) => {
  const s = setup(on, { badState: true })
  await start($, false)
  const answer = (await $.command.run({ command: 'wiki-status' })).text
  expect(answer).toContain('only its beginning is shown')
  expect(answer).toContain('Continue the example task.')
})

test('absurdly large state fails visibly without reading the file', async ($, on) => {
  const s = setup(on, { hugeState: true })
  await start($, false)
  expect((await $.command.run({ command: 'wiki-status' })).text).toContain('exceeds')
  expect(s.reads).toEqual([])
})

test('log order, byte clipping and Turkish-aware matching', () => {
  const rows = Array.from({ length: 7 }, (_, i) => `## 2026-10-0${i + 1}\nChange ${i}`)
  expect(history([...rows].reverse().join('\n'))[0]).toContain('Change 6')
  expect(clipBytes('ab猫c', 4, true)).toBe('猫c')
  expect(fold('İstanbul')).toBe('istanbul')
  expect(termMatch('kararlarimiz', fold('karar notu'), new Set(['karar', 'notu']))).toBe('stem')
})

test('terminal and desktop controls render and refresh without model calls', async ($, on) => {
  const s = setup(on)
  await start($)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'Example task' })).toBeDefined()
    await ui.press({ key: 'tab-history' })
    expect(await ui.find({ type: 'Text', text: /Saved a durable decision/ })).toBeDefined()
    await ui.press({ key: 'refresh' })
    await ui.press({ key: 'tab-state' })
    await ui.unmount()
  }
  expect(s.prompts).toEqual([])
  expect(s.writes).toEqual([])
})

test('search excludes symlinks, escaped paths and oversized notes', async ($, on) => {
  const s = setup(on, { large: true })
  await start($, false)
  const answer = await $.command.run({ command: 'wiki-search', args: 'source evidence' })
  expect(answer.text).toContain('wiki/sources.md')
  expect(answer.text).not.toContain('wiki/escape.md:')
  expect(s.reads.filter(path => path.endsWith('escape.md') || path.endsWith('large.md') || path.endsWith('linked.md'))).toEqual([])
  expect(s.prompts).toEqual([])
})

test('large archive scan stops at bounded note count and reports truncation', async ($, on) => {
  const s = setup(on, { many: true })
  await start($, false)
  const answer = await $.command.run({ command: 'wiki-search', args: 'source' })
  expect(answer.text).toContain('Scan limit reached')
  expect(s.reads.filter(path => path.includes('/wiki/')).length).toBe(LIMITS.files)
})

test('selecting a search result previews it locally', async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-search' })
  await ui.input({ key: 'search', text: 'source' })
  await ui.press({ key: 'note-wiki/sources.md' })
  expect(await ui.find({ type: 'Text', text: 'Selected: wiki/sources.md' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Keep original sources intact/ })).toBeDefined()
  expect(s.prompts).toEqual([])
})

test('main turn refreshes state while subagent completion does not', async ($, on) => {
  const s = setup(on)
  await start($)
  s.setState(STATE.replace('Example task', 'Completed task'))
  await $.turn.complete({ turnId: 'worker', agentId: 'reader', answer: '', durationMs: 0, isAborted: false, usage: null })
  expect(s.reads.length).toBe(2)
  await $.turn.complete({ turnId: 'main', answer: '', durationMs: 0, isAborted: false, usage: null })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Completed task' })).toBeDefined()
  expect(s.prompts).toEqual([])
})

test('clear refreshes continuation with no autonomous model request', async ($, on) => {
  const s = setup(on)
  await start($)
  s.setState(STATE.replace('Example task', 'New task'))
  await $.classic.SessionStart({ source: 'clear' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'New task' })).toBeDefined()
  expect(s.prompts).toEqual([])
})

test('explicit research button queues exactly one scoped prompt', async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-search' })
  await ui.input({ key: 'scope', text: 'What preserves sources?' })
  await ui.press({ key: 'research' })
  await ui.press({ key: 'research' })
  expect(s.prompts).toEqual([])
  await s.clock.settle()
  expect(s.prompts.length).toBe(1)
  expect(s.prompts[0]).toContain('/skills/query/SKILL.md')
  expect(s.prompts[0]).toContain('What preserves sources?')
  expect(s.writes).toEqual([])
})

test('audit and save buttons delegate to the main agent without direct writes', async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-history' })
  await ui.press({ key: 'audit' }); await s.clock.settle()
  await ui.press({ key: 'tab-state' })
  await ui.press({ key: 'save' }); await s.clock.settle()
  expect(s.prompts.length).toBe(2)
  expect(s.prompts[0]).toContain('report mode; no repairs')
  expect(s.prompts[1]).toContain('conversation mode')
  expect(s.writes).toEqual([])
})

test('empty research scope starts no turn', async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-search' })
  await ui.press({ key: 'research' }); await s.clock.settle()
  expect(s.prompts).toEqual([])
})

test('band preserves the host UI and offers a local toggle', async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await $.ui.mount({ plugin: 'selective-wiki-ui', component: 'AbovePrompt', requestId: 'band', surface: 'terminal',
    props: { hasSurvey: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} } })
  expect(await ui.find({ type: 'Text', text: 'host interface' })).toBeDefined()
  await ui.press({ key: 'open-wiki' })
  expect(s.prompts).toEqual([])
})

test('programmatic command calls cannot trigger a paid action', async ($, on) => {
  const s = setup(on)
  await start($)
  const answer = await $.command.run({ command: 'wiki-research', args: 'source preservation', origin: { kind: 'plugin', name: 'other-mod' } })
  expect(answer.text).toContain('explicitly by the user')
  await s.clock.settle()
  expect(s.prompts).toEqual([])
})

test('user research command submits its scope once outside the hook', async ($, on) => {
  const s = setup(on)
  await start($)
  await $.command.run({ command: 'wiki-research', args: 'source preservation', origin: { kind: 'composer' } })
  expect(s.prompts).toEqual([])
  await s.clock.settle()
  expect(s.prompts.length).toBe(1)
  expect(s.prompts[0]).toContain('source preservation')
  expect(s.writes).toEqual([])
})

test('unplaced startup gives a visible local instruction and command opens a focused pane', async ($, on) => {
  const s = setup(on, { unplaced: true })
  await start($)
  expect(s.logs[0]).toContain('/wiki-status')
  expect(s.openRequests[0].focus).toBeUndefined()
  await $.command.run({ command: 'wiki-status' })
  expect(s.openRequests[1].focus).toBe(true)
  expect(s.openRequests[1].rows).toBe(18)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Example task' })).toBeDefined()
  expect(s.prompts).toEqual([])
})


test('without the startup hook the mod shows the summary and says why', async ($, on) => {
  const s = setup(on, { noHook: true })
  await start($)
  expect(s.logs[0]).toContain('Continue the example task.')
  expect(s.logs[0]).toContain('Startup hook not found')
  const answer = (await $.command.run({ command: 'wiki-status' })).text
  expect(answer ?? '').not.toContain('undefined')
})

test('memory save ignores selected notes and stale search questions', () => {
  const prompt = actionPrompt('save', '/work', 'what is this?', 'wiki/example.md')
  expect(prompt).not.toContain('what is this?')
  expect(prompt).not.toContain('wiki/example.md')
  expect(prompt).toContain('Save conversation memory (conversation mode)')
  expect(prompt).toContain('/skills/ingest/SKILL.md')
})

test('actions belong to their tabs and save works without a search', async ($, on) => {
  const s = setup(on)
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'scope' })).toBeUndefined()
  expect(await ui.find({ key: 'research' })).toBeUndefined()
  expect(await ui.find({ key: 'save' })).toBeDefined()
  await ui.press({ key: 'save' }); await s.clock.settle()
  expect(s.prompts[0]).toContain('Save conversation memory (conversation mode)')
  await ui.press({ key: 'tab-search' })
  expect(await ui.find({ key: 'save' })).toBeUndefined()
  expect(await ui.find({ key: 'research' })).toBeDefined()
})


test('source prompts require a raw/docs file and keep source intake distinct from conversation save', () => {
  for (const path of ['', '/raw/a.md', 'wiki/a.md', 'raw/../a.md', 'raw//a.md', 'docs/./a.md', 'raw/a\\b.md']) {
    expect(isSourcePath(path)).toBe(false)
    expect(() => actionPrompt('ingest', '/work', '', path)).toThrow()
  }
  const prompt = actionPrompt('ingest', '/work', 'Only Redis decisions', 'docs/vendor.md')
  expect(prompt).toContain('supplied-source mode')
  expect(prompt).toContain('/skills/ingest/SKILL.md')
  expect(prompt).toContain('docs/vendor.md')
  expect(prompt).toContain('Only Redis decisions')
  expect(prompt.includes('conversation mode')).toBe(false)
})

test('sources filter waits for a search, hides wiki actions and queues only explicit ingest', async ($, on) => {
  const s = setup(on)
  await start($)
  expect(s.reads.filter(path => /\/(raw|docs)\//.test(path))).toEqual([])
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'tab-search' })
  await ui.press({ key: 'filter-sources' })
  expect(s.reads.filter(path => /\/(raw|docs)\//.test(path))).toEqual([])
  expect(await ui.find({ key: 'note-raw/sources.md' })).toBeUndefined()
  await $.command.run({ command: 'wiki-sources', args: 'source' })
  expect(await ui.find({ key: 'ingest' })).toBeUndefined()
  expect(await ui.find({ key: 'research' })).toBeUndefined()
  expect(await ui.find({ key: 'audit' })).toBeUndefined()
  await ui.press({ key: 'note-raw/sources.md' })
  expect(s.prompts).toEqual([])
  await ui.input({ key: 'source-scope', text: 'Only Redis decisions' })
  await ui.press({ key: 'ingest' })
  await ui.press({ key: 'ingest' })
  await s.clock.settle()
  expect(s.prompts.length).toBe(1)
  expect(s.prompts[0]).toContain('Source: "raw/sources.md"')
  expect(s.prompts[0]).toContain('Only Redis decisions')
  expect(s.writes).toEqual([])
  await ui.press({ key: 'tab-state' })
  await ui.press({ key: 'save' }); await s.clock.settle()
  expect(s.prompts[1].includes('raw/sources.md')).toBe(false)
  await ui.press({ key: 'tab-search' })
  await ui.press({ key: 'filter-wiki' })
  expect(await ui.find({ key: 'ingest' })).toBeUndefined()
  expect(await ui.find({ key: 'research' })).toBeDefined()
})

test('large sources remain discoverable by filename without loading their contents', async ($, on) => {
  const s = setup(on, { large: true })
  await start($, false)
  const result = await $.command.run({ command: 'wiki-sources', args: 'large' })
  expect(result.text).toContain('docs/large.md')
  expect(result.text).toContain('raw/large.md')
  expect(s.reads.filter(path => path.endsWith('large.md') || path.endsWith('escape.md'))).toEqual([])
  expect(s.prompts).toEqual([])
})


test('empty source searches show no list or count and perform no reads', async ($, on) => {
  const s = setup(on)
  const result = await searchNotes($, '/work/wiki-project', '   ', 'sources')
  expect(result).toEqual({ results: [], message: '' })
  expect(s.reads).toEqual([])
})
