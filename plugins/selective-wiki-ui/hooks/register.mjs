// Runtime-independent parsing and bounded filesystem access. No Node imports.
export const LIMITS = Object.freeze({ state: 16000, log: 32000, note: 24000,
  files: 160, directories: 80, depth: 6, bytes: 512000, results: 12, query: 500 });

export function clean(value, limit = 4000) {
  return String(value ?? '').replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '').slice(0, limit);
}

const byteWidth = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };
export function utf8Length(text) { let n = 0; for (const ch of String(text)) n += byteWidth(ch); return n; }
// Clip by UTF-8 bytes (not characters); keep the start, or the end for chronological logs.
export function clipBytes(text, maxBytes, fromEnd = false) {
  const chars = Array.from(String(text));
  if (fromEnd) chars.reverse();
  let used = 0, kept = 0;
  for (const ch of chars) { const w = byteWidth(ch); if (used + w > maxBytes) break; used += w; kept++; }
  const part = chars.slice(0, kept);
  return (fromEnd ? part.reverse() : part).join('');
}

// Case-, diacritic- and Turkish dotted/dotless-i-insensitive form used only for matching.
export function fold(text) {
  return String(text ?? '').replace(/[ıİ]/g, 'i').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
const WORD = /[\p{L}\p{N}]+/gu;
const wordSet = folded => new Set(folded.match(WORD) ?? []);
// A term matches by substring, or as an inflected form of a word present in the text
// (the text holds the root, the query adds up to 10 suffix characters; roots of 4+ chars).
export function termMatch(term, folded, words) {
  if (folded.includes(term)) return 'exact';
  for (let length = term.length - 1; length >= Math.max(4, term.length - 10); length--)
    if (words.has(term.slice(0, length))) return 'stem';
  return '';
}

export function section(text, title) {
  const lines = clean(text, LIMITS.log).split('\n');
  const start = lines.findIndex(line => line.trim().toLowerCase() === `## ${title}`.toLowerCase());
  if (start < 0) return 'Not recorded.';
  let end = start + 1;
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end++;
  return lines.slice(start + 1, end).join('\n').trim() || 'Not recorded.';
}

export function freshness(text, now = Date.now()) {
  const recorded = /^Updated:\s*(.*)$/mi.exec(text)?.[1]?.trim() || 'Not recorded';
  const date = /\b(\d{4}-\d{2}-\d{2})\b/.exec(recorded)?.[1];
  const parsed = date && Date.parse(`${date}T00:00:00Z`);
  const stamp = Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date ? parsed : NaN;
  if (!Number.isFinite(stamp)) return { recorded, label: 'Undated — verification unknown' };
  // Stored dates are calendar dates; compare against the local calendar day.
  const current = new Date(now);
  const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  const age = Math.round((today - stamp) / 86400000);
  if (age < 0) return { recorded, label: 'Future date — check the record' };
  return { recorded, label: `${age} day(s) since record — live verification unknown` };
}

export function history(text) {
  // Accept dated headings or single-line entries; retain multiline entries.
  // Order by date so oldest-first and newest-first logs both show the newest five.
  const blocks = clean(text, LIMITS.log).split(/\n(?=(?:#{1,3}\s+|[-*]\s+)?\d{4}-\d{2}-\d{2}\b)/);
  const entries = blocks.map((block, index) => ({ block: block.trim(), index }))
    .map(entry => ({ ...entry, date: /^(?:#{1,3}\s+|[-*]\s+)?(\d{4}-\d{2}-\d{2})\b/.exec(entry.block)?.[1] }))
    .filter(entry => entry.date);
  if (!entries.length) return [];
  const newestFirst = entries[0].date > entries[entries.length - 1].date;
  entries.sort((a, b) => a.date === b.date ? (newestFirst ? 1 : -1) * (a.index - b.index) : a.date < b.date ? 1 : -1);
  return entries.slice(0, 5).map(entry => clean(entry.block, 800));
}

export function parent(path) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const end = normalized.lastIndexOf('/');
  return end <= 0 ? '/' : normalized.slice(0, end);
}

const join = (root, relative) => `${root.replace(/\/+$/, '')}/${relative}`;
export const inside = (root, path) => path === root || path.startsWith(`${root.replace(/\/+$/, '')}/`);

export async function findRoot($, cwd) {
  let candidate = cwd;
  for (let i = 0; i < 24; i++) {
    if (await $.fs.exists(join(candidate, 'state.md')) && await $.fs.exists(join(candidate, 'index.md'))) {
      const info = await $.fs.stat(candidate, { resolve: true });
      if (!info.realPath || info.kind !== 'dir') throw new Error('Cannot resolve wiki root.');
      return info.realPath;
    }
    const up = parent(candidate);
    if (up === candidate) break;
    candidate = up;
  }
  return null;
}

async function localFile($, root, relative) {
  if (!relative || relative.startsWith('/') || relative.split(/[\\/]/).some(p => p === '..' || p === '.'))
    throw new Error('Invalid relative note path.');
  const path = join(root, relative);
  const info = await $.fs.stat(path, { resolve: true });
  if (info.kind !== 'file' || !info.realPath || !inside(root, info.realPath))
    throw new Error(`File is outside the wiki or unavailable: ${relative}`);
  return { path, info };
}

export async function readLocal($, root, relative, maxBytes) {
  const { path, info } = await localFile($, root, relative);
  if (info.size > maxBytes) throw new Error(`File exceeds ${maxBytes} bytes: ${relative}`);
  return clean(await $.fs.read(path), maxBytes);
}

// Continuation records degrade instead of failing: an oversized file is clipped by bytes
// (head for state, tail for the chronological log) and the caller is told it was clipped.
export async function readBounded($, root, relative, maxBytes, fromEnd = false) {
  const { path, info } = await localFile($, root, relative);
  if (info.size > LIMITS.bytes) throw new Error(`File exceeds ${LIMITS.bytes} bytes: ${relative}`);
  const text = await $.fs.read(path);
  const truncated = info.size > maxBytes || utf8Length(text) > maxBytes;
  return { text: clean(truncated ? clipBytes(text, maxBytes, fromEnd) : text, maxBytes), truncated };
}

export async function snapshot($, root) {
  const state = await readBounded($, root, 'state.md', LIMITS.state);
  const warnings = [];
  if (state.truncated) warnings.push(`state.md exceeds ${LIMITS.state} bytes; only its beginning is shown. Shorten it (aim for 200–400 words).`);
  let changes = [], warning = '', hook = false;
  try {
    const log = await readBounded($, root, 'log.md', LIMITS.log, true);
    changes = history(log.text);
    if (log.truncated) warning = `log.md exceeds ${LIMITS.log} bytes; only its most recent part was scanned.`;
  } catch (error) { warning = clean(error.message, 200); }
  try { hook = await $.fs.exists(join(root, 'scripts/session_start.py')); } catch { hook = false; }
  return { summary: section(state.text, 'Startup summary'), active: section(state.text, 'Active work'),
    blockers: section(state.text, 'Blockers and pending decisions'), next: section(state.text, 'Next step'),
    freshness: freshness(state.text), changes, warning, stateWarning: warnings.join(' '), hook };
}

export const HOOK_NOTICE = 'Startup hook not found (scripts/session_start.py): this workspace summary is not injected into new sessions. See SETUP.md.';

export function isSourcePath(path) {
  return typeof path === 'string' && path.length <= 500 && /^(raw|docs)\//.test(path)
    && !/[\\\x00-\x1f\x7f]/.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..');
}

export async function sourceInfo($, root, relative) {
  if (!isSourcePath(relative)) throw new Error('Select a file inside raw/ or docs/.');
  const info = await $.fs.stat(join(root, relative), { resolve: true });
  const folder = join(root, relative.split('/')[0]);
  if (info.kind !== 'file' || info.isLink || !info.realPath || !inside(folder, info.realPath))
    throw new Error('Source is unavailable or outside raw/ or docs/.');
  return info;
}

export async function searchNotes($, root, query, mode = 'wiki') {
  const sources = mode === 'sources';
  const terms = fold(clean(query, LIMITS.query)).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return { results: [], message: sources ? '' : 'Enter words to search local wiki notes.' };
  const queue = (sources ? ['raw', 'docs'] : ['wiki']).map(path => ({ path, depth: 0 })), matches = [];
  let files = 0, directories = 0, bytes = 0, skipped = 0, capped = false;
  while (queue.length && files < LIMITS.files && directories < LIMITS.directories) {
    const current = queue.shift();
    const directory = join(root, current.path);
    let entries;
    try {
      const info = await $.fs.stat(directory, { resolve: true });
      if (!info.realPath || !inside(root, info.realPath) || info.isLink) { skipped++; continue; }
      entries = await $.fs.list(directory);
    } catch { skipped++; continue; }
    directories++;
    for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isLink || !entry.name || /[\\/\x00-\x1f]/.test(entry.name) || entry.name.startsWith('.')) { skipped++; continue; }
      const path = `${current.path}/${entry.name}`;
      if (entry.kind === 'dir') {
        if (current.depth < LIMITS.depth) queue.push({ path, depth: current.depth + 1 });
        else capped = true;
      } else if (entry.kind === 'file' && (sources || /\.md$/i.test(entry.name))) {
        if (files >= LIMITS.files) { capped = true; continue; }
        files++;
        let text = '';
        const readable = !sources || /\.(md|txt|rst|csv|json|ya?ml|html?)$/i.test(entry.name);
        try {
          if (sources) await sourceInfo($, root, path);
          if (readable && entry.size <= LIMITS.note && bytes + entry.size <= LIMITS.bytes) {
            text = await readLocal($, root, path, LIMITS.note); bytes += entry.size;
          } else if (!sources) { skipped++; capped ||= bytes + entry.size > LIMITS.bytes; continue; }
          else if (readable) capped = true;
        } catch { skipped++; continue; }
        const title = /^#\s+(.+)$/m.exec(text)?.[1] || entry.name;
        const haystack = fold(`${path}\n${title}\n${text}`), words = wordSet(haystack);
        const kinds = terms.map(term => termMatch(term, haystack, words));
        if (kinds.some(kind => !kind)) continue;
        const lines = text.split('\n');
        const hit = lines.findIndex(line => { const f = fold(line), w = wordSet(f); return terms.some(term => termMatch(term, f, w)); });
        const foldedTitle = fold(title), foldedPath = fold(path);
        const score = terms.reduce((n, term, i) => n + (kinds[i] === 'exact' ? 3 : 0)
          + (foldedTitle.includes(term) ? 5 : 0) + (foldedPath.includes(term) ? 2 : 0), 0);
        matches.push({ path, title: clean(title, 160), line: Math.max(1, hit + 1),
          excerpt: text ? clean(lines.slice(Math.max(0, hit), Math.max(0, hit) + 3).join('\n'), 320) : 'Listed by filename; content not searched.', score });
      }
    }
  }
  capped ||= queue.length > 0;
  const results = matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, LIMITS.results);
  return { results, message: `${files} ${sources ? 'source files' : 'notes'} scanned; ${results.length} shown.${capped ? (sources ? ' Scan/content limit reached; narrow by filename.' : ' Scan limit reached; narrow the topic or use Research.') : ''}${skipped ? ` ${skipped} unavailable, large or excluded entries skipped.` : ''}` };
}

export function actionPrompt(kind, root, scope = '', selected = '') {
  if (!['research', 'audit', 'save', 'ingest'].includes(kind)) throw new Error('Unknown wiki action.');
  const topic = clean(scope, LIMITS.query).trim();
  if (kind === 'research' && !topic) throw new Error('Enter a research question first.');
  if (kind === 'ingest' && !isSourcePath(selected)) throw new Error('Select a source from raw/ or docs/ first.');
  const skill = ['save', 'ingest'].includes(kind) ? 'ingest' : kind === 'research' ? 'query' : 'lint';
  const workflow = `Use the project ${skill} skill at ${JSON.stringify(`${root}/.claude/skills/${skill}/SKILL.md`)} if not already loaded; follow the project CLAUDE.md. If the skill is missing, report it and stop without writing.`;
  if (kind === 'save') return `Save conversation memory (conversation mode). ${workflow}`;
  if (kind === 'ingest') return `Ingest source (supplied-source mode). ${workflow} Source: ${JSON.stringify(selected)}. Scope: ${JSON.stringify(topic || 'useful durable project information')}.`;
  const location = `Selected note: ${JSON.stringify(selected || 'none')}. User scope/question: ${JSON.stringify(topic || 'current continuation and relevant notes')}.`;
  return `${kind === 'research' ? 'Research local wiki (read-only)' : 'Audit wiki (report mode; no repairs)'}. ${workflow} ${location}`;

}


const PANE = 'selective-wiki-dashboard';
const COMMANDS = [
  ['wiki-status', 'Open the continuation dashboard (local, no model call)', ''],
  ['wiki-refresh', 'Refresh saved state and history (local)', ''],
  ['wiki-toggle', 'Show or hide the dashboard (local)', ''],
  ['wiki-search', 'Search local wiki notes without a model call', '<words>'],
  ['wiki-research', 'Research local notes with Claude', '<question>'],
  ['wiki-audit', 'Audit relevant wiki notes with Claude', '[scope]'],
  ['wiki-save', 'Save meaningful memory from this conversation', ''],
  ['wiki-sources', 'Search raw/ and docs/ source files locally', '<words>'],
];

let root = null, data = null, error = '', tab = 'state', query = '', selected = '', preview = '';
let results = [], searchMessage = 'Enter words to search local wiki notes.', opened = false;
let searchMode = 'wiki', actionScope = '';
let interactive = false, busy = false, pending = false, searchGeneration = 0;

const redraw = $ => $.ui.invalidate('ui.render');
const report = ($, failure) => {
  error = clean(failure?.message || failure, 300);
  $.ui.toast(error);
  redraw($);
};
const refresh = async $ => {
  // Serialize reads, and erase old data on failure instead of showing it as current.
  if (busy) return;
  busy = true;
  try {
    const previousRoot = root;
    root = await findRoot($, await $.session.cwd());
    if (root !== previousRoot) { searchGeneration++; results = []; selected = ''; preview = ''; }
    data = root ? await snapshot($, root) : null;
    error = root ? '' : 'No wiki found. This project needs state.md and index.md.';
  } catch (failure) { data = null; error = clean(failure.message, 300); }
  finally { busy = false; redraw($); }
};
const open = async ($, focus = false) => {
  if (!interactive) return;
  const pane = { id: PANE, title: 'Selective Wiki', closeOnEscape: true, rows: 18 };
  const placement = await $.ui.open(focus ? { ...pane, focus: true } : pane);
  opened = placement.isPlaced;
  if (!opened) $.ui.log('Wiki ready. Open the dashboard with /wiki-status or Open wiki; automatic panes wait for a wider terminal.');
};
const search = async ($, value) => {
  query = clean(value, LIMITS.query);
  selected = ''; preview = '';
  const generation = ++searchGeneration;
  if (!root) { results = []; searchMessage = error || 'No wiki found.'; redraw($); return; }
  try {
    const answer = await searchNotes($, root, query, searchMode);
    if (generation !== searchGeneration) return;
    results = answer.results; searchMessage = answer.message;
  } catch (failure) { if (generation === searchGeneration) report($, failure); }
  redraw($);
};
const launch = ($, kind, scope) => {
  if (!root || !data) { report($, new Error(error || 'Refresh the wiki first.')); return; }
  if (pending) { $.ui.toast('A wiki action is already queued.'); return; }
  let text;
  try { text = actionPrompt(kind, root, kind === 'save' ? '' : scope, kind === 'save' || (kind === 'audit' && searchMode === 'sources') ? '' : selected); }
  catch (failure) { report($, failure); return; }
  const targetRoot = root, source = selected;
  pending = true;
  $.ui.toast('Wiki action queued.');
  // Outside the command/render callback: never await an idle turn inside a hook.
  $.clock.after(0, async () => {
    try {
      if (kind === 'ingest') {
        if (root !== targetRoot) throw new Error('Wiki changed; select the source again.');
        await sourceInfo($, targetRoot, source);
      }
      await $.prompt.submit({ text });
    }
    catch (failure) { report($, failure); }
    finally { pending = false; redraw($); }
  });
};
const notices = () => data ? [data.stateWarning, data.hook ? '' : HOOK_NOTICE].filter(Boolean).join('\n') : '';
const statusText = () => data ? clean(`Selective Wiki\nRecorded: ${data.freshness.recorded}\n${data.freshness.label}\n\n${data.summary}\n\nActive: ${data.active}\nBlockers: ${data.blockers}\nNext: ${data.next}${notices() ? `\n\n${notices()}` : ''}`, 2800) : error;

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      interactive = e.isInteractive && ['terminal', 'desktop'].includes(e.surface);
      for (const [name, description, argumentHint] of COMMANDS) {
        await $.command.register({ name, description, argumentHint, immediate: true });
      }
      await refresh($);
      if (root && data) {
        // Without the project's SessionStart hook nothing else displays the summary.
        if (!data.hook) $.ui.log(`Session summary — state.md\n${data.summary}\n${HOOK_NOTICE}`);
        await open($);
      }
    } catch (failure) {
      // A host API change must not break the session; Markdown memory and hook keep working.
      try { $.ui.log(`Selective Wiki panel unavailable: ${clean(failure?.message || failure, 200)}. Memory files and startup hook are unaffected.`); } catch { /* ignore */ }
    }
    return next(e);
  });

  on('classic.SessionStart', async ($, e, next) => {
    if (!e.agent_id && ['clear', 'resume', 'fork', 'compact'].includes(e.source)) {
      searchGeneration++; results = []; selected = ''; preview = '';
      await refresh($);
      if (opened) await open($);
    }
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    // Main turn only: two small local files, no archive scan and no model call.
    if (!e.agentId) await refresh($);
    return next(e);
  });

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) opened = false;
    return next(e);
  });

  for (const [command] of COMMANDS) {
    on('command.run', { command }, async ($, e) => {
      try {
        if (!root || command === 'wiki-refresh' || command === 'wiki-status') await refresh($);
        if (command === 'wiki-toggle') {
          if (opened) { await $.ui.close({ id: PANE }); opened = false; }
          else await open($, true);
        } else if (command === 'wiki-search' || command === 'wiki-sources') {
          searchMode = command === 'wiki-sources' ? 'sources' : 'wiki';
          tab = 'search'; await search($, e.args); await open($, true);
          if (!interactive) return { text: clean(`${searchMessage}\n${results.map(r => `${r.path}:${r.line} — ${r.title}\n${r.excerpt}`).join('\n\n')}`, 4000) };
        } else if (['wiki-research', 'wiki-audit', 'wiki-save'].includes(command)) {
          if (e.origin?.kind === 'plugin' || e.origin?.kind === 'model')
            return { text: 'Wiki model actions must be started explicitly by the user.' };
          launch($, command === 'wiki-save' ? 'save' : command.slice(5), command === 'wiki-save' ? '' : e.args);
        } else { tab = 'state'; await open($, true); }
        return interactive ? {} : { text: statusText() };
      } catch (failure) { report($, failure); return { text: clean(failure.message, 300) }; }
    });
  }

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return next(e);
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const line = (text, bold = false, color = bold ? 'cyan' : undefined) => Text({ children: [clean(text, 4000)], bold, ...(color ? { color } : {}) });
    const button = (key, label, onPress, color = 'cyan') => Box({ borderStyle: 'quote', borderColor: color, paddingLeft: 1, children: [Button({ key, label, onPress })] });
    const tabs = Box({ flexDirection: 'row', columnGap: 1, children: ['state', 'history', 'search'].map(name =>
      Box({ borderStyle: 'single', borderColor: tab === name ? 'cyan' : 'gray', paddingX: 1, children: [
        Button({ key: `tab-${name}`, label: name, plain: true, dimColor: tab !== name,
          onPress: () => { tab = name; redraw($); } })] })) });
    const controls = Box({ flexDirection: 'row', columnGap: 1, children: [
      button('refresh', 'Refresh', async () => { await refresh($); if (tab === 'search' && (query || searchMode === 'sources')) await search($, query); }),
      button('close', 'Hide', async () => { await $.ui.close({ id: PANE }); opened = false; }),
    ] });
    const body = [];
    if (error) body.push(line(error, true, 'red'));
    if (data) {
      if (tab === 'state' && notices()) body.push(line(notices(), false, 'yellow'));
      if (tab === 'state') body.push(line(`Recorded: ${data.freshness.recorded}`), line(data.freshness.label, false, 'yellow'),
        line('Startup summary', true), line(data.summary), line('Active work', true), line(data.active),
        line('Blockers / pending decisions', true, 'yellow'), line(data.blockers), line('Next step', true, 'green'), line(data.next));
      if (tab === 'history') body.push(line('Recent meaningful memory changes', true),
        ...data.changes.map(change => line(change)), ...(data.changes.length ? [] : [line('No dated changes recorded.')]),
        ...(data.warning ? [line(data.warning, false, 'yellow')] : []));
      if (tab === 'search') {
        body.push(Box({ flexDirection: 'row', columnGap: 1, children: ['wiki', 'sources'].map(mode =>
          button(`filter-${mode}`, `${searchMode === mode ? '● ' : ''}${mode === 'wiki' ? 'Wiki' : 'Sources'}`, async () => {
            searchMode = mode; actionScope = ''; await search($, '');
          })) }));
        body.push(Input({ key: 'search', label: searchMode === 'sources' ? 'Sources in raw/ and docs/' : 'Local notes', placeholder: 'Words (all must match)',
          value: query, submitLabel: 'search', onInput: value => {
            query = clean(value, LIMITS.query);
            if (!query.trim()) return search($, '');
          },
          onSubmit: value => search($, value) }));
        if (searchMessage) body.push(line(searchMessage));
        for (const result of results) body.push(button(`note-${result.path}`, `${result.title} — ${result.path}:${result.line}`, async () => {
          try {
            let text;
            if (searchMode === 'sources') {
              const info = await sourceInfo($, root, result.path);
              text = /\.(md|txt|rst|csv|json|ya?ml|html?)$/i.test(result.path) && info.size <= LIMITS.note
                ? await readLocal($, root, result.path, LIMITS.note)
                : `Source file (${info.size} bytes). Content preview unavailable; Claude checks format support during ingest.`;
            } else text = await readLocal($, root, result.path, LIMITS.note);
            selected = result.path; preview = clean(text, 3000); redraw($);
          } catch (failure) { report($, failure); }
        }));
        if (selected) body.push(line(`Selected: ${selected}`, true), line(preview), line('Preview capped at 3,000 characters.'));
      }
      if (tab === 'state') {
        body.push(button('save', 'Save conversation memory', () => launch($, 'save', ''), 'magenta'));
      } else if (tab === 'search' && searchMode === 'sources') {
        body.push(Input({ key: 'source-scope', label: 'What to retain (optional)', value: actionScope,
          onInput: value => { actionScope = clean(value, LIMITS.query); },
          onSubmit: value => { actionScope = clean(value, LIMITS.query); redraw($); } }));
        if (selected) body.push(button('ingest', 'Ingest source', () => launch($, 'ingest', actionScope), 'green'));
      } else {
        body.push(line('Wiki actions', true, 'magenta'),
          Input({ key: 'scope', label: 'Question / scope', value: query, placeholder: 'Topic or question',
            onInput: value => { query = clean(value, LIMITS.query); },
            onSubmit: value => { query = clean(value, LIMITS.query); redraw($); } }));
        if (tab === 'search') body.push(button('research', 'Research wiki', () => launch($, 'research', query), 'cyan'));
        body.push(button('audit', 'Audit wiki', () => launch($, 'audit', query), 'yellow'));
      }
      if (pending) body.push(line('Action queued; it starts when Claude is idle.'));
    }
    return Box({ flexDirection: 'column', gap: 1, children: [tabs, controls, ...body] });
  });

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const original = await next(e);
    if (!data) return original;
    const { Box, Text, Button } = $.ui.resolve(e);
    return Box({ flexDirection: 'column', children: [...(original ? [original] : []),
      Box({ flexDirection: 'row', columnGap: 1, children: [
        Text({ children: [clean(`Wiki · ${opened ? '' : '/wiki-status · '}${data.freshness.label}`, 130)], color: 'cyan', wrap: 'truncate' }),
        Button({ key: 'open-wiki', label: opened ? 'Hide wiki' : 'Open wiki', onPress: async () => {
          if (opened) { await $.ui.close({ id: PANE }); opened = false; }
          else await open($, true);
          redraw($);
        } }),
      ] }),
    ] });
  });
}
