const CACHE='fluidite-force-full-visual-library';
const ASSETS=['./','./index.html','./styles.css','./app.js','./db.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./force-detail-step1.js','./force-detail-step1.css','./nutrition-resilience.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match('./index.html'))));});

// Build 0.7.4.1 anti-cache
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== 'luis-build-0.7.4.1-force-refresh').map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
