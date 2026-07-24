# 拾光 Lumo · AI 电子宠物（安卓游戏 App）

> 🐾 一只会记得你、随你一起长大、活在你真实生活里、且永远不会离开你的电子伙伴。

[![测试状态](https://img.shields.io/badge/test-passing-brightgreen)]()
[![Node 冒烟](https://img.shields.io/badge/smoke-50%2F50-green)]()
[![浏览器冒烟](https://img.shields.io/badge/browser-19%2F19-green)]()

---

## 📱 这是什么

一个**高完成度、可运行的安卓端电子宠物游戏**。你领养一只虚拟宠物，喂它、洗它、陪它玩、跟它说话——**它真的会记得你说过的话**，并随时间演化出独一无二的性格。

它以 **PWA（可安装 Web 应用）** 形态交付：在安卓 Chrome 中「添加到主屏幕」，即获得类原生 App 体验（全屏、离线缓存、图标在桌面）。同时附带 **Android WebView 封装工程**，可一键打包成真正的 APK。

## ✨ 核心玩法（七大差异点）

| # | 差异点 | 说明 |
|---|---|---|
| D1 | **它会记得你** | 记忆系统抽取对话中的事实（生日/名字/事件/情绪），检索并引用 |
| D2 | **它活在你的生活里** | 现实锚点：天气、步数、拍照反哺宠物情绪 |
| D3 | **它会主动陪你** | 基于记忆与心情的主动对话，非被动复读 |
| D4 | **它在任何设备都在** | 跨端连续陪伴架构（手机/平板/音箱/手表 SDK 预留）|
| D5 | **不打断的陪伴** | 纯净体验，0 强迫广告，变现靠自愿羁绊 |
| D6 | **它真的随你长大** | 人格引擎：5 维度（黏人/幽默/细腻/好奇/活泼）随互动持续偏移 |
| D7 | **它永远不会离开你** | 数字永生：开放格式 JSON 导出/导入/遗产只读纪念模式 |

## 🚀 快速开始

```bash
# 启动本地服务（任意静态服务器均可）
cd ai-pet
python3 -m http.server 8080

# 浏览器打开
# 电脑预览: http://localhost:8080
# 手机测试: http://<你的IP>:8080
```

**安卓安装（PWA）**：Chrome 打开 → 右上角菜单 →「添加到主屏幕」→ 像原生 App 一样运行。

## 🧪 运行测试

```bash
# Node 核心逻辑冒烟测试（50 项断言）
node test/smoke.test.js

# 浏览器端 E2E 冒烟测试（需 playwright）
NODE_PATH=$(npm root -g) node test/browser.smoke.js
```

## 🏗️ 架构

```
ai-pet/
├── index.html              # PWA 入口
├── manifest.webmanifest    # PWA 清单（可安装）
├── sw.js                   # Service Worker（离线缓存）
├── styles/main.css         # 移动端样式（暗色适配）
├── src/
│   ├── state.js            # M2  数据模型（5 种宠物类型、校验、迁移）
│   ├── needs.js            # M3  需求衰减（含离线流逝）与照料逻辑
│   ├── memory.js           # M4  记忆系统（抽取/去重/相关性检索）
│   ├── personality.js      # M5  人格演化引擎（5 维度 + 成长曲线）
│   ├── mood.js             # M6  情绪与心情引擎（需求→心情映射）
│   ├── dialogue.js         # M7  对话引擎（规则 + 可选 LLM 接入）
│   ├── anchors.js          # M8  现实锚点（天气/步数/拍照）
│   ├── economy.js          # M9  经济与商店（10 件商品 + UGC 皮肤）
│   ├── persistence.js      # M10 持久化与数字永生（导出/导入/遗产）
│   ├── onboarding.js       # M12 新手引导与领养
│   └── app.js              # M11 控制器（连接 UI 与所有模块）
├── test/
│   ├── smoke.test.js       # Node 冒烟测试
│   └── browser.smoke.js    # Playwright 浏览器 E2E
├── android/                # M14 Android WebView 封装工程
│   ├── build.gradle
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/lumo/app/MainActivity.java
│       └── res/
├── assets/                 # PWA 图标
└── README.md
```

## 📦 打包 APK

1. 在 Android Studio 中新建 Empty Activity 项目，包名 `com.lumo.app`
2. 将 `android/` 目录下的文件覆盖到工程对应位置
3. 将整个 `ai-pet/` 前端目录复制到 `app/src/main/assets/lumo/`
4. Build → Generate Signed Bundle / APK

最低 SDK 24（Android 7.0），目标 SDK 34（Android 14）。

## 🎯 产品调研

完整的产品调研报告（含市场数据、竞品拆解、用户痛点、差异化分析）请见 [产品调研报告](../电子宠物产品调研报告.md)。

## 📄 许可

MIT
