/*
 * Lumo · 经济与商店 (M9)
 * 金币、商品（食物/玩具/家具/皮肤）、购买与使用后效，含自定义皮肤(UGC)。
 */
(function (global) {
  'use strict';

  const N = (typeof module !== 'undefined' && module.exports) ? require('./needs.js') : (global.Lumo && global.Lumo.needs);
  const S = (typeof module !== 'undefined' && module.exports) ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const clamp = S.clamp;

  // 商品目录
  const CATALOG = [
    // 食物（消耗品）
    { id: 'food_fish', name: '小鱼干', type: 'food', emoji: '🐟', price: 10, effect: { hunger: 30 }, desc: '经典零食，管饱' },
    { id: 'food_cake', name: '草莓蛋糕', type: 'food', emoji: '🍰', price: 20, effect: { hunger: 22, mood: 10 }, desc: '甜甜的，心情+10' },
    { id: 'food_meal',  name: '营养餐', type: 'food', emoji: '🍱', price: 30, effect: { hunger: 45 }, desc: '一顿顶饱' },
    // 玩具（消耗品，用于玩耍）
    { id: 'toy_yarn',  name: '毛线球', type: 'toy', emoji: '🧶', price: 15, effect: { mood: 25 }, desc: '滚来滚去真好玩' },
    { id: 'toy_laser', name: '激光笔', type: 'toy', emoji: '🔦', price: 25, effect: { mood: 30, affection: 3 }, desc: '追着红点跑' },
    // 家具（一次性，可装备，改变家园）
    { id: 'furn_star',  name: '星空灯', type: 'furniture', emoji: '💡', price: 40, effect: { furniture: 'star' }, desc: '把房间变成银河' },
    { id: 'furn_rug',   name: '暖地毯', type: 'furniture', emoji: '🟫', price: 30, effect: { furniture: 'rug' }, desc: '踩上去软软的' },
    // 皮肤（一次性，可装备，改变外观）
    { id: 'skin_sunset', name: '晚霞', type: 'skin', emoji: '🌇', price: 50, effect: { skin: 'sunset', color: '#FF8C69' }, desc: '温柔橘色' },
    { id: 'skin_mint',   name: '薄荷', type: 'skin', emoji: '🌿', price: 50, effect: { skin: 'mint', color: '#7BE0C0' }, desc: '清新绿' },
    { id: 'skin_aurora', name: '极光', type: 'skin', emoji: '🌌', price: 80, effect: { skin: 'aurora', color: '#9B8CFF' }, desc: '梦幻紫' }
  ];

  function getItem(id) { return CATALOG.find(i => i.id === id) || null; }

  // 购买
  function buy(state, itemId) {
    const item = getItem(itemId);
    if (!item) return { ok: false, msg: '没有这个商品' };
    if (state.coins < item.price) return { ok: false, msg: '金币不够啦' };
    state.coins -= item.price;
    if (item.type === 'food' || item.type === 'toy') {
      state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    } else {
      // 皮肤/家具：拥有即可装备
      state.inventory[itemId] = 1;
      state.equipped[item.type] = item.effect[item.type] || item.effect.skin || item.effect.furniture;
    }
    N.addExp(state, 3);
    return { ok: true, msg: `买到了${item.name}！`, item: item };
  }

  // 使用（消耗品）
  function use(state, itemId) {
    const item = getItem(itemId);
    if (!item) return { ok: false, msg: '没有这个商品' };
    if (item.type === 'skin' || item.type === 'furniture') {
      state.equipped[item.type] = item.effect[item.type] || item.effect.skin || item.effect.furniture;
      return { ok: true, msg: `已换上${item.name}`, item: item };
    }
    if ((state.inventory[itemId] || 0) <= 0) return { ok: false, msg: '库存里没有啦' };
    state.inventory[itemId] -= 1;
    if (item.type === 'food') {
      const r = N.feed(state, { hunger: item.effect.hunger });
      if (item.effect.mood) state.needs.mood = clamp(state.needs.mood + item.effect.mood, 0, 100);
      return { ok: true, msg: r.msg, item: item };
    }
    if (item.type === 'toy') {
      const r = N.play(state, { mood: item.effect.mood });
      if (item.effect.affection) state.affection = clamp(state.affection + item.effect.affection, 0, 100);
      return { ok: r.ok, msg: r.msg, item: item };
    }
    return { ok: false, msg: '用不了' };
  }

  // 装备已拥有的皮肤/家具
  function equip(state, itemId) {
    const item = getItem(itemId);
    if (!item || (state.inventory[itemId] || 0) <= 0) return { ok: false, msg: '还没拥有' };
    state.equipped[item.type] = item.effect[item.type] || item.effect.skin || item.effect.furniture;
    return { ok: true, msg: `已装备${item.name}` };
  }

  // UGC 自定义皮肤
  function createCustomSkin(state, name, color) {
    state.settings.customSkins = state.settings.customSkins || [];
    const id = 'skin_custom_' + (state.settings.customSkins.length + 1);
    const skin = { id, name: name || ('自定义' + state.settings.customSkins.length), color: color || '#FFD479' };
    state.settings.customSkins.push(skin);
    state.inventory[id] = 1;
    state.equipped.skin = id;
    return { ok: true, msg: `创建了皮肤「${skin.name}」`, skin };
  }

  function customSkins(state) { return state.settings.customSkins || []; }

  const API = { CATALOG, getItem, buy, use, equip, createCustomSkin, customSkins };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { economy: API });
})(typeof window !== 'undefined' ? window : globalThis);
