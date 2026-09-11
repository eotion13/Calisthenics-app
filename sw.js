const CACHE='calisthenics-coach-v5.3.0-flat-images';
const PREFIX='calisthenics-coach-';
const ASSETS=["./", "./index.html", "./app.js", "./styles.css", "./manifest.webmanifest", "./404.html", "./pistolSquat.png", "./external.webp", "./pistol.webp", "./split.webp", "./feetElevatedRow.png", "./gluteBridge.png", "./toesToBar.png", "./hang.webp", "./hollow.webp", "./wrists.webp", "./towelHang.png", "./sidePlank.webp", "./handstand.webp", "./row.webp", "./pushup.webp", "./warmup.webp", "./hangingLegRaise.png", "./dip.webp", "./declinePushup.png", "./pullup.webp", "./wallHspu.png", "./inclinePushup.png", "./kneeRaise.webp", "./scapPull.webp", "./scapPush.webp", "./circles.webp", "./pullupBand.webp", "./squat.png", "./pike.webp", "./pullapart.webp", "./pseudoPlanchePushup.png", "./bandRow.webp", "./elevatedPike.png", "./facePull.webp", "./assistedDips.png", "./icons/icon-192.png", "./icons/icon-512.png"];
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
