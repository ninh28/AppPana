const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .find(script => script.trim());

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function startApp({ blockLocal = false, blockSession = false } = {}) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) {
      elements.set(id, { style: {}, dataset: {}, innerHTML: '', textContent: '', value: '' });
    }
    return elements.get(id);
  };
  const window = {};
  Object.defineProperty(window, 'localStorage', {
    get() { if (blockLocal) throw new Error('Storage unavailable'); return localStorage; }
  });
  Object.defineProperty(window, 'sessionStorage', {
    get() { if (blockSession) throw new Error('Storage unavailable'); return sessionStorage; }
  });
  const document = {
    querySelector: selector => getElement(selector.replace(/^#/, '')),
    getElementById: getElement,
    querySelectorAll: () => []
  };
  const context = vm.createContext({
    window, document, navigator: {}, alert() {}, confirm: () => true,
    scrollTo() {}, requestAnimationFrame: callback => callback(), console
  });
  vm.runInContext(source, context);
  return { context, localStorage, sessionStorage };
}

test('falls back to session or memory storage when browser storage is blocked', () => {
  const sessionApp = startApp({ blockLocal: true });
  assert.equal(vm.runInContext('storageMode', sessionApp.context), 'session');
  vm.runInContext('save()', sessionApp.context);
  assert.ok(sessionApp.sessionStorage.getItem('prdcv2'));

  const memoryApp = startApp({ blockLocal: true, blockSession: true });
  assert.equal(vm.runInContext('storageMode', memoryApp.context), 'memory');
  assert.equal(vm.runInContext('save()', memoryApp.context), true);
  assert.match(vm.runInContext("document.getElementById('saveStatus').textContent", memoryApp.context), /tải lại trang/);
});

test('deleting the active video keeps the person and undo restores the video', () => {
  const app = startApp();
  vm.runInContext(`
    S.people = [{
      id: 'P1', name: 'Demo', file: 'second.mp4', shoot: '2026-11-25',
      activeVideoId: 'v2', payLog: [], videoLog: [
        { id: 'v1', file: 'first.mp4', shoot: '2026-11-25', qc: 'Đạt chuẩn', up: 'Đã upload' },
        { id: 'v2', file: 'second.mp4', shoot: '2026-11-25', qc: 'Chờ duyệt', up: 'Chưa upload' }
      ]
    }];
    deleteVideoFrom({ dataset: { person: 'P1', video: 'v2' } });
  `, app.context);

  assert.equal(vm.runInContext('S.people.length', app.context), 1);
  assert.equal(vm.runInContext('S.people[0].videoLog.length', app.context), 1);
  assert.equal(vm.runInContext('S.people[0].activeVideoId', app.context), 'v1');
  assert.equal(vm.runInContext('S.people[0].file', app.context), 'first.mp4');

  vm.runInContext('undoLast()', app.context);
  assert.equal(vm.runInContext('S.people[0].videoLog.length', app.context), 2);
  assert.equal(vm.runInContext('S.people[0].file', app.context), 'second.mp4');
});

test('deleting a legacy video clears only video fields', () => {
  const app = startApp();
  vm.runInContext(`
    S.people = [{ id: 'P2', name: 'Legacy', file: 'legacy.mp4', shoot: '2026-11-25', videoLog: [] }];
    deleteVideoFrom({ dataset: { person: 'P2', video: 'P2' } });
  `, app.context);

  assert.equal(vm.runInContext('S.people.length', app.context), 1);
  assert.equal(vm.runInContext('S.people[0].name', app.context), 'Legacy');
  assert.equal(vm.runInContext("'file' in S.people[0]", app.context), false);
});

test('people list shows everyone by default and filters when a date is selected', () => {
  const app = startApp();
  vm.runInContext(`
    S.people = [
      { id: 'P1', name: 'Today', book: '2026-11-25', videoLog: [{ id: 'v1', shoot: '2026-11-25' }] },
      { id: 'P2', name: 'Earlier', book: '2026-11-24', videoLog: [{ id: 'v2', shoot: '2026-11-24' }] }
    ];
    collectionDay = '';
  `, app.context);
  const tableRows = table => [...table.matchAll(/<tr[^>]*data-date-match="([01])"[^>]*data-record-id="([^"]+)"/g)]
    .map(match => ({ dataset: { dateMatch: match[1], recordId: match[2], search: '', state: '' }, style: {} }));
  const allRows = tableRows(vm.runInContext("tbl('p')", app.context));
  app.context.testRows = allRows;
  vm.runInContext("document.querySelectorAll = () => testRows; filterTable('p')", app.context);
  assert.deepEqual(allRows.map(row => row.style.display), ['', '']);

  vm.runInContext("setCollectionDay('2026-11-25')", app.context);
  const filteredRows = tableRows(vm.runInContext("tbl('p')", app.context));
  app.context.testRows = filteredRows;
  vm.runInContext("document.querySelectorAll = () => testRows; filterTable('p')", app.context);
  assert.deepEqual(filteredRows.map(row => row.style.display), ['', 'none']);
});

test('suggests the nearest person even when capture time is more than five minutes away', () => {
  const app = startApp();
  vm.runInContext(`
    S.people = [{ id: 'P1', name: 'Demo', startAt: '2026-11-25T10:00:00' }];
    S.cfg.filenameTimeEnabled = false;
  `, app.context);

  const suggested = vm.runInContext(`suggestVideoPerson({
    dateHint: '2026-11-25',
    fileDate: '2026-11-25T11:00:00',
    file: 'video.mp4'
  })`, app.context);
  assert.equal(suggested.id, 'P1');
});
