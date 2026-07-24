/*
 * Lumo · 需求衰减与照料逻辑 (M3)
 * 依赖 state(clamp)。浏览器(window.Lumo.needs) / Node(require)。
 */
(function (global) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports)
    ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const clamp = S.clamp;

  // 每小时衰减/恢复速率
  const RATE = {
    hunger: -5,     // 饥饿：越低越饿
    hygiene: -3,    // 卫生：越低越脏
    energy: +4,     // 精力：离开时自然恢复
    mood: -1.5      // 心情：被忽视时缓慢下滑
  };
  const AFFECTION_DRIFT = -0.25; // 每小时亲密度轻微下滑（久不陪伴会生疏）
  const MAX_OFFLINE_HOURS = 24 * 7; // 离线衰减最多计算 7 天

  function pushEvent(state, text, kind) {
    state.events.push({ ts: Date.now(), text: text, kind: kind || 'care' });
    if (state.events.length > 300) state.events.shift();
  }

  // 时间推进：根据距上次 tick 的流逝应用衰减
  function tick(state, now) {
    now = now || Date.now();
    let elapsedMs = now - (state.lastTick || now);
    if (elapsedMs < 0) elapsedMs = 0;
    let hours = elapsedMs / 3600000;
    if (hours > MAX_OFFLINE_HOURS) hours = MAX_OFFLINE_HOURS;

    if (hours > 0) {
      const before = Object.assign({}, state.needs);
      state.needs.hunger = clamp(state.needs.hunger + RATE.hunger * hours, 0, 100);
      state.needs.hygiene = clamp(state.needs.hygiene + RATE.hygiene * hours, 0, 100);
      state.needs.energy = clamp(state.needs.energy + RATE.energy * hours, 0, 100);
      // 饥饿/卫生过低会额外拉低心情
      let moodDrop = RATE.mood * hours;
      if (before.hunger < 20) moodDrop += 1.5 * hours;
      if (before.hygiene < 20) moodDrop += 1.0 * hours;
      state.needs.mood = clamp(state.needs.mood - moodDrop, 0, 100);
      state.affection = clamp(state.affection + AFFECTION_DRIFT * hours, 0, 100);

      // 跨天里程碑事件
      const prevDay = Math.floor((state.lastTick) / 86400000);
      const curDay = Math.floor(now / 86400000);
      if (curDay > prevDay) {
        const days = Math.floor((now - state.pet.adoptedAt) / 86400000);
        if (days > 0 && days % 30 === 0) {
          pushEvent(state, `今天是我们在一起的第 ${days} 天 🎉`, 'milestone');
        }
      }
    }
    state.lastTick = now;
    state.stats.lastActive = now;
    return state;
  }

  function addExp(state, n) {
    state.exp += n;
    let leveled = false;
    while (state.exp >= state.level * 100) {
      state.exp -= state.level * 100;
      state.level += 1;
      leveled = true;
    }
    if (leveled) pushEvent(state, `升级啦！现在是 Lv.${state.level} ✨`, 'milestone');
    return leveled;
  }

  function addCoins(state, n) { state.coins = Math.max(0, state.coins + n); }

  // —— 照料动作 ——
  function feed(state, foodBoost) {
    const amt = (foodBoost && foodBoost.hunger) || 28;
    state.needs.hunger = clamp(state.needs.hunger + amt, 0, 100);
    state.needs.mood = clamp(state.needs.mood + 4, 0, 100);
    state.affection = clamp(state.affection + 2, 0, 100);
    state.stats.feedCount += 1;
    addExp(state, 6); addCoins(state, 2);
    pushEvent(state, `喂了点东西，好满足～`, 'care');
    return { ok: true, msg: '好吃！', rewards: { coins: 2, exp: 6 } };
  }

  function clean(state) {
    state.needs.hygiene = clamp(state.needs.hygiene + 45, 0, 100);
    state.needs.mood = clamp(state.needs.mood + 5, 0, 100);
    state.affection = clamp(state.affection + 1, 0, 100);
    state.stats.careCount += 1;
    addExp(state, 5); addCoins(state, 2);
    pushEvent(state, `洗得干干净净 ✨`, 'care');
    return { ok: true, msg: '舒服多了～', rewards: { coins: 2, exp: 5 } };
  }

  function sleep(state) {
    state.needs.energy = clamp(state.needs.energy + 55, 0, 100);
    state.needs.mood = clamp(state.needs.mood + 6, 0, 100);
    state.stats.careCount += 1;
    addExp(state, 4);
    pushEvent(state, `睡了一觉，精神满满 💤`, 'care');
    return { ok: true, msg: '呼……睡得好香', rewards: { exp: 4 } };
  }

  function play(state, toyBoost) {
    if (state.needs.energy < 12) return { ok: false, msg: '它太累了，先让它睡会儿吧' };
    const moodAmt = (toyBoost && toyBoost.mood) || 20;
    state.needs.energy = clamp(state.needs.energy - 15, 0, 100);
    state.needs.mood = clamp(state.needs.mood + moodAmt, 0, 100);
    state.affection = clamp(state.affection + 6, 0, 100);
    state.stats.playCount += 1;
    addExp(state, 10); addCoins(state, 3);
    pushEvent(state, `玩得好开心！`, 'care');
    return { ok: true, msg: '再玩一次嘛！', rewards: { coins: 3, exp: 10 } };
  }

  // 免费抚摸互动：小幅提升心情与亲密度
  function petTouch(state) {
    state.needs.mood = clamp(state.needs.mood + 8, 0, 100);
    state.affection = clamp(state.affection + 3, 0, 100);
    addExp(state, 2);
    pushEvent(state, `被摸摸头，眯起了眼睛`, 'care');
    return { ok: true, msg: '（蹭了蹭你的手）', rewards: { exp: 2 } };
  }

  // 综合需求分（用于 UI 概览）
  function wellbeing(state) {
    const n = state.needs;
    return Math.round((n.hunger + n.hygiene + n.energy + n.mood) / 4);
  }

  const API = {
    RATE, tick, addExp, addCoins,
    feed, clean, sleep, play, petTouch, wellbeing, pushEvent
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { needs: API });
})(typeof window !== 'undefined' ? window : globalThis);
