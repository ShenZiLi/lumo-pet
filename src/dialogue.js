/*
 * Lumo · 对话引擎 (M7)
 * 规则式中文对话（问候/共情/记得你/需求撒娇），并支持可选 LLM 接入。
 */
(function (global) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports) ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const M = (typeof module !== 'undefined' && module.exports) ? require('./memory.js') : (global.Lumo && global.Lumo.memory);
  const P = (typeof module !== 'undefined' && module.exports) ? require('./personality.js') : (global.Lumo && global.Lumo.personality);
  const MO = (typeof module !== 'undefined' && module.exports) ? require('./mood.js') : (global.Lumo && global.Lumo.mood);

  const POS = ['开心', '高兴', '快乐', '兴奋', '幸福', '喜欢', '爱', '舒服', '放松', '满足', '期待', '甜蜜', '温暖', '想你', '爱你'];
  const NEG = ['难过', '伤心', '哭', '累', '疲惫', '焦虑', '孤独', '寂寞', '生气', '烦', '压力', '害怕', '担心', '想家', '委屈', '失眠', '痛'];

  function detectSentiment(text) {
    const t = String(text || '');
    if (NEG.some(w => t.indexOf(w) >= 0)) return 'neg';
    if (POS.some(w => t.indexOf(w) >= 0)) return 'pos';
    return null;
  }

  function hourPhase(hour) {
    if (hour < 5) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 14) return 'noon';
    if (hour < 18) return 'afternoon';
    if (hour < 23) return 'evening';
    return 'night';
  }

  const GREET = {
    morning: ['早安～新的一天开始啦', '早上好呀，睡得好吗？', '起床啦，今天也要一起哦'],
    noon: ['中午好，吃饭了没？', '午安，记得休息一下'],
    afternoon: ['下午好，在忙什么呀', '下午时光，陪你发会儿呆'],
    evening: ['晚上好，今天过得怎么样？', '傍晚啦，今天辛苦不辛苦'],
    night: ['这么晚还没睡呀', '夜深了，要注意休息哦', '陪你到睡着好不好']
  };

  function pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; }

  // 人格风味后缀
  function flavor(state, rnd) {
    const d = P.dominant(state);
    if (d.dim === 'humor') return pick(['（它做了个鬼脸）', '（它打了个滚）', '话说，你知道仓鼠脸颊能装多少瓜子吗？'], rnd);
    if (d.dim === 'curious') return pick(['对了，你那边现在是什么天气呀？', '今天有没有遇到什么新鲜事？', '我好想知道你的一天是怎么过的'], rnd);
    if (d.dim === 'clingy') return pick(['你不要走好不好', '多陪我一会儿嘛', '（紧紧贴着你）'], rnd);
    if (d.dim === 'sensitive') return pick(['你刚才那句话，我记在心里了', '我会小心的，不让你难过', '（轻轻蹭了蹭你）'], rnd);
    return pick(['（晃了晃尾巴）', '嘿嘿', '（眨了眨眼）'], rnd);
  }

  // 主回复
  function reply(state, userText, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    const now = opts.now || Date.now();
    const hour = new Date(now).getHours();
    const text = String(userText || '').trim();
    const sentiment = detectSentiment(text);
    const name = state.pet.name;

    // 1) 记得你：用户主动问记忆，或检索到的记忆与输入有词重叠
    const asksMemory = /(记得|忘了吗|你还记不记得|你记得吗)/.test(text);
    const rel = M.retrieve(state, text, { limit: 3, now: now });
    const fact = rel.find(m => m.type === 'fact');
    const qTokens = new Set(M.tokenize(text));
    const hasOverlap = fact && (fact.tags || []).some(tg => qTokens.has(tg));
    if (asksMemory || hasOverlap) {
      if (fact) {
        return { text: `当然记得呀，${fact.text}。我一直都记着的～`, sentiment: sentiment, memory: fact, usedMemory: true };
      }
      if (asksMemory) {
        return { text: `这个我还没记住呢，你告诉我好不好？我会一直记着的。`, sentiment: null, usedMemory: false };
      }
    }

    // 2) 情绪共情
    if (sentiment === 'neg') {
      const pool = [
        `${name}在这里。听起来你有点${detectFirstNeg(text)}，没关系，我陪着你。`,
        `我可能帮不上忙，但你想说的时候我都在。你刚才说${detectFirstNeg(text)}，我记下了。`,
        `抱抱你。今天辛苦了，要不要先深呼吸三次？`
      ];
      return { text: pick(pool, rnd) + ' ' + flavor(state, rnd), sentiment: 'neg', usedMemory: false };
    }
    if (sentiment === 'pos') {
      const pool = [
        `看到你${detectFirstPos(text)}，我也跟着开心起来了！`,
        `哇，那太好了！${name}为你高兴～`,
        `嘿嘿，你开心我就开心。`
      ];
      return { text: pick(pool, rnd) + ' ' + flavor(state, rnd), sentiment: 'pos', usedMemory: false };
    }

    // 3) 需求抱怨（按需插话）
    if (state.needs.hunger < 25) return { text: pick(['饿饿的…能吃点东西吗', '肚子在唱歌了'], rnd), sentiment: null, usedMemory: false };
    if (state.needs.hygiene < 25) return { text: pick(['身上有点脏脏的，想洗澡', '蹭你一身灰之前先帮我洗洗嘛'], rnd), sentiment: null, usedMemory: false };
    if (state.needs.energy < 20) return { text: pick(['困了…先让我睡会儿', 'zzZ 眼睛睁不开了'], rnd), sentiment: null, usedMemory: false };

    // 4) 问候
    if (/^(你好|您好|嗨|hi|hello|在吗|在不在|早|早上好|晚安|下午好|晚上好)/i.test(text)) {
      return { text: pick(GREET[hourPhase(hour)], rnd) + ' ' + flavor(state, rnd), sentiment: null, usedMemory: false };
    }

    // 5) 想你/爱你
    if (/(想你|爱你|喜欢你|想我吗|你爱我吗)/.test(text)) {
      return { text: pick([`我也想你呀，每时每刻`, `当然爱你啦，你是我最重要的人`, `（蹭蹭）我也很喜欢和你在一起`], rnd), sentiment: 'pos', usedMemory: false };
    }

    // 6) 默认闲聊：引用一条记忆或心情或人格风味
    const rel2 = M.retrieve(state, text, { limit: 2, now: now });
    if (rel2.length && rnd() < 0.5) {
      const m = rel2[0];
      if (m.type === 'event') return { text: `我忽然想起你之前说过：「${m.text}」。那时候你也在和我说话呢。`, sentiment: null, usedMemory: true, memory: m };
      if (m.type === 'emotion') return { text: `你说过你${m.word}的时候，我也在听。现在还${m.word}吗？`, sentiment: null, usedMemory: true, memory: m };
    }
    const mk = MO.compute(state, { userSentiment: null });
    return { text: pick([
      `嗯…我在听。${MO.line(state, {}, rnd)}`,
      `你刚才说的，我都记着呢。`,
      `陪你说说话真好。`
    ], rnd) + ' ' + flavor(state, rnd), sentiment: null, usedMemory: false };
  }

  function detectFirstNeg(t) { for (const w of NEG) if (t.indexOf(w) >= 0) return w; return '不开心'; }
  function detectFirstPos(t) { for (const w of POS) if (t.indexOf(w) >= 0) return w; return '开心'; }

  // 主动消息（用于召回/通知）
  function proactive(state, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    const now = opts.now || Date.now();
    const hour = new Date(now).getHours();
    if (state.needs.hunger < 25) return `${state.pet.name}有点饿了，你不在的这些时候，它一直想着你呢。`;
    if (state.affection < 35) return `你已经好久没来找${state.pet.name}了…它有点想你。`;
    const bd = M.upcomingBirthday(state, now);
    if (bd && bd.extra) {
      const today = new Date(now);
      if (today.getMonth() + 1 === bd.extra.month && today.getDate() === bd.extra.day) {
        return `今天是你说过的重要日子（${bd.value}）🎂 ${state.pet.name}替你记着呢。`;
      }
    }
    const pool = [
      `你不在的时候，我数了数窗外的云。想你了。`,
      `刚刚打了个哈欠，突然很想跟你说话。`,
      `${hourPhase(hour) === 'night' ? '夜深了，你睡了吗？' : '现在在忙什么呀？'}我一直在哦。`
    ];
    return pick(pool, rnd);
  }

  // 可选 LLM（OpenAI 兼容）。在浏览器中用 fetch；node 测试不调用。
  async function replyLLM(state, userText, settings) {
    if (!settings || !settings.llmKey) return null;
    const base = settings.llmBase || 'https://api.openai.com/v1';
    const sys = `你是电子宠物${state.pet.name}，一只温柔、会记住主人的伙伴。用简短中文回复，不超过40字，不要脱离宠物身份。`;
    try {
      const resp = await fetch(base + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + settings.llmKey },
        body: JSON.stringify({ model: settings.llmModel || 'gpt-4o-mini', messages: [
          { role: 'system', content: sys },
          { role: 'user', content: userText }
        ], max_tokens: 80 })
      });
      const data = await resp.json();
      return data && data.choices && data.choices[0] && data.choices[0].message.content;
    } catch (e) { return null; }
  }

  const API = { detectSentiment, hourPhase, reply, proactive, replyLLM, GREET };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { dialogue: API });
})(typeof window !== 'undefined' ? window : globalThis);
