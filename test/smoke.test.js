/*
 * Lumo · Node 冒烟测试 (覆盖 M2-M10, M12)
 * 运行: node test/smoke.test.js
 */
'use strict';
const assert = require('assert');

const S = require('../src/state.js');
const N = require('../src/needs.js');
const M = require('../src/memory.js');
const P = require('../src/personality.js');
const MO = require('../src/mood.js');
const D = require('../src/dialogue.js');
const A = require('../src/anchors.js');
const E = require('../src/economy.js');
const PE = require('../src/persistence.js');
const OB = require('../src/onboarding.js');

let pass = 0;
function ok(cond, msg) { assert.ok(cond, msg); pass++; }

// ---- M2 状态 ----
let st = OB.adopt('blob', '团团', Date.now());
ok(st.pet.name === '团团', 'M2 领养命名');
ok(S.PET_TYPES.blob, 'M2 宠物类型存在');
ok(PE.isArchive(st) === false, 'M2 非遗产态');

// ---- M3 衰减与照料 ----
const t0 = st.lastTick;
st.needs.hunger = 100;
N.tick(st, t0 + 3600 * 1000 * 10);
ok(st.needs.hunger < 100 && st.needs.hunger > 30, 'M3 10h 饥饿衰减');
const fr = N.feed(st); ok(fr.ok && st.needs.hunger > 50, 'M3 喂食');
const cl = N.clean(st); ok(cl.ok && st.needs.hygiene > 50, 'M3 清洁');
const sl = N.sleep(st); ok(sl.ok && st.needs.energy > 50, 'M3 睡觉');
const pl = N.play(st); ok(pl.ok, 'M3 玩耍');
const pt = N.petTouch(st); ok(pt.ok && st.affection > 30, 'M3 抚摸加亲密度');
ok(st.coins >= 50, 'M3 金币初始');
ok(N.wellbeing(st) >= 0 && N.wellbeing(st) <= 100, 'M3 wellbeing 范围');

// ---- M4 记忆 ----
const added = M.commit(st, '我叫团团的主人，我妈生日是3月8日，今天好累', Date.now());
ok(M.hasFact(st, 'birthday'), 'M4 生日抽取');
ok(M.hasFact(st, 'name_self'), 'M4 名字抽取');
ok(st.memories.some(m => m.type === 'emotion' && m.sentiment === 'neg'), 'M4 情绪(累)抽取');
const rel = M.retrieve(st, '妈妈 生日 3月');
ok(rel.some(m => m.type === 'fact'), 'M4 相关性检索命中');
// 同 key 去重
M.commit(st, '我妈生日是3月8日又说了一次', Date.now());
ok(st.memories.filter(m => m.type === 'fact' && m.key === 'birthday').length === 1, 'M4 同 key 去重');

// ---- M5 人格 ----
const c0 = st.personality.clingy;
P.fromInteraction(st, { action: 'pet' });
ok(st.personality.clingy > c0, 'M5 抚摸→黏人↑');
const s0 = st.personality.sensitive;
P.fromInteraction(st, { action: 'talk', userSentiment: 'neg' });
ok(st.personality.sensitive > s0, 'M5 负面对话→细腻↑');
P.recordHistory(st, Date.now());
ok(st.personalityHistory.length >= 1, 'M5 成长曲线记录');
ok(P.dominant(st).label, 'M5 主导特质');
ok(typeof P.describe(st) === 'string', 'M5 描述');

// ---- M6 心情 ----
ok(MO.compute(st, { userSentiment: 'neg' }).key === 'comfort', 'M6 用户低落→想陪你');
ok(MO.MOODS[MO.compute(st, {}).key], 'M6 心情 key 有效');
ok(MO.weatherCategory(0) === 'clear' && MO.weatherCategory(95) === 'storm', 'M6 天气分类');
ok(typeof MO.line(st, {}) === 'string', 'M6 心情短语');

// ---- M7 对话 ----
const r1 = D.reply(st, '你还记得我妈生日吗？', { now: Date.now(), rnd: () => 0.1 });
ok(r1.usedMemory && /记得/.test(r1.text), 'M7 记得你（生日）');
const r2 = D.reply(st, '今天好难过', { now: Date.now(), rnd: () => 0.2 });
ok(r2.sentiment === 'neg', 'M7 共情负面');
const r3 = D.reply(st, '我好开心呀', { now: Date.now(), rnd: () => 0.3 });
ok(r3.sentiment === 'pos', 'M7 正面');
const r4 = D.reply(st, '你好', { now: new Date(2024, 0, 1, 9).getTime(), rnd: () => 0.4 });
ok(/早|早上|起床/.test(r4.text), 'M7 早晨问候');
ok(typeof D.proactive(st, { now: Date.now() }) === 'string', 'M7 主动消息');

// ---- M8 锚点 ----
ok(A.mapWeatherCode(0).cat === 'clear', 'M8 晴');
ok(A.mapWeatherCode(61).cat === 'rain', 'M8 雨');
ok(A.mapWeatherCode(75).cat === 'snow', 'M8 雪');
const stepsBefore = st.anchors.steps;
A.recordSteps(st, 5000, Date.now());
ok(st.anchors.steps === 5000, 'M8 步数记录');
ok(A.reactToPhoto(st, { caption: '和猫在一起' }).length > 0, 'M8 拍照反应');
A.applyAnchors(st, { weather: { code: 61 } });
ok(st.needs.mood >= 0, 'M8 天气锚点施加');

// ---- M9 经济 ----
st.coins = 200;
const b1 = E.buy(st, 'food_fish'); ok(b1.ok && st.coins === 190, 'M9 买食物');
ok((st.inventory.food_fish || 0) === 1, 'M9 食物入库存');
const u1 = E.use(st, 'food_fish'); ok(u1.ok && (st.inventory.food_fish || 0) === 0, 'M9 用食物');
const b2 = E.buy(st, 'skin_sunset'); ok(b2.ok && st.equipped.skin === 'sunset', 'M9 买并装备皮肤');
const cs = E.createCustomSkin(st, '晚风', '#88CCFF'); ok(cs.ok && st.equipped.skin === cs.skin.id, 'M9 UGC 皮肤');
st.coins = 5; // 故意耗尽，测试拒绝
const b3 = E.buy(st, 'food_fish'); ok(!b3.ok, 'M9 金币不足时拒绝');

// ---- M10 持久化与永生 ----
ok(PE.save(st) === true, 'M10 存档');
ok(PE.hasSave(), 'M10 有存档');
const loaded = PE.load();
ok(loaded && loaded.pet.name === '团团', 'M10 读档一致');
const exp = PE.exportJSON(st);
ok(/lumo/.test(exp) && /"state"/.test(exp), 'M10 导出含元数据');
const imp = PE.importJSON(exp);
ok(imp.pet.name === '团团', 'M10 导入还原');
const arc = PE.toArchive(st);
ok(PE.isArchive(arc) === true, 'M10 遗产态');

// ---- M12 引导 ----
ok(OB.firstGreeting(st).indexOf('团团') >= 0, 'M12 开场白');
ok(OB.tutorial().length === 6, 'M12 教程步数');

console.log(`\n✅ 全部冒烟测试通过 (${pass} 项断言)`);
