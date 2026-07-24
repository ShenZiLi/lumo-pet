const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleLogs = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[ERROR] ${err.message}`));

  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('✅ 页面加载完成');

  // 1. 领养屏存在
  const adoptScreen = await page.$('#screen-adopt');
  console.log(adoptScreen ? '✅ 领养屏渲染' : '❌ 领养屏缺失');

  // 2. 宠物选项
  const choices = await page.$$('.pet-choice');
  console.log(`✅ 宠物选项: ${choices.length} 个`);

  // 3. 点击领养
  const adoptBtn = await page.$('#btn-adopt');
  if (adoptBtn) {
    await adoptBtn.click();
    await page.waitForTimeout(800);
    console.log('✅ 领养按钮可点击');
  }

  // 4. 主页出现
  const homeScreen = await page.$('#screen-home');
  const homeActive = await page.evaluate(() => document.getElementById('screen-home').classList.contains('active'));
  console.log(homeActive ? '✅ 主页已激活' : '❌ 主页未激活');

  // 5. 检查核心元素
  const elements = ['pet-body', 'bar-hunger', 'bar-hygiene', 'bar-energy', 'bar-mood', 'bar-affection',
    'pet-emoji', 'pet-name-top', 'pet-level', 'coin-num', 'speech'];
  for (const id of elements) {
    const el = await page.$('#' + id);
    console.log(el ? `  ✅ #${id}` : `  ❌ #${id} 缺失`);
  }

  // 6. 照料按钮
  const actions = await page.$$('.act');
  console.log(`✅ 照料按钮: ${actions.length} 个`);

  // 7. 底部导航
  const navBtns = await page.$$('.nav-btn');
  console.log(`✅ 导航按钮: ${navBtns.length} 个`);

  // 8. 点击喂食
  const feedBtn = await page.$('.act[data-act="feed"]');
  if (feedBtn) { await feedBtn.click(); await page.waitForTimeout(300); console.log('✅ 喂食按钮响应'); }

  // 9. 点击说话打开聊天
  const talkBtn = await page.$('.act[data-act="talk"]');
  if (talkBtn) { await talkBtn.click(); await page.waitForTimeout(500); }
  const chatVisible = await page.evaluate(() => !document.getElementById('chat').classList.contains('hidden'));
  console.log(chatVisible ? '✅ 聊天浮层打开' : '❌ 聊天未打开');

  // 10. 发送消息
  if (chatVisible) {
    await page.fill('#chat-text', '你好，我叫测试员');
    await page.click('#chat-send');
    await page.waitForTimeout(800);
    const msgs = await page.$$('.msg');
    console.log(`✅ 聊天消息: ${msgs.length} 条`);
  }

  // 11. 关闭聊天，切到设置
  const closeChat = await page.$('#chat-close');
  if (closeChat) { await closeChat.click(); await page.waitForTimeout(300); }

  // 12. 切到商店
  await page.evaluate(() => { document.querySelector('.nav-btn[data-nav="shop"]').click(); });
  await page.waitForTimeout(500);
  const shopCards = await page.$$('.shop-card');
  console.log(`✅ 商店商品: ${shopCards.length} 个`);

  // 13. 切到记忆
  await page.evaluate(() => { document.querySelector('.nav-btn[data-nav="memory"]').click(); });
  await page.waitForTimeout(500);
  const diaryActive = await page.evaluate(() => document.getElementById('mem-diary').classList.contains('active'));
  console.log(diaryActive ? '✅ 日记面板激活' : '❌ 日记未激活');

  // 14. 切到设置
  await page.evaluate(() => { document.querySelector('.nav-btn[data-nav="settings"]').click(); });
  await page.waitForTimeout(500);
  const personaBars = await page.$('#persona-bars');
  console.log(personaBars ? '✅ 人格条渲染' : '❌ 人格条缺失');

  // 15. JS 错误
  const errors = consoleLogs.filter(l => l.startsWith('[ERROR]'));
  if (errors.length > 0) {
    console.log(`⚠️ JS 运行时错误: ${errors.length} 条`);
    errors.slice(0, 5).forEach(e => console.log('  ', e));
  } else {
    console.log('✅ 无 JS 运行时错误');
  }

  // 16. Lumo 全局对象
  const hasLumo = await page.evaluate(() => typeof window.Lumo !== 'undefined');
  console.log(hasLumo ? '✅ Lumo 全局对象存在' : '❌ Lumo 缺失');

  await browser.close();
  console.log('\n🎉 浏览器端冒烟测试完成');
})();
