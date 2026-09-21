const CACHE='fluidite-v14-garmin-sans-friction';
const ASSETS=['./','./index.html','./styles.css?v=v2112','./app.js?v=v14','./db.js?v=v211','./garmin-health-v212.js?v=v14','./garmin-health-v212.css?v=v14','./manifest.webmanifest','./icon-192.png','./icon-512.png','./force-detail-step1.js','./force-detail-step1.css','./nutrition-resilience.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.startsWith('/.netlify/functions/'))return;
  const isCore=url.pathname==='/'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/app.js')||url.pathname.endsWith('/db.js')||url.pathname.endsWith('/styles.css');
  if(isCore){
    event.respondWith(fetch(req,{cache:'no-store'}).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return resp}).catch(()=>caches.match(req).then(x=>x||caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return resp})));
});
