/*
 * Lumo · 持久化与数字永生 (M10)
 * localStorage 自动存档/读档/迁移；开放格式导出/导入；只读遗产模式。
 */
(function (global) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports) ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const KEY = 'lumo_save_v1';

  // 存储抽象：优先 localStorage，否则内存 shim（便于 node 测试）
  function store() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) {}
    if (!global.__lumo_store) global.__lumo_store = (function () {
      const m = {};
      return {
        getItem: k => (k in m ? m[k] : null),
        setItem: (k, v) => { m[k] = String(v); },
        removeItem: k => { delete m[k]; }
      };
    })();
    return global.__lumo_store;
  }

  function save(state) {
    try {
      const payload = JSON.stringify(state);
      store().setItem(KEY, payload);
      store().setItem(KEY + '_at', String(Date.now()));
      return true;
    } catch (e) { return false; }
  }

  function raw() { return store().getItem(KEY); }

  function hasSave() { return !!raw(); }

  function load() {
    const r = raw();
    if (!r) return null;
    try {
      const obj = JSON.parse(r);
      return S.migrate(obj) || null;
    } catch (e) { return null; }
  }

  function lastSavedAt() { return Number(store().getItem(KEY + '_at') || 0); }

  function clear() { store().removeItem(KEY); store().removeItem(KEY + '_at'); }

  // 开放格式导出（含元数据，便于跨平台/遗产）
  function exportJSON(state) {
    const doc = {
      app: 'lumo',
      schema: S.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      note: '拾光 Lumo 宠物档案 · 开放格式，可导入兼容应用或开源阅读器查看',
      state: state
    };
    return JSON.stringify(doc, null, 2);
  }

  // 导入并校验
  function importJSON(str) {
    let doc;
    try { doc = JSON.parse(str); } catch (e) { throw new Error('文件不是合法 JSON'); }
    const state = doc && doc.state ? doc.state : doc;
    if (!state || typeof state !== 'object') throw new Error('缺少宠物数据');
    const validated = S.migrate(state);
    if (!validated) throw new Error('数据无法校验');
    return validated;
  }

  // 只读遗产快照（纪念态）
  function toArchive(state) {
    const snap = JSON.parse(JSON.stringify(state));
    snap.__archive = true;
    snap.__archivedAt = new Date().toISOString();
    return snap;
  }

  function isArchive(state) { return !!(state && state.__archive); }

  const API = { KEY, save, load, hasSave, lastSavedAt, clear, exportJSON, importJSON, toArchive, isArchive };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { persistence: API });
})(typeof window !== 'undefined' ? window : globalThis);
