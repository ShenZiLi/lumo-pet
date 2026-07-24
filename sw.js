const CACHE = 'lumo-v1';
const URLS = ['./', 'index.html', 'styles/main.css', 'manifest.webmanifest',
  'src/state.js', 'src/needs.js', 'src/memory.js', 'src/personality.js', 'src/mood.js',
  'src/dialogue.js', 'src/anchors.js', 'src/economy.js', 'src/persistence.js', 'src/onboarding.js', 'src/app.js',
  'assets/icon-192.png', 'assets/icon-512.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(URLS)).catch(() => {}));
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('离线模式')))
  );
});
