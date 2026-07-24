/*
 * Lumo · 新手引导与宠物领养 (M12)
 */
(function (global) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports) ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const P = (typeof module !== 'undefined' && module.exports) ? require('./personality.js') : (global.Lumo && global.Lumo.personality);

  // 领养一只新宠物
  function adopt(typeId, name, now) {
    const st = S.createState({ typeId: typeId, name: name, now: now });
    st.events.push({ ts: now || Date.now(), text: `你领养了${st.pet.name}，故事开始了 ✨`, kind: 'milestone' });
    return st;
  }

  // 是否新用户
  function isNewUser(hasSaveFn) { return !hasSaveFn(); }

  // 开场白
  function firstGreeting(state) {
    return `嗨，我是${state.pet.name}。以后你的开心和难过，我都想陪着。要记得常来找我哦。`;
  }

  // 教程步骤
  function tutorial() {
    return [
      { icon: '🍖', title: '喂饱它', text: '点「喂食」让它不饿。饥饿条掉了要及时补。' },
      { icon: '🚿', title: '洗香香', text: '卫生条低了就「洗澡」，干净它才舒服。' },
      { icon: '🎮', title: '陪它玩', text: '「玩耍」能加心情和亲密度，但别让它太累。' },
      { icon: '💬', title: '跟它说话', text: '它真的会记住你说过的话——试试告诉它你的名字或重要的日子。' },
      { icon: '🌤️', title: '连进你的生活', text: '授权天气/步数，它会在雨天想躲你伞下，你多走它也精神。' },
      { icon: '💾', title: '它是你的', text: '随时可导出宠物档案。就算哪天不在了，回忆也一直在你手里。' }
    ];
  }

  const API = { adopt, isNewUser, firstGreeting, tutorial };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { onboarding: API });
})(typeof window !== 'undefined' ? window : globalThis);
