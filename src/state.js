/*
 * Lumo · 数据模型与状态核心 (M2)
 * 纯逻辑，浏览器(window.Lumo.state) 与 Node(require) 双用。
 */
(function (global) {
  'use strict';

  const SCHEMA_VERSION = 1;

  // 宠物类型定义：初始人格偏移 + 基础外观
  const PET_TYPES = {
    lumo:  { id: 'lumo',  name: '光球',   emoji: '🌟', color: '#FFD479', bias: { clingy: +8, humor: +4, sensitive: -2, curious: +6, lively: +4 } },
    fox:   { id: 'fox',   name: '小狐',   emoji: '🦊', color: '#FF9E6D', bias: { clingy: -2, humor: +10, sensitive: -4, curious: +8, lively: +10 } },
    blob:  { id: 'blob',  name: '团子',   emoji: '🐱', color: '#C9B6FF', bias: { clingy: +10, humor: 0, sensitive: +8, curious: -2, lively: -2 } },
    whale: { id: 'whale', name: '小鲸',   emoji: '🐳', color: '#7FD0FF', bias: { clingy: +2, humor: -4, sensitive: +10, curious: +2, lively: -6 } },
    deer:  { id: 'deer',  name: '鹿灵',   emoji: '🦌', color: '#A8E6A3', bias: { clingy: 0, humor: +2, sensitive: +4, curious: +6, lively: +2 } }
  };

  const PERSONALITY_DIMS = ['clingy', 'humor', 'sensitive', 'curious', 'lively'];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function defaultPersonality() {
    const p = {};
    PERSONALITY_DIMS.forEach(d => { p[d] = 50; });
    return p;
  }

  function applyBias(personality, bias) {
    PERSONALITY_DIMS.forEach(d => {
      personality[d] = clamp((personality[d] || 50) + (bias[d] || 0), 0, 100);
    });
    return personality;
  }

  // 创建一只新宠物的初始状态
  function createState(opts) {
    opts = opts || {};
    const typeId = PET_TYPES[opts.typeId] ? opts.typeId : 'lumo';
    const type = PET_TYPES[typeId];
    const now = opts.now || Date.now();
    const personality = applyBias(defaultPersonality(), type.bias);

    return {
      version: SCHEMA_VERSION,
      pet: {
        typeId: typeId,
        name: (opts.name && String(opts.name).trim()) || type.name,
        adoptedAt: now,
        // 宠物「生日」= 领养日
      },
      needs: { hunger: 80, hygiene: 80, energy: 80, mood: 75 },
      affection: 30,
      level: 1,
      exp: 0,
      coins: 50,
      inventory: {},
      equipped: { skin: 'default', furniture: 'default' },
      personality: personality,
      personalityHistory: [{ day: 0, at: now, snapshot: Object.assign({}, personality) }],
      memories: [],
      events: [],
      anchors: { weather: null, steps: 0, lastStepsDate: null, photoCount: 0 },
      settings: {
        sound: true,
        notifications: false,
        theme: 'auto',
        llmKey: '',
        llmBase: '',
        city: 'Beijing'
      },
      stats: { careCount: 0, talkCount: 0, playCount: 0, feedCount: 0, lastActive: now },
      lastTick: now
    };
  }

  // 校验状态完整，缺失字段补默认值（防御性）
  function validate(state) {
    if (!state || typeof state !== 'object') return null;
    const base = createState({ now: state.lastTick || Date.now() });
    const out = Object.assign(base, state);
    out.needs = Object.assign(base.needs, state.needs || {});
    out.personality = Object.assign(base.personality, state.personality || {});
    out.equipped = Object.assign(base.equipped, state.equipped || {});
    out.settings = Object.assign(base.settings, state.settings || {});
    out.anchors = Object.assign(base.anchors, state.anchors || {});
    out.stats = Object.assign(base.stats, state.stats || {});
    out.inventory = state.inventory || {};
    out.memories = Array.isArray(state.memories) ? state.memories : [];
    out.events = Array.isArray(state.events) ? state.events : [];
    out.personalityHistory = Array.isArray(state.personalityHistory) && state.personalityHistory.length
      ? state.personalityHistory : base.personalityHistory;
    out.pet = Object.assign(base.pet, state.pet || {});
    if (!PET_TYPES[out.pet.typeId]) out.pet.typeId = 'lumo';
    // 数值夹紧
    Object.keys(out.needs).forEach(k => { out.needs[k] = clamp(out.needs[k], 0, 100); });
    out.affection = clamp(out.affection, 0, 100);
    out.level = Math.max(1, out.level | 0);
    out.coins = Math.max(0, out.coins | 0);
    return out;
  }

  // 版本迁移（未来扩展）
  function migrate(state) {
    if (!state) return null;
    // 当前仅有 v1，无需迁移；保留钩子
    return validate(state);
  }

  function ageDays(state, now) {
    now = now || Date.now();
    return Math.max(0, Math.floor((now - (state.pet.adoptedAt || now)) / 86400000));
  }

  function getPetType(typeId) { return PET_TYPES[typeId] || PET_TYPES.lumo; }

  const API = {
    SCHEMA_VERSION, PET_TYPES, PERSONALITY_DIMS,
    clamp, defaultPersonality, applyBias,
    createState, validate, migrate, ageDays, getPetType
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { state: API });
})(typeof window !== 'undefined' ? window : globalThis);
