/*
 * Lumo · 情绪与心情引擎 (M6)
 * 综合需求、近期互动、用户情绪、现实锚点推导宠物当前心情。
 */
(function (global) {
  'use strict';

  const N = (typeof module !== 'undefined' && module.exports)
    ? require('./needs.js') : (global.Lumo && global.Lumo.needs);

  const MOODS = {
    hungry:  { key: 'hungry',  emoji: '🥺', label: '饿了',   color: '#FFB36B' },
    dirty:   { key: 'dirty',   emoji: '🙁', label: '想洗澡', color: '#9FD3C7' },
    sleepy:  { key: 'sleepy',  emoji: '😴', label: '困了',   color: '#9AA7E0' },
    comfort: { key: 'comfort', emoji: '🤗', label: '想陪你', color: '#F7A8C0' },
    excited: { key: 'excited', emoji: '🤩', label: '超开心', color: '#FFD479' },
    happy:   { key: 'happy',   emoji: '😊', label: '开心',   color: '#FFE08A' },
    content: { key: 'content', emoji: '😌', label: '安好',   color: '#BFE3A0' },
    sad:     { key: 'sad',     emoji: '😢', label: '有点低落', color: '#A9B7D8' }
  };

  function weatherCategory(code) {
    if (code == null) return 'unknown';
    if (code <= 1) return 'clear';
    if (code <= 3 || code === 45 || code === 48) return 'cloudy';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code >= 85 && code <= 86) return 'snow';
    if (code >= 95) return 'storm';
    return 'cloudy';
  }

  // 推导当前心情
  function compute(state, ctx) {
    ctx = ctx || {};
    const n = state.needs;
    const score = N.wellbeing(state); // 0-100

    // 需求优先
    if (n.hunger < 25) return Object.assign({ score }, MOODS.hungry);
    if (n.hygiene < 25) return Object.assign({ score }, MOODS.dirty);
    if (n.energy < 20) return Object.assign({ score }, MOODS.sleepy);

    // 用户情绪：最近对话情绪
    if (ctx.userSentiment === 'neg') return Object.assign({ score: Math.max(score, 62) }, MOODS.comfort);
    if (ctx.userSentiment === 'pos' && state.affection > 70) return Object.assign({ score }, MOODS.excited);
    if (ctx.userSentiment === 'pos') return Object.assign({ score }, MOODS.happy);

    // 天气
    const wc = weatherCategory(ctx.weatherCode);
    if (wc === 'storm') return Object.assign({ score: Math.min(score, 55) }, MOODS.sad);
    if (wc === 'rain') return Object.assign({ score: Math.min(score, 70) }, MOODS.content);

    // 夜间
    if (ctx.isNight && n.energy < 45) return Object.assign({ score }, MOODS.sleepy);

    // 亲密度高 + 心情好
    if (state.affection > 80 && score > 70) return Object.assign({ score }, MOODS.excited);
    if (score > 60) return Object.assign({ score }, MOODS.happy);
    if (score > 35) return Object.assign({ score }, MOODS.content);
    return Object.assign({ score }, MOODS.sad);
  }

  // 心情短语（供 UI 气泡）
  const MOOD_LINES = {
    hungry:  ['肚子咕咕叫了…', '有点饿饿的', '想吃东西啦'],
    dirty:   ['身上黏黏的…', '想洗个澡', '好想干净一下'],
    sleepy:  ['困得睁不开眼', 'zzZ…', '想睡觉觉'],
    comfort: ['你看起来不太开心，我在呢', '抱抱你', '要不要说给我听？'],
    excited: ['今天好开心！！', '好喜欢和你在一起', '转圈圈～'],
    happy:   ['嘿嘿，开心', '今天也不错', '你在真好'],
    content: ['这样安安静静的挺好', '陪着你真好', '慢慢来，不急'],
    sad:     ['有点提不起劲…', '希望你好一点', '我们一起待会儿吧']
  };

  function line(state, ctx, rnd) {
    const m = compute(state, ctx);
    const pool = MOOD_LINES[m.key] || MOOD_LINES.content;
    const pick = rnd ? pool[Math.floor(rnd() * pool.length)] : pool[0];
    return pick;
  }

  const API = { MOODS, weatherCategory, compute, line };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { mood: API });
})(typeof window !== 'undefined' ? window : globalThis);
