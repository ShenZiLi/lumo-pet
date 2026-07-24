/*
 * Lumo · 人格演化引擎 (M5)
 * 宠物性格随互动方式持续偏移，形成唯一人格，并记录成长曲线。
 */
(function (global) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports)
    ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const clamp = S.clamp;
  const DIMS = S.PERSONALITY_DIMS;

  // 互动信号 → 人格增量
  const SIGNALS = {
    play:          { lively: +1.2, curious: +0.3 },
    pet:           { clingy: +1.0, sensitive: +0.4 },
    feed:          { clingy: +0.3 },
    sleep:         { sensitive: +0.2 },
    talk_pos:      { humor: +0.8, lively: +0.4 },
    talk_neg:      { sensitive: +1.0, humor: -0.3 },
    talk_general:  { curious: +0.5 },
    explore:       { curious: +0.8, lively: +0.3 },
    photo:         { curious: +0.6, lively: +0.2 },
    neglect:       { clingy: -0.2, sensitive: -0.1 }
  };

  // 应用一次信号
  function evolve(state, signal, amount) {
    const delta = SIGNALS[signal];
    if (!delta) return false;
    const k = amount == null ? 1 : amount;
    DIMS.forEach(d => {
      if (delta[d]) state.personality[d] = clamp(state.personality[d] + delta[d] * k, 0, 100);
    });
    return true;
  }

  // 便捷封装：根据一次完整互动推断信号
  function fromInteraction(state, info) {
    info = info || {};
    if (info.action === 'play') evolve(state, 'play');
    else if (info.action === 'pet') evolve(state, 'pet');
    else if (info.action === 'feed') evolve(state, 'feed');
    else if (info.action === 'sleep') evolve(state, 'sleep');
    else if (info.action === 'explore' || info.action === 'photo') evolve(state, 'explore');

    if (info.action === 'talk' || info.kind === 'talk') {
      if (info.userSentiment === 'neg') evolve(state, 'talk_neg');
      else if (info.userSentiment === 'pos') evolve(state, 'talk_pos');
      else evolve(state, 'talk_general');
    }
    return state.personality;
  }

  // 记录成长快照（按天去重）
  function recordHistory(state, now) {
    now = now || Date.now();
    const day = Math.floor((now - state.pet.adoptedAt) / 86400000);
    const last = state.personalityHistory[state.personalityHistory.length - 1];
    if (!last || last.day !== day) {
      state.personalityHistory.push({ day: day, at: now, snapshot: Object.assign({}, state.personality) });
      if (state.personalityHistory.length > 400) state.personalityHistory.shift();
    }
    return state.personalityHistory;
  }

  // 主导特质
  function dominant(state) {
    let best = DIMS[0], bv = -1;
    DIMS.forEach(d => { if (state.personality[d] > bv) { bv = state.personality[d]; best = d; } });
    const LABEL = { clingy: '黏人', humor: '幽默', sensitive: '细腻', curious: '好奇', lively: '活泼' };
    return { dim: best, value: Math.round(bv), label: LABEL[best] };
  }

  // 文字描述
  function describe(state) {
    const LABEL = { clingy: '黏人', humor: '幽默', sensitive: '细腻', curious: '好奇', lively: '活泼' };
    return DIMS.map(d => `${LABEL[d]} ${Math.round(state.personality[d])}`).join(' · ');
  }

  // 成长曲线（每日一点）
  function growthCurve(state) {
    return state.personalityHistory.map(h => ({ day: h.day, snapshot: h.snapshot }));
  }

  // 与领养初值的偏移（用于"它真的变了"）
  function deltaFromStart(state) {
    const first = state.personalityHistory[0] ? state.personalityHistory[0].snapshot : state.personality;
    const out = {};
    DIMS.forEach(d => { out[d] = Math.round(state.personality[d] - (first[d] != null ? first[d] : 50)); });
    return out;
  }

  const API = { SIGNALS, evolve, fromInteraction, recordHistory, dominant, describe, growthCurve, deltaFromStart };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { personality: API });
})(typeof window !== 'undefined' ? window : globalThis);
