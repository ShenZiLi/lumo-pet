/*
 * Lumo · 现实锚点系统 (M8)
 * 时段、天气（open-meteo 免密）、步数、拍照互动；真实生活反哺宠物。
 */
(function (global) {
  'use strict';

  const S = (typeof module !== 'undefined' && module.exports) ? require('./state.js') : (global.Lumo && global.Lumo.state);
  const clamp = S.clamp;

  // 城市 → 坐标（默认）
  const CITY_COORDS = {
    Beijing: [39.9042, 116.4074], Shanghai: [31.2304, 121.4737], Guangzhou: [23.1291, 113.2644],
    Shenzhen: [22.5431, 114.0579], Chengdu: [30.5728, 104.0668], Hangzhou: [30.2741, 120.1551],
    Tokyo: [35.6762, 139.6503], NewYork: [40.7128, -74.0060], London: [51.5074, -0.1278],
    Singapore: [1.3521, 103.8198]
  };

  function mapWeatherCode(code) {
    if (code == null) return { cat: 'unknown', emoji: '🌡️', label: '未知', line: '今天天气怎样呀？' };
    if (code <= 1) return { cat: 'clear', emoji: '☀️', label: '晴', line: '今天阳光好暖，想和你一起晒会儿。' };
    if (code <= 3 || code === 45 || code === 48) return { cat: 'cloudy', emoji: '⛅', label: '多云', line: '云朵慢慢飘，陪你发呆正好。' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { cat: 'rain', emoji: '🌧️', label: '雨', line: '下雨了，我躲进你伞下好不好？' };
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return { cat: 'snow', emoji: '❄️', label: '雪', line: '下雪啦！好想和你堆个小雪人。' };
    if (code >= 95) return { cat: 'storm', emoji: '⛈️', label: '雷雨', line: '打雷不要怕，我陪着你。' };
    return { cat: 'cloudy', emoji: '🌤️', label: '多云', line: '今天天气不错。' };
  }

  // 拉取天气（需 fetch；浏览器可用，node 测试返回 null）
  async function fetchWeather(lat, lon) {
    if (typeof fetch !== 'function') return null;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
      const r = await fetch(url);
      const d = await r.json();
      if (d && d.current) {
        return { temp: d.current.temperature_2m, code: d.current.weather_code, ts: Date.now() };
      }
    } catch (e) { return null; }
    return null;
  }

  function coordsFor(city) { return CITY_COORDS[city] || CITY_COORDS.Beijing; }

  // 记录步数：今天步数影响宠物状态
  function recordSteps(state, steps, now) {
    now = now || Date.now();
    const dayKey = new Date(now).toISOString().slice(0, 10);
    if (state.anchors.lastStepsDate !== dayKey) {
      state.anchors.steps = 0;
      state.anchors.lastStepsDate = dayKey;
    }
    const added = Math.max(0, steps - state.anchors.steps);
    state.anchors.steps = steps;
    if (added > 0) {
      // 你多动，它也精神点
      state.needs.energy = clamp(state.needs.energy - Math.min(added / 2000, 6), 0, 100);
      state.needs.mood = clamp(state.needs.mood + Math.min(added / 3000, 5), 0, 100);
      state.affection = clamp(state.affection + Math.min(added / 5000, 3), 0, 100);
    }
    return added;
  }

  // 拍照互动：宠物对照片的反应（规则启发式）
  function reactToPhoto(state, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    const cap = String(opts.caption || '');
    if (/猫|狗|宠物|你/.test(cap)) return `这是你拍的呀？真好。我也在照片里就好了。`;
    if (/饭|吃|美食|蛋糕/.test(cap)) return `看起来好好吃！我馋了，你喂我一口嘛。`;
    if (/风景|云|海|山|日落|天空/.test(cap)) return `好漂亮…你眼里的世界，我也想看看。`;
    const pool = [
      `你拍的我都喜欢。`,
      `这张收到了，放进我们的回忆里。`,
      `（盯着照片看了好久）下次带我一起去好不好？`
    ];
    return pool[Math.floor(rnd() * pool.length)];
  }

  // 把现实锚点效果施加到宠物
  function applyAnchors(state, ctx) {
    ctx = ctx || {};
    if (ctx.weather && ctx.weather.code != null) {
      const w = mapWeatherCode(ctx.weather.code);
      if (w.cat === 'rain' || w.cat === 'snow') state.needs.mood = clamp(state.needs.mood + 2, 0, 100);
    }
    return state;
  }

  const API = { CITY_COORDS, mapWeatherCode, fetchWeather, coordsFor, recordSteps, reactToPhoto, applyAnchors };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else global.Lumo = Object.assign(global.Lumo || {}, { anchors: API });
})(typeof window !== 'undefined' ? window : globalThis);
