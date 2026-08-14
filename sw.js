const CACHE='fluidite-v2.10.5.2-force-return';
const ASSETS=['./','./index.html','./styles.css','./app.js?v=v2105','./db.js?v=v2105','./manifest.webmanifest','./icon-192.png','./icon-512.png','./force-detail-step1.js','./force-detail-step1.css','./nutrition-resilience.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match('./index.html'))));});

// Build V2.10.5 nutrition quick actions
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== 'fluidite-v2.10.5.2-force-return').map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
