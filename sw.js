const CACHE='calisthenics-coach-v5.3.0';
const PREFIX='calisthenics-coach-';
const ASSETS=["./", "./index.html", "./app.js", "./styles.css", "./manifest.webmanifest", "./404.html", "./assets/exercises/pistolSquat.png", "./assets/exercises/external.webp", "./assets/exercises/pistol.webp", "./assets/exercises/split.webp", "./assets/exercises/feetElevatedRow.png", "./assets/exercises/gluteBridge.png", "./assets/exercises/toesToBar.png", "./assets/exercises/hang.webp", "./assets/exercises/hollow.webp", "./assets/exercises/wrists.webp", "./assets/exercises/towelHang.png", "./assets/exercises/sidePlank.webp", "./assets/exercises/handstand.webp", "./assets/exercises/row.webp", "./assets/exercises/pushup.webp", "./assets/exercises/warmup.webp", "./assets/exercises/hangingLegRaise.png", "./assets/exercises/dip.webp", "./assets/exercises/declinePushup.png", "./assets/exercises/pullup.webp", "./assets/exercises/wallHspu.png", "./assets/exercises/inclinePushup.png", "./assets/exercises/kneeRaise.webp", "./assets/exercises/scapPull.webp", "./assets/exercises/scapPush.webp", "./assets/exercises/circles.webp", "./assets/exercises/pullupBand.webp", "./assets/exercises/squat.png", "./assets/exercises/pike.webp", "./assets/exercises/pullapart.webp", "./assets/exercises/pseudoPlanchePushup.png", "./assets/exercises/bandRow.webp", "./assets/exercises/elevatedPike.png", "./assets/exercises/facePull.webp", "./assets/exercises/assistedDips.png", "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const relative='./'+url.pathname.slice(scope.pathname.length);
 if(event.request.mode==='navigate'){
  // Keep shell and assets on one version; a waiting worker takes over after all tabs close.
  event.respondWith(caches.open(CACHE).then(async c=>(await c.match('./index.html'))||(await fetch(event.request))));return;
 }
 if(!ASSETS.includes(relative))return;
 event.respondWith(caches.open(CACHE).then(async c=>{
  const hit=await c.match(event.request);if(hit)return hit;
  const response=await fetch(event.request);if(response.ok)await c.put(event.request,response.clone());return response;
 }));
});
