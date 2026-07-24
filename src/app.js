/*
 * Lumo · 控制器 (app.js)
 * 连接 UI 与所有核心模块：领养/照料/对话/记忆/商店/设置/永生/现实锚点/拍照
 */
(function () {
  'use strict';

  const S = Lumo.state, N = Lumo.needs, M = Lumo.memory, P = Lumo.personality,
        MO = Lumo.mood, D = Lumo.dialogue, A = Lumo.anchors, E = Lumo.economy,
        PE = Lumo.persistence, OB = Lumo.onboarding;

  let game = null;      // 当前 state
  let currentScreen = 'adopt';
  let autoSaveTimer = null;
  let tickTimer = null;
  let weatherCache = null;

  // ====== DOM 辅助 ======
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const isHidden = (el) => el && el.classList.contains('hidden');

  // ====== Toast ======
  function toast(msg, ms) {
    const el = $('#toast'); el.textContent = msg; show(el);
    clearTimeout(el._to); el._to = setTimeout(() => hide(el), ms || 1800);
  }

  // ====== 屏幕切换 ======
  function goScreen(name) {
    $$('.screen.active').forEach(s => s.classList.remove('active'));
    const target = $('#screen-' + name);
    if (target) target.classList.add('active');
    currentScreen = name;
    // 底部导航同步
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
    $$('.mtab').forEach(b => b.classList.toggle('active', false));
    if (name === 'home') { updateAll(); } else if (name === 'shop') { renderShop(); } else if (name === 'memory') { renderMemory('diary'); } else if (name === 'settings') { renderSettings(); }
  }

  // ====== 保存 ======
  function save() { if (game) PE.save(game); }

  // ====== 时间推进 ======
  function tick() { if (!game) return; N.tick(game, Date.now()); P.recordHistory(game, Date.now()); save(); updateAll(); }

  // ====== 刷新 UI ======
  function updateAll() {
    if (!game || currentScreen !== 'home') return;
    updateBars();
    updateMood();
    updateSpeech();
    updateWeatherBadge();
    $('#pet-name-top').textContent = game.pet.name;
    $('#pet-level').textContent = 'Lv.' + game.level;
    $('#coin-num').textContent = game.coins;
    const type = S.getPetType(game.pet.typeId);
    $('#pet-emoji').textContent = type.emoji;
    const skinColor = getEquippedColor();
    $('#pet-body').textContent = type.emoji;
    if (skinColor) $('#pet-body').style.color = skinColor;
  }
  function getEquippedColor() {
    if (!game) return null;
    const sid = game.equipped.skin;
    if (!sid || sid === 'default') return S.getPetType(game.pet.typeId).color;
    // 查商品
    const item = E.getItem(sid);
    if (item && item.effect && item.effect.color) return item.effect.color;
    // 查自定义皮肤
    const customs = E.customSkins(game);
    const cs = customs.find(s => s.id === sid);
    if (cs) return cs.color;
    return S.getPetType(game.pet.typeId).color;
  }

  function updateBars() {
    const n = game.needs;
    const bars = { hunger: $('#bar-hunger'), hygiene: $('#bar-hygiene'), energy: $('#bar-energy'), mood: $('#bar-mood'), affection: $('#bar-affection') };
    const keys = { hunger: n.hunger, hygiene: n.hygiene, energy: n.energy, mood: n.mood, affection: game.affection };
    Object.keys(bars).forEach(k => {
      const v = keys[k];
      const b = bars[k]; if (!b) return;
      b.style.width = v + '%';
      b.style.background = v < 30 ? 'var(--bad)' : v < 50 ? 'var(--warn)' : v < 70 ? 'var(--accent)' : 'var(--good)';
    });
  }
  function updateMood() {
    const ctx = { userSentiment: null, weatherCode: weatherCache ? weatherCache.code : null, isNight: new Date().getHours() >= 22 || new Date().getHours() < 6 };
    const mk = MO.compute(game, ctx);
    $('#pet-mood').textContent = mk.emoji;
  }
  function updateSpeech() {
    const el = $('#speech'); if (!el) return;
    const line = MO.line(game, {}, Math.random);
    el.textContent = line; show(el);
    clearTimeout(el._hide); el._hide = setTimeout(() => hide(el), 6000);
  }
  function updateWeatherBadge() {
    const el = $('#weather-badge'); if (!el) return;
    if (weatherCache && weatherCache.code != null) {
      const w = A.mapWeatherCode(weatherCache.code);
      el.innerHTML = w.emoji + ' ' + w.label + ' ' + (weatherCache.temp != null ? Math.round(weatherCache.temp) + '°' : '');
    } else {
      el.innerHTML = '🌤️ 加载中';
    }
  }

  // ====== 领养流程 ======
  function initAdopt() {
    const choices = $('#pet-choices'); if (!choices) return;
    let sel = 'lumo';
    Object.values(S.PET_TYPES).forEach(t => {
      const div = document.createElement('div');
      div.className = 'pet-choice' + (t.id === 'lumo' ? ' sel' : '');
      div.innerHTML = `<div class="e">${t.emoji}</div><div class="n">${t.name}</div>`;
      div.addEventListener('click', () => {
        $$('.pet-choice').forEach(c => c.classList.remove('sel'));
        div.classList.add('sel'); sel = t.id;
      });
      choices.appendChild(div);
    });
    $('#btn-adopt').addEventListener('click', () => {
      const name = $('#pet-name').value.trim() || S.PET_TYPES[sel].name;
      game = OB.adopt(sel, name, Date.now());
      PE.save(game);
      toast('领养成功！✨');
      startGame();
    });
    $('#link-import').addEventListener('click', () => {
      importArchive();
    });
  }

  function startGame() {
    goScreen('home');
    updateAll();
    // 欢迎气泡
    const el = $('#speech');
    el.textContent = OB.firstGreeting(game); show(el);
    clearTimeout(el._hide); el._hide = setTimeout(() => hide(el), 8000);
    startAutoSave();
    startTick();
    startTutorial();
    fetchWeatherAnchor();
  }

  function startAutoSave() {
    clearInterval(autoSaveTimer);
    autoSaveTimer = setInterval(() => save(), 30000);
  }
  function startTick() {
    clearInterval(tickTimer);
    tickTimer = setInterval(() => tick(), 60000);
  }

  function startTutorial() {
    const steps = OB.tutorial(); let i = 0;
    function next() {
      if (i >= steps.length) return;
      const s = steps[i];
      toast(s.icon + ' ' + s.title + '：' + s.text, 4000); i++;
      setTimeout(next, 4200);
    }
    setTimeout(next, 1000);
  }

  // ====== 照料动作 ======
  function handleAction(act) {
    if (!game) return;
    tick(); // 先推进
    let result;
    switch (act) {
      case 'feed': result = N.feed(game); P.fromInteraction(game, { action: 'feed' }); break;
      case 'clean': result = N.clean(game); break;
      case 'sleep': result = N.sleep(game); break;
      case 'play': result = N.play(game); P.fromInteraction(game, { action: 'play' }); break;
      case 'pet': result = N.petTouch(game); P.fromInteraction(game, { action: 'pet' }); break;
      case 'talk': openChat(); return;
    }
    P.recordHistory(game, Date.now());
    save();
    updateAll();
    if (result && !result.ok) toast(result.msg);
    else if (result && result.msg) {
      const el = $('#speech'); el.textContent = result.msg; show(el);
      clearTimeout(el._hide); el._hide = setTimeout(() => hide(el), 3500);
    }
  }

  // ====== 聊天 ======
  function openChat() {
    const chat = $('#chat'); show(chat);
    $('#chat-title').textContent = '和 ' + game.pet.name + ' 说话';
    $('#chat-text').value = ''; $('#chat-text').focus();
    if ($('#chat-log').children.length === 0) {
      addMsg('pet', '你想说什么呀？我会好好听的～');
    }
  }
  function closeChat() { hide($('#chat')); }
  function addMsg(who, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + who; div.textContent = text;
    $('#chat-log').appendChild(div);
    $('#chat-log').scrollTop = $('#chat-log').scrollHeight;
  }
  function sendChat() {
    const inp = $('#chat-text'); const text = inp.value.trim();
    if (!text) return;
    addMsg('me', text);
    inp.value = '';
    // 提交记忆
    M.commit(game, text, Date.now());
    // 对话回复
    const r = D.reply(game, text, { now: Date.now(), rnd: Math.random });
    P.fromInteraction(game, { action: 'talk', userSentiment: r.sentiment });
    P.recordHistory(game, Date.now());
    N.addExp(game, 3);
    game.stats.talkCount += 1;
    save();
    addMsg('pet', r.text);
    updateAll();
  }

  // ====== 商店 ======
  function renderShop() {
    const list = $('#shop-list'); if (!list) return;
    list.innerHTML = '';
    $('#coin-num2').textContent = game.coins;
    E.CATALOG.forEach(item => {
      const div = document.createElement('div');
      div.className = 'shop-card';
      const owned = (game.inventory[item.id] || 0) > 0;
      const btnLabel = (item.type === 'skin' || item.type === 'furniture')
        ? (owned ? '已拥有' : '🛒 购买')
        : (owned ? `使用 (库存 ${game.inventory[item.id]})` : '🛒 购买');
      div.innerHTML = `
        <div class="se">${item.emoji}</div>
        <div class="sn">${item.name}</div>
        <div class="sd">${item.desc}</div>
        <div class="sp">🪙 ${item.price}</div>
        <button ${game.coins < item.price ? 'disabled' : ''}>${btnLabel}</button>
      `;
      div.querySelector('button').addEventListener('click', () => {
        if (owned) {
          const r = E.use(game, item.id);
          toast(r.msg); renderShop(); updateAll(); save();
        } else {
          const r = E.buy(game, item.id);
          if (r.ok) { toast(r.msg); renderShop(); updateAll(); save(); }
          else toast(r.msg);
        }
      });
      list.appendChild(div);
    });
  }

  // ====== 记忆 ======
  function renderMemory(tab) {
    $$('.mtab').forEach(b => b.classList.toggle('active', b.dataset.mtab === tab));
    $$('.mem-panel').forEach(p => p.classList.remove('active'));
    if (tab === 'diary') renderDiary();
    else if (tab === 'mem') renderMem();
    else if (tab === 'grow') renderGrow();
  }
  function renderDiary() {
    const panel = $('#mem-diary'); panel.classList.add('active');
    const evts = [...(game.events || [])].reverse().slice(0, 50);
    if (!evts.length) { panel.innerHTML = '<div class="empty">还没有事件，去跟它互动吧</div>'; return; }
    panel.innerHTML = evts.map(e => {
      const d = new Date(e.ts);
      return `<div class="diary-item"><div class="dt">${d.toLocaleString('zh-CN')}</div>${e.text}</div>`;
    }).join('');
  }
  function renderMem() {
    const panel = $('#mem-mem'); panel.classList.add('active');
    const mems = [...(game.memories || [])].sort((a,b) => b.ts - a.ts).slice(0, 50);
    if (!mems.length) { panel.innerHTML = '<div class="empty">它还在学习关于你的一切…去跟它说说话吧</div>'; return; }
    panel.innerHTML = mems.map(m => {
      const kind = { fact: '事实', emotion: '情绪', event: '事件' }[m.type] || m.type;
      return `<div class="mem-item"><div class="mt">[${kind}]</div>${m.text}</div>`;
    }).join('');
  }
  function renderGrow() {
    const panel = $('#mem-grow'); panel.classList.add('active');
    const delta = P.deltaFromStart(game);
    const desc = P.describe(game);
    const dom = P.dominant(game);
    const days = S.ageDays(game);
    panel.innerHTML = `
      <div class="mem-item"><b>🎂 它陪你 ${days} 天了</b></div>
      <div class="mem-item"><b>主导特质：${dom.label}</b></div>
      <div class="mem-item">当前人格：${desc}</div>
      <div class="mem-item">与领养时相比：${Object.entries(delta).map(([k,v])=>{
        const LABEL={clingy:'黏人',humor:'幽默',sensitive:'细腻',curious:'好奇',lively:'活泼'};
        return LABEL[k]+(v>=0?'+':'')+v;
      }).join(' · ')}</div>
    `;
  }

  // ====== 设置 ======
  function renderSettings() {
    if (!game) return;
    $('#set-notify').checked = game.settings.notifications;
    $('#set-city').value = game.settings.city;
    $('#set-llm').value = game.settings.llmKey || '';
    $('#set-steps').value = game.anchors.steps || '';
    // 人格条
    const pb = $('#persona-bars');
    const LABEL = { clingy: '黏人', humor: '幽默', sensitive: '细腻', curious: '好奇', lively: '活泼' };
    pb.innerHTML = S.PERSONALITY_DIMS.map(d =>
      `<div class="pb"><span>${LABEL[d]}</span><div class="bar"><i style="width:${Math.round(game.personality[d])}%"></i></div><span style="font-size:11px">${Math.round(game.personality[d])}</span></div>`
    ).join('');
  }
  function syncSettings() {
    if (!game) return;
    game.settings.notifications = $('#set-notify').checked;
    game.settings.city = $('#set-city').value;
    game.settings.llmKey = $('#set-llm').value.trim();
    save();
  }

  // ====== 现实锚点：天气 ======
  async function fetchWeatherAnchor() {
    if (!game) return;
    const city = game.settings.city || 'Beijing';
    const [lat, lon] = A.coordsFor(city);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const r = await fetch(url);
      const d = await r.json();
      if (d && d.current) {
        weatherCache = { temp: d.current.temperature_2m, code: d.current.weather_code, ts: Date.now() };
        game.anchors.weather = weatherCache;
        A.applyAnchors(game, { weather: weatherCache });
        updateWeatherBadge();
      }
    } catch (e) { /* 静默失败 */ }
  }

  // ====== 导出/导入/遗产 ======
  function exportArchive() {
    if (!game) return;
    const json = PE.exportJSON(game);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lumo-${game.pet.name}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('宠物档案已导出 ✅');
  }
  function importArchive() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.addEventListener('change', () => {
      const f = inp.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = PE.importJSON(reader.result);
          if (PE.isArchive(imported)) {
            // 遗产态：只读纪念
            if (!confirm('这是只读纪念档案。载入后将无法修改。确认载入？')) return;
          }
          game = imported;
          PE.save(game);
          toast('档案已导入 ✅');
          startGame();
        } catch (e) { toast('导���失败：' + e.message); }
      };
      reader.readAsText(f);
    });
    inp.click();
  }
  function makeArchive() {
    if (!game) return;
    if (!confirm('将当前宠物转为只读纪念模式（遗产态）。之后无法再互动，但档案永久保存。确认？')) return;
    game = PE.toArchive(game);
    PE.save(game);
    toast('已转为只读纪念模式 🕯️');
    exportArchive();
  }
  function resetGame() {
    if (!confirm('确定要重新领养吗？当前宠物数据将永久删除！')) return;
    PE.clear();
    game = null;
    weatherCache = null;
    location.reload();
  }

  // ====== 拍照 ======
  function openPhoto() { show($('#photo')); }
  function closePhoto() { hide($('#photo')); }

  // ====== 步数同步 ======
  function syncSteps() {
    const v = parseInt($('#set-steps').value, 10);
    if (!isNaN(v) && v >= 0) {
      A.recordSteps(game, v, Date.now());
      save(); updateAll();
      toast(`记录了 ${v} 步，它也精神了一点 🚶`);
    }
  }

  // ====== 事件绑定 ======
  function bindEvents() {
    // 照料按钮
    $$('.act').forEach(b => {
      b.addEventListener('click', () => handleAction(b.dataset.act));
    });
    // 底部导航
    $$('.nav-btn').forEach(b => {
      b.addEventListener('click', () => goScreen(b.dataset.nav));
    });
    // 后退
    $$('.back').forEach(b => {
      b.addEventListener('click', () => goScreen(b.dataset.nav || 'home'));
    });
    // 记忆标签
    $$('.mtab').forEach(b => {
      b.addEventListener('click', () => renderMemory(b.dataset.mtab));
    });
    // 聊天
    $('#chat-close').addEventListener('click', closeChat);
    $('#chat-send').addEventListener('click', sendChat);
    $('#chat-text').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
    // 设置变更
    $$('#screen-settings input, #screen-settings select').forEach(el => {
      el.addEventListener('change', syncSettings);
    });
    $('#set-steps').addEventListener('change', syncSteps);
    // 导出/导入/遗产/重置
    $('#btn-export').addEventListener('click', exportArchive);
    $('#btn-import').addEventListener('click', importArchive);
    $('#btn-archive').addEventListener('click', makeArchive);
    $('#btn-reset').addEventListener('click', resetGame);
    // 拍照
    $('#photo-close').addEventListener('click', closePhoto);
    $('#photo-file').addEventListener('change', function () {
      const f = this.files[0]; if (!f) return;
      const caption = f.name || '';
      const react = A.reactToPhoto(game, { caption: caption, rnd: Math.random });
      $('#photo-react').textContent = react;
      game.anchors.photoCount += 1;
      N.addExp(game, 5);
      N.addCoins(game, 3);
      P.fromInteraction(game, { action: 'photo' });
      P.recordHistory(game, Date.now());
      save();
      updateAll();
    });
    // 全局：触摸宠物身体加亲密度
    $('#pet-body').addEventListener('click', () => {
      handleAction('pet');
    });
    // 全局：点击天气徽章刷新天气
    $('#weather-badge').addEventListener('click', () => {
      fetchWeatherAnchor();
      toast('正在更新天气…');
    });
  }

  // ====== 启动 ======
  function boot() {
    bindEvents();
    // 检查存档
    if (PE.hasSave()) {
      const loaded = PE.load();
      if (loaded) {
        game = loaded;
        if (PE.isArchive(game)) {
          // 遗产态：显示领养屏但提示可导入
          $('#screen-adopt').querySelector('.adopt-note').textContent = '检测到只读纪念档案。你可以导入它来查看，或开始新的故事。';
          $$('.screen').forEach(s => s.classList.remove('active'));
          $('#screen-adopt').classList.add('active');
          return;
        }
        startGame();
        return;
      }
    }
    // 新用户：显示领养
    initAdopt();
  }

  // 定时刷新天气（每 30 分钟）
  setInterval(() => { if (game && currentScreen === 'home') fetchWeatherAnchor(); }, 30 * 60 * 1000);

  // 页面可见时推进 tick
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && game && currentScreen === 'home') {
      tick(); updateAll();
    }
  });

  boot();
  console.log('🐾 拾光 Lumo 已启动');
})();
