const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(`${__dirname}/../extension/extension.js`, 'utf8');
const decisionCode = source.slice(source.indexOf('function mwtDecisionDefault('), source.indexOf('// ───────────────────────── 활성 채팅 감지'));
const chatId = 'chat /한글';
const characterId = 'npc';
const saved = (content, extra = {}) => ({
  type: 'message_saved', data: { id: 'reply', chatId, characterId, role: 'assistant', content, ...extra },
});
const done = { type: 'done', data: '' };
const sse = (...events) => events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
const valid = '살게요.\n[marble-decision: buy=yes]';

function setup({ generations = [sse(saved(valid), done)], pages = [], status = 200, disposed = false } = {}) {
  const calls = [];
  const lifecycle = { disposed, abort: new AbortController() };
  const context = {
    mwtLifecycle: lifecycle,
    mwtTileLabel: () => '서울', mwtFmt: String, MWT_BUILD_ICON: ['', '🏡'], MWT_TILE_COUNT: 18,
    window: {
      async fetch(path, options) {
        const url = new URL(path, 'https://example.invalid');
        const method = options.method ?? 'GET';
        calls.push({ path: url.pathname, method, body: options.body && JSON.parse(options.body) });
        assert.equal(options.signal, lifecycle.abort.signal);
        if (method === 'GET' && url.pathname.endsWith('/messages')) {
          assert.ok(url.searchParams.has('limit'), 'message GET must have a limit');
          const limit = Number(url.searchParams.get('limit'));
          assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= 3, 'message limit must be 1–3');
          assert.equal(url.searchParams.has('before'), false, 'no history walk');
          assert.ok(pages.length, 'unexpected message GET');
          return { ok: status === 200, status, json: async () => pages.shift() };
        }
        if (url.pathname === '/api/generate' && method === 'POST') {
          assert.ok(generations.length, 'unexpected generation');
          return { ok: status === 200, status, text: async () => generations.shift() };
        }
        assert.equal(url.pathname, `/api/chats/${encodeURIComponent(chatId)}/messages`);
        assert.equal(method, 'POST');
        return { ok: true, json: async () => ({ id: 'narrator' }) };
      },
    },
  };
  vm.runInNewContext(decisionCode, context);
  return {
    calls,
    decide: (kind = 'buy') => context.mwtRequestCharacterDecision(
      { chatId }, { characterId, label: 'NPC', cash: 1000000 },
      { kind, tileNum: 2, price: 100000, nextCost: 100000, nextLevel: 1 },
    ),
    generate: () => context.mwtGenerateForCharacter(chatId, characterId),
  };
}

function counts(app, expected) {
  assert.deepEqual({
    total: app.calls.length,
    generate: app.calls.filter((c) => c.path === '/api/generate').length,
    post: app.calls.filter((c) => c.path.endsWith('/messages') && c.method === 'POST').length,
    get: app.calls.filter((c) => c.method === 'GET').length,
  }, expected);
}

test('NPC decision reuses the saved message: 2 calls, no message GET', async () => {
  const app = setup();
  assert.equal(JSON.stringify(await app.decide()), JSON.stringify({ value: 'yes', dialogue: '살게요.' }));
  counts(app, { total: 2, generate: 1, post: 1, get: 0 });
  assert.deepEqual(app.calls[1].body, { chatId, userMessage: null, forCharacterId: characterId, streaming: false });
});

test('correction retry: 4 calls, no message GET', async () => {
  const app = setup({ generations: [sse(saved('태그 없음'), done), sse(saved(valid), done)] });
  assert.equal((await app.decide()).value, 'yes');
  counts(app, { total: 4, generate: 2, post: 2, get: 0 });
  assert.match(app.calls[2].body.content, /태그 형식이 인식되지 않았습니다/);
});

for (const [kind, fallback] of [['buy', 'no'], ['build', 'no'], ['worldtour', '2']]) {
  test(`${kind}: two invalid replies retain the safe default and narrator notice`, async () => {
    const app = setup({ generations: [sse(saved('[marble-decision: wrong=yes]'), done), sse(saved('없음'), done)] });
    assert.equal(JSON.stringify(await app.decide(kind)), JSON.stringify({ value: fallback, dialogue: null }));
    counts(app, { total: 5, generate: 2, post: 3, get: 0 });
    assert.match(app.calls[4].body.content, /기본값으로 처리/);
  });
}

test('selects the last matching assistant and applies only its rewrite', async () => {
  const app = setup({ generations: [sse(
    saved('이전 응답', { id: 'older' }), saved('수정 대기'),
    saved('다른 캐릭터', { id: 'other', characterId: 'other' }),
    saved('다른 채팅', { chatId: 'other-chat' }), saved('안내', { role: 'narrator' }),
    { type: 'text_rewrite', data: { messageId: 'older', editedText: '이전 수정' } },
    { type: 'text_rewrite', data: { messageId: 'reply', editedText: '"서울"로!\n[marble-decision: worldtour=3]' } },
    done,
  ).replaceAll('\n', '\r\n')] });
  assert.equal(JSON.stringify(await app.decide('worldtour')), JSON.stringify({ value: '3', dialogue: '"서울"로!' }));
  counts(app, { total: 2, generate: 1, post: 1, get: 0 });
});

test('SSE comments, token events and multiline data do not replace saved content', async () => {
  const app = setup({ generations: [': keepalive\n\n' + sse(
    { type: 'token', data: 'not final' }, saved(valid),
  ) + 'data: {"type":\n' + 'data: "done", "data":""}\n\n'] });
  assert.equal((await app.decide()).value, 'yes');
  counts(app, { total: 2, generate: 1, post: 1, get: 0 });
});

test('missing saved event fetches only the bounded tail and selects newest matching assistant', async () => {
  const app = setup({ generations: [sse(done)], pages: [[
    saved(valid).data, saved('other', { characterId: 'other' }).data, saved('notice', { role: 'narrator' }).data,
  ]] });
  assert.equal((await app.decide()).value, 'yes');
  counts(app, { total: 3, generate: 1, post: 1, get: 1 });
});

test('fallback correction retry: 6 calls, two bounded GETs', async () => {
  const app = setup({ generations: [sse(done), sse(done)], pages: [
    [saved('invalid').data], [saved('old').data, saved(valid).data],
  ] });
  assert.equal((await app.decide()).value, 'yes');
  counts(app, { total: 6, generate: 2, post: 2, get: 2 });
});

test('absent matching assistant never causes pagination or reuse of another character', async () => {
  const app = setup({ generations: [sse(done), sse(done)], pages: [
    [saved(valid, { characterId: 'other' }).data], [],
  ] });
  assert.equal((await app.decide()).value, 'no');
  counts(app, { total: 7, generate: 2, post: 3, get: 2 });
});

for (const [name, body, pattern] of [
  ['SSE error', sse({ type: 'error', data: '실패 "원인"' }, done), /실패 "원인"/],
  ['missing done', sse(saved(valid)), /done/],
  ['malformed event', 'data: {broken}\n\n', /JSON|property/],
]) {
  test(`${name} fails without a message GET`, async () => {
    const app = setup({ generations: [body] });
    await assert.rejects(app.generate(), pattern);
    counts(app, { total: 1, generate: 1, post: 0, get: 0 });
  });
}

test('HTTP error and disabled lifecycle do not start fallback reads', async () => {
  const app = setup({ status: 500 });
  await assert.rejects(app.generate(), /HTTP 500/);
  counts(app, { total: 1, generate: 1, post: 0, get: 0 });
  const disabled = setup({ disposed: true });
  await assert.rejects(disabled.decide(), /비활성화/);
  assert.equal(disabled.calls.length, 0);
});

test('all literal message-list API call sites are either POST or bounded GET', () => {
  const sites = [...source.matchAll(/mwtApi\(`([^`]*\/messages(?:\?[^`]*)?)`,\s*\{([^}]+)\}/g)];
  assert.equal(sites.length, 2);
  for (const [, path, options] of sites) {
    if (/method:\s*"POST"/.test(options)) continue;
    const limit = Number(new URLSearchParams(path.split('?')[1]).get('limit'));
    assert.ok(Number.isInteger(limit) && limit >= 1 && limit <= 3);
  }
});
