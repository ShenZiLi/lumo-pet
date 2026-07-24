/*
 * Lumo · 记忆系统 (M4)
 * 从用户对话抽取事实/事件/情绪，结构化存储并支持相关性检索。
 */
(function (global) {
  'use strict';

  let _seq = 0;
  function uid() { _seq += 1; return 'm' + Date.now().toString(36) + '_' + _seq; }

  // —— 情感词典 ——
  const EMOTION_LEX = {
    pos: ['开心', '高兴', '快乐', '兴奋', '幸福', '喜欢', '爱', '舒服', '放松', '满足', '期待', '甜蜜', '温暖', '想你'],
    neg: ['难过', '伤心', '哭', '累', '疲惫', '焦虑', '孤独', '寂寞', '生气', '烦', '压力', '害怕', '担心', '想家', '委屈', '失眠']
  };

  function tokenize(text) {
    const t = String(text || '');
    const ascii = (t.match(/[a-zA-Z0-9]+/g) || []).map(s => s.toLowerCase());
    const cn = t.replace(/[a-zA-Z0-9\s]/g, '');
    const grams = [];
    for (let i = 0; i < cn.length - 1; i++) grams.push(cn.slice(i, i + 2));
    if (cn.length === 1) grams.push(cn);
    return grams.concat(ascii);
  }

  // —— 抽取：生日/名字/年龄/情绪/事件 ——
  function analyze(text) {
    const out = { facts: [], emotions: [], events: [] };
    const t = String(text || '');

    // 生日：X月X日 / X/X
    const bday = t.match(/(?:我|我妈|我妈妈|我爸|我爸爸|我狗|我猫)?(?:的)?\s*生日\s*(?:是|为)?\s*(\d{1,2})\s*[月/\-.\s]\s*(\d{1,2})/);
    if (bday) {
      out.facts.push({ key: 'birthday', label: '生日', value: `${bday[1]}月${bday[2]}日`, month: +bday[1], day: +bday[2], salience: 0.95 });
    }

    // 名字：我叫X / 我的名字是X
    const selfName = t.match(/(?:我\s*(?:叫|的名字是)|我的名字是)\s*([\u4e00-\u9fa5A-Za-z·]{1,10})/);
    if (selfName) out.facts.push({ key: 'name_self', label: '你的名字', value: selfName[1], salience: 0.9 });

    // 亲友/宠物名字：我妈叫X
    const relName = t.match(/(我(?:妈妈|老妈|妈|爸爸|老爸|爹|外婆|奶奶|爷爷|猫|狗|宠物|儿子|女儿))\s*(?:叫|的名字是)\s*([\u4e00-\u9fa5A-Za-z·]{1,10})/);
    if (relName) out.facts.push({ key: 'name_' + relName[1], label: relName[1] + '的名字', value: relName[2], salience: 0.8 });

    // 年龄
    const age = t.match(/我\s*(\d{1,2})\s*岁/);
    if (age) out.facts.push({ key: 'age', label: '你的年龄', value: age[1] + '岁', salience: 0.6 });

    // 情绪
    EMOTION_LEX.pos.forEach(w => { if (t.indexOf(w) >= 0) out.emotions.push({ word: w, sentiment: 'pos', salience: 0.6 }); });
    EMOTION_LEX.neg.forEach(w => { if (t.indexOf(w) >= 0) out.emotions.push({ word: w, sentiment: 'neg', salience: 0.7 }); });

    // 事件：较长且含叙述标记的视为事件
    if (t.length >= 8 && /(了|今天|昨天|去|和|因为|所以|刚|正在)/.test(t)) {
      out.events.push({ text: t.slice(0, 120), salience: 0.5 });
    }
    return out;
  }

  // 将抽取结果写入 state.memories（去重：同类 key 仅保留最新）
  function commit(state, text, now) {
    now = now || Date.now();
    const a = analyze(text);
    const added = [];

    a.facts.forEach(f => {
      // 同 key 记忆只保留最新一条
      state.memories = state.memories.filter(m => !(m.type === 'fact' && m.key === f.key));
      const entry = {
        id: uid(), type: 'fact', key: f.key, label: f.label, value: f.value,
        text: `${f.label}：${f.value}`, tags: tokenize(f.value).concat(tokenize(f.label)),
        salience: f.salience, ts: now, extra: { month: f.month, day: f.day }
      };
      state.memories.push(entry); added.push(entry);
    });

    a.emotions.forEach(e => {
      const entry = {
        id: uid(), type: 'emotion', word: e.word, sentiment: e.sentiment,
        text: `你说过你${e.word}`, tags: [e.word], salience: e.salience, ts: now, extra: {}
      };
      state.memories.push(entry); added.push(entry);
      // 情绪也记入事件日记
      state.events.push({ ts: now, text: `你提到自己${e.word}`, kind: 'emotion' });
    });

    a.events.forEach(ev => {
      const entry = {
        id: uid(), type: 'event', text: ev.text, tags: tokenize(ev.text),
        salience: ev.salience, ts: now, extra: {}
      };
      state.memories.push(entry); added.push(entry);
    });

    // 记忆上限保护
    if (state.memories.length > 500) {
      state.memories.sort((x, y) => y.salience - x.salience || y.ts - x.ts);
      state.memories = state.memories.slice(0, 500);
    }
    return added;
  }

  // 相关性检索：salience + 时间衰减 + 关键词重叠
  function retrieve(state, query, opts) {
    opts = opts || {};
    const topN = opts.limit || 5;
    const qTokens = new Set(tokenize(query));
    const now = opts.now || Date.now();
    const scored = state.memories.map(m => {
      let overlap = 0;
      (m.tags || []).forEach(tg => { if (qTokens.has(tg)) overlap += 1; });
      // 即使无 query，也按显著性+新鲜度给基础分
      const ageDays = (now - m.ts) / 86400000;
      const recency = Math.max(0, 1 - ageDays / 30);
      const score = m.salience * 1.2 + overlap * 1.5 + recency * 0.8;
      return { m, score, overlap };
    }).sort((a, b) => b.score - a.score);
    return scored.slice(0, topN).map(s => s.m);
  }

  // 取某类记忆（如所有 fact）
  function byType(state, type) { return state.memories.filter(m => m.type === type); }

  // 是否记得某个 key
  function hasFact(state, key) { return state.memories.some(m => m.type === 'fact' && m.key === key); }

  // 临近生日的记忆（用于主动提醒）
  function upcomingBirthday(state, now) {
    now = now || Date.now();
    const d = new Date(now);
    return state.memories.find(m => m.type === 'fact' && m.key === 'birthday' && m.extra && m.extra.month);
  }

  const API = { analyze, commit, retrieve, byType, hasFact, upcomingBirthday, tokenize, uid };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { memory: API });
})(typeof window !== 'undefined' ? window : globalThis);
