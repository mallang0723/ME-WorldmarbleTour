const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(`${__dirname}/../extension/extension.js`, 'utf8');
const widget = source.slice(source.indexOf('const mwtButton ='), source.indexOf('let mwtCurrentChatId ='));
const key = 'mwt:ui:button-position';

function setup({ saved = null, storageBlocked = false, safe = {}, hitTest = () => null } = {}) {
  const listeners = new Map();
  const elements = [];
  const storage = new Map(saved === null ? [] : [[key, saved]]);
  const viewport = { width: 390, height: 844, offsetLeft: 0, offsetTop: 0 };
  const window = { innerWidth: 390, innerHeight: 844, visualViewport: viewport };
  let opened = 0;
  const context = {
    window,
    document: { body: {}, elementFromPoint: (x, y) => hitTest(x, y, elements[0]) },
    getComputedStyle: (element) => ({ position: element.position ?? 'static', paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '0px', ...safe }),
    localStorage: {
      getItem: (name) => { if (storageBlocked) throw Error('blocked'); return storage.get(name) ?? null; },
      setItem: (name, value) => { if (storageBlocked) throw Error('blocked'); storage.set(name, value); },
    },
    mwtTogglePanel: () => { opened++; },
    marinara: {
      addElement: (_parent, _tag, attrs) => {
        const element = {
          attrs, style: { pointerEvents: '' }, dataset: {}, offsetWidth: 48, offsetHeight: 48,
          getBoundingClientRect() { return { left: parseFloat(this.style.left), top: parseFloat(this.style.top) }; },
          setPointerCapture() {}, releasePointerCapture() {}, contains(element) { return element === this; },
        };
        elements.push(element);
        return element;
      },
      on: (target, type, handler) => {
        if (!listeners.has(target)) listeners.set(target, new Map());
        listeners.get(target).set(type, handler);
      },
    },
  };
  vm.runInNewContext(widget, context);
  const button = elements[0];
  const send = (target, type, fields = {}) => {
    const event = { type, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, detail: 1, clientX: 282, clientY: 660, stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; }, ...fields };
    listeners.get(target)?.get(type)?.(event);
    return event;
  };
  return { button, window, viewport, storage, send, position: () => button.getBoundingClientRect(), opened: () => opened };
}

test('390px default leaves 84px on the right and reserves 160px below the button', () => {
  const app = setup();
  assert.deepEqual(app.position(), { left: 258, top: 636 });
  assert.equal(app.storage.size, 0);
});

test('tap with minor touch jitter opens once; keyboard activation also works', () => {
  const app = setup();
  app.send(app.button, 'pointerdown');
  app.send(app.window, 'pointermove', { clientX: 284, clientY: 662 });
  app.send(app.window, 'pointerup');
  assert.equal(app.opened(), 0);
  app.send(app.button, 'click');
  assert.equal(app.opened(), 1);
  app.send(app.button, 'click', { detail: 0 });
  assert.equal(app.opened(), 2);
  assert.equal(app.storage.size, 0);
});

for (const pointerType of ['mouse', 'touch', 'pen']) {
  test(`${pointerType} drag persists, restores, and suppresses the ensuing click`, () => {
    const app = setup();
    app.send(app.button, 'pointerdown', { pointerType });
    app.send(app.window, 'pointermove', { pointerType, clientX: 200, clientY: 400 });
    assert.equal(app.button.dataset.dragging, 'true');
    app.send(app.window, 'pointerup', { pointerType, clientX: 200, clientY: 400 });
    assert.equal(app.send(app.button, 'click').prevented, true);
    assert.equal(app.opened(), 0);
    assert.equal(app.button.dataset.dragging, undefined);
    assert.deepEqual(app.position(), { left: 176, top: 376 });
    const saved = app.storage.get(key);
    assert.deepEqual(JSON.parse(saved), { x: 176, y: 376 });
    assert.deepEqual(setup({ saved }).position(), app.position());
    app.send(app.button, 'pointerdown', { clientX: 200, clientY: 400 });
    app.send(app.window, 'pointerup', { clientX: 200, clientY: 400 });
    app.send(app.button, 'click');
    assert.equal(app.opened(), 1);
  });
}

test('all four safe-area edges constrain dragging', () => {
  const app = setup({ safe: { paddingTop: '44px', paddingRight: '20px', paddingBottom: '34px', paddingLeft: '10px' } });
  app.send(app.button, 'pointerdown');
  app.send(app.window, 'pointermove', { clientX: -1000, clientY: -1000 });
  assert.deepEqual(app.position(), { left: 26, top: 60 });
  app.send(app.window, 'pointermove', { clientX: 2000, clientY: 2000 });
  assert.deepEqual(app.position(), { left: 306, top: 746 });
});

test('resize and keyboard viewport changes clamp without losing the saved preference', () => {
  const saved = JSON.stringify({ x: 900, y: 700 });
  const app = setup({ saved });
  assert.deepEqual(app.position(), { left: 326, top: 700 });
  Object.assign(app.viewport, { width: 320, height: 300 });
  app.send(app.viewport, 'resize');
  assert.deepEqual(app.position(), { left: 256, top: 236 });
  Object.assign(app.viewport, { offsetLeft: 50, offsetTop: 80 });
  app.send(app.viewport, 'scroll');
  assert.deepEqual(app.position(), { left: 306, top: 316 });
  Object.assign(app.viewport, { width: 1200, height: 900, offsetLeft: 0, offsetTop: 0 });
  app.send(app.window, 'resize');
  assert.deepEqual(app.position(), { left: 900, top: 700 });
  assert.equal(app.storage.get(key), saved);
});

for (const type of ['pointercancel', 'lostpointercapture']) {
  test(`${type} cancels without opening or saving`, () => {
    const app = setup();
    app.send(app.button, 'pointerdown');
    app.send(type === 'pointercancel' ? app.window : app.button, type);
    app.send(app.button, 'click');
    assert.equal(app.opened(), 0);
    app.send(app.button, 'pointerdown');
    app.send(app.window, 'pointermove', { clientX: 100, clientY: 200 });
    app.send(type === 'pointercancel' ? app.window : app.button, type);
    assert.deepEqual(app.position(), { left: 258, top: 636 });
    assert.equal(app.storage.size, 0);
  });
}

test('secondary touches cannot steal the drag; non-left mouse buttons are ignored', () => {
  const app = setup();
  app.send(app.button, 'pointerdown', { pointerType: 'mouse', button: 2 });
  app.send(app.window, 'pointermove', { clientX: 100, clientY: 200 });
  assert.deepEqual(app.position(), { left: 258, top: 636 });
  app.send(app.button, 'pointerdown');
  app.send(app.button, 'pointerdown', { pointerId: 2, isPrimary: false });
  app.send(app.window, 'pointermove', { pointerId: 2, clientX: 100, clientY: 200 });
  assert.deepEqual(app.position(), { left: 258, top: 636 });
  app.send(app.window, 'pointermove', { clientX: 200, clientY: 400 });
  assert.deepEqual(app.position(), { left: 176, top: 376 });
});

test('malformed storage and unavailable localStorage do not break the widget', () => {
  for (const saved of ['{', 'null', '[]', '{"x":"10","y":20}', '{"x":1e400,"y":20}']) {
    assert.deepEqual(setup({ saved }).position(), { left: 258, top: 636 });
  }
  const app = setup({ storageBlocked: true });
  app.send(app.button, 'pointerdown');
  app.send(app.window, 'pointermove', { clientX: 200, clientY: 400 });
  assert.doesNotThrow(() => app.send(app.window, 'pointerup'));
  assert.deepEqual(app.position(), { left: 176, top: 376 });
});

function floatingHit(position = 'fixed', parentElement = null) {
  const button = { position, parentElement };
  return { closest: () => button };
}

test('initial placement looks through our button and shifts away from a fixed button wrapper', () => {
  const points = [];
  const hit = floatingHit('static', { position: 'fixed' });
  const app = setup({ hitTest: (x, y, button) => {
    assert.equal(button.style.pointerEvents, 'none');
    points.push([x, y]);
    return x === 282 ? hit : null;
  } });
  assert.deepEqual(points, [[282, 660], [234, 660]]);
  assert.deepEqual(app.position(), { left: 210, top: 636 });
  assert.equal(app.button.style.pointerEvents, '');
  app.send(app.window, 'resize');
  assert.deepEqual(app.position(), { left: 210, top: 636 });
  assert.equal(points.length, 2);
  assert.equal(app.storage.size, 0);
});

test('collision avoidance shifts at most three button widths', () => {
  let calls = 0;
  const app = setup({ hitTest: () => { calls++; return floatingHit(); } });
  assert.equal(calls, 3);
  assert.deepEqual(app.position(), { left: 114, top: 636 });
});

test('saved user positions bypass initial collision avoidance', () => {
  const saved = JSON.stringify({ x: 326, y: 636 });
  const app = setup({ saved, hitTest: () => { throw Error('must not inspect saved positions'); } });
  assert.deepEqual(app.position(), { left: 326, top: 636 });
  assert.equal(app.storage.get(key), saved);
});

test('ordinary content, non-fixed buttons, and our own button do not cause a shift', () => {
  for (const hitTest of [() => ({ closest: () => null }), () => floatingHit('static'), (_x, _y, button) => ({ closest: () => button })]) {
    assert.deepEqual(setup({ hitTest }).position(), { left: 258, top: 636 });
  }
});

test('touchstart and pointerdown stop propagation without preventing tap activation', () => {
  const app = setup();
  for (const type of ['pointerdown', 'touchstart']) {
    const event = app.send(app.button, type);
    assert.equal(event.stopped, true);
    assert.equal(event.prevented, undefined);
  }
  app.send(app.window, 'pointerup');
  app.send(app.button, 'click');
  assert.equal(app.opened(), 1);
});
