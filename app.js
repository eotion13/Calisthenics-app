const STORE_KEY='calisthenicsCoach_v2';
const VERSION='2.0.0';
const todayISO=()=>new Date().toISOString().slice(0,10);
const fmt=(n,d=1)=>Number.isFinite(+n)?(+n).toFixed(d).replace(/\.0$/,''):'–';
const clone=o=>JSON.parse(JSON.stringify(o));

const defaultState={
  profile:{age:34,sex:'m',height:180,startWeight:87,bands:[10,20,30],sleepBaseline:'5–6',goal:'Maximale Kraft → Muskeln → shredded → Handstand-Skills'},
  settings:{calories:2300,protein:170,creatine:5,vacation:false},
  daily:{}, meals:{}, workouts:{}, measurements:[{date:'2026-09-07',weight:87,waist:null,pullups:2,dips:10,handstand:5,hang:45,hspu:0}],
  handstandPractice:{}, runs:{}, photos:{}, skillStages:{hspu:0,flag:0}, app:{version:VERSION}
};

function loadState(){
  try{
    const raw=localStorage.getItem(STORE_KEY); if(!raw) return clone(defaultState);
    const d=JSON.parse(raw);
    return {...clone(defaultState),...d,profile:{...defaultState.profile,...(d.profile||{})},settings:{...defaultState.settings,...(d.settings||{})},app:{version:VERSION}};
  }catch{return clone(defaultState)}
}
let state=loadState();
function saveState(render=true){localStorage.setItem(STORE_KEY,JSON.stringify(state)); if(render) renderAllDerived();}

const exercises={
  warmup:{name:'Warm-up Schulter & Ellbogen',cat:'Vorbereitung',prescription:'ca. 5 Min.',visual:'warmup',rest:30,cues:['Armkreisen 30–45 s je Richtung.','Band Pull-Aparts 2×15.','Band External Rotation 2×12 je Seite.','Scapular Pull-ups 2×5.','Scapular Push-ups 1×10.'],mistakes:['Warm-up bis zur Ermüdung treiben.','Bei Schmerz aggressiv in Endpositionen drücken.'],progress:'Ziel: warm und kontrolliert werden, nicht ermüden.'},
  handstandWall:{name:'Chest-to-wall Handstand',cat:'Handstand',prescription:'3×20–30 s',visual:'handstand',rest:60,cues:['Bauch und Po anspannen.','Rippen einziehen, Hohlkreuz vermeiden.','Schultern aktiv hochdrücken.','Blick zwischen die Hände.'],mistakes:['Bananenform.','Passiv in den Schultern hängen.'],progress:'3×40 s sauber → freie Balancearbeit priorisieren.'},
  kickups:{name:'Freie Handstand Kick-ups',cat:'Handstand',prescription:'5–8 kontrollierte Versuche',visual:'kickup',rest:30,cues:['Frisch und kontrolliert kicken.','Fingerspitzen aktiv zur Balance.','Beine zusammenführen und Spannung halten.'],mistakes:['Zu hart hochschießen.','Bei jedem Versuch bis zum Sturz kämpfen.'],progress:'Phase-1-Ziel: 10+ s reproduzierbar.'},
  pullup:{name:'Strikte Pull-ups',cat:'Pull',prescription:'1×1–2 sauber',visual:'pullup',rest:180,cues:['Aus aktivem Hang starten.','Kinn klar über die Stange.','Kein Kipping, kein Beinpendeln.'],mistakes:['Halbe ROM.','Hals nach vorne strecken statt hochziehen.'],progress:'2 → 4 → 6 → 8–10 strikt; danach Weighted Pull-ups.'},
  bandPull46:{name:'Band Pull-ups Kraftvolumen',cat:'Pull',prescription:'4×4–6 · Start 10-kg-Band',visual:'pullupBand',rest:180,cues:['Leichtestes Band nutzen, mit dem alle Wiederholungen sauber sind.','Volle Streckung unten.','1–2 Wiederholungen im Tank.'],mistakes:['Stärkeres Band nur für mehr Wiederholungen nehmen.','Schwung aus den Beinen.'],progress:'4×6 sauber → weniger Hilfe. Reihenfolge: 30 → 20 → 10 → ohne Band.'},
  bandPull58:{name:'Band Pull-ups Volumen',cat:'Pull',prescription:'4×5–8 · Start 10-kg-Band',visual:'pullupBand',rest:150,cues:['Donnerstag keine Maximalversuche.','Jede Wiederholung gleich sauber.','1–2 Reps im Tank.'],mistakes:['Letzte Wiederholungen mit Kipping retten.'],progress:'4×8 sauber → weniger Hilfe; später komplett ohne Band.'},
  dips:{name:'Dips',cat:'Push',prescription:'3×6–10',visual:'dip',rest:150,cues:['Schultern stabil und unten.','Kontrollierte Tiefe ohne vordere Schulter zu reizen.','Rumpf gespannt.'],mistakes:['Zu tief trotz Schulterstress.','Schwingen zwischen den Holmen.'],progress:'3×10 sauber in mehreren Sessions → Zusatzgewicht.'},
  rows:{name:'Schwere Inverted Rows',cat:'Pull',prescription:'3×8–12',visual:'row',rest:120,cues:['Körper wie ein Brett.','Brust zur Stange.','Schulterblätter hinten zusammen.'],mistakes:['Hüfte absinken lassen.','Nur mit Armen ziehen.'],progress:'3×12 → Füße höher / horizontaler / Zusatzlast.'},
  bulgarian:{name:'Bulgarian Split Squats',cat:'Beine',prescription:'3×8–12 je Bein · 3 s runter',visual:'split',rest:90,cues:['3 Sekunden absenken.','Über ganzen Vorderfuß drücken.','Knie folgt Fußrichtung.'],mistakes:['Vorne auf die Zehen kippen.','Tempo beschleunigen, nur um Wiederholungen zu schaffen.'],progress:'3×12 leicht → Rucksack beladen.'},
  hollow:{name:'Hollow Body Hold',cat:'Core',prescription:'3×20–30 s',visual:'hollow',rest:60,cues:['Unteren Rücken in den Boden drücken.','Rippen einziehen.','Beine nur so tief, wie der Rücken Kontakt hält.'],mistakes:['Hohlkreuz zulassen.'],progress:'Bis 40 s sauber, dann Hebel verlängern / Arme über Kopf.'},
  pike:{name:'Pike Push-ups',cat:'HSPU',prescription:'4×3–5',visual:'pike',rest:150,cues:['Hüfte hoch.','Kopf VOR den Händen Richtung Boden.','Schultern nach vorne über die Hände bringen.'],mistakes:['Wie normalen Push-up ausführen.','Kopf zwischen den Händen absenken.'],progress:'4×6 sauber → Füße erhöhen → Negative HSPU → Teil-ROM → Wall HSPU → frei.'},
  pistol:{name:'Assisted Pistol Squat',cat:'Beine',prescription:'3×8–12 je Bein',visual:'pistol',rest:90,cues:['Nur so viel Hilfe wie nötig.','Kontrolliert tief.','Knie stabil über dem Fuß.'],mistakes:['In die Tiefe fallen.'],progress:'Mit Bulgarian Split Squat abwechseln.'},
  kneeRaises:{name:'Hanging Knee Raises',cat:'Core',prescription:'3×6–10',visual:'kneeRaise',rest:90,cues:['Vor jeder Wdh. Pendeln stoppen.','Knie hoch und Becken oben leicht einrollen.'],mistakes:['Aus Hüftschwung reißen.'],progress:'3×10 ohne Schwingen → langsam Richtung Leg Raises.'},
  deadHang:{name:'Dead Hang',cat:'Grip',prescription:'2×30–45 s',visual:'hang',rest:90,cues:['Griff fest, aber nicht verkrampfen.','Bei zunehmendem Ellenbogenschmerz abbrechen.'],mistakes:['Schmerz ignorieren und Zeit erzwingen.'],progress:'60–90 s → Towel Hangs / Uneven Hangs / Weighted Hangs.'},
  pushupHard:{name:'Schwere Push-up-Variante',cat:'Push',prescription:'3×8–15',visual:'pushup',rest:90,cues:['Variante wählen, die 8–15 anspruchsvoll macht.','Körper gerade, Brust kontrolliert tief.'],mistakes:['Hüfte absinken lassen.'],progress:'3×15 → Füße höher / langsamere Exzentrik / Pseudo-Planche-Tendenz.'},
  bandRow:{name:'Band Rows',cat:'Pull',prescription:'3×12–20',visual:'bandRow',rest:75,cues:['Band sicher befestigen.','Ellbogen Richtung Hüfte.','Schulterblätter aktiv zurück.'],mistakes:['Oberkörper nach hinten werfen.'],progress:'3×20 → mehr Bandspannung.'},
  facePull:{name:'Band Face Pull / Pull Apart',cat:'Schulter',prescription:'3×15–25',visual:'facePull',rest:60,cues:['Leicht bis moderat.','Hintere Schulter arbeiten lassen.','Rippen unten halten.'],mistakes:['Zu schwer wählen und Schwung nehmen.'],progress:'25 sauber → Spannung leicht erhöhen.'},
  sidePlank:{name:'Side Plank',cat:'Core',prescription:'3×30–45 s je Seite',visual:'sidePlank',rest:60,cues:['Körper gerade.','Becken oben halten.'],mistakes:['Becken absinken lassen.'],progress:'Bis 60 s → längerer Hebel / Top-leg raise.'}
};

const workouts={
  A:{label:'Montag · Park A',short:'Mo',duration:'45–60 Min.',focus:'Pull + Push + Handstand',items:[
    {id:'warmup',sets:0},{id:'handstandWall',sets:3,unit:'s'},{id:'kickups',sets:0},{id:'pullup',sets:1,unit:'reps'},{id:'bandPull46',sets:4,unit:'reps',loadLabel:'Band kg'},{id:'dips',sets:3,unit:'reps'},{id:'rows',sets:3,unit:'reps'},{id:'bulgarian',sets:3,unit:'reps'},{id:'hollow',sets:3,unit:'s'}]},
  B:{label:'Donnerstag · Park B',short:'Do',duration:'45–60 Min.',focus:'HSPU-Kraft + Pull',items:[
    {id:'warmup',sets:0},{id:'handstandWall',sets:3,unit:'s'},{id:'kickups',sets:0},{id:'pike',sets:4,unit:'reps'},{id:'bandPull58',sets:4,unit:'reps',loadLabel:'Band kg'},{id:'dips',sets:3,unit:'reps'},{id:'pistol',sets:3,unit:'reps'},{id:'kneeRaises',sets:3,unit:'reps'},{id:'deadHang',sets:2,unit:'s'}]},
  C:{label:'Wochenende · Home C',short:'WE',duration:'35–50 Min.',focus:'Technik + Volumen · bei Schlafmangel optional',items:[
    {id:'handstandWall',sets:3,unit:'s'},{id:'kickups',sets:0},{id:'pike',sets:3,unit:'reps'},{id:'pushupHard',sets:3,unit:'reps'},{id:'bulgarian',sets:3,unit:'reps'},{id:'bandRow',sets:3,unit:'reps',loadLabel:'Band kg'},{id:'facePull',sets:3,unit:'reps',loadLabel:'Band kg'},{id:'sidePlank',sets:3,unit:'s'},{id:'hollow',sets:3,unit:'s'}]}
};

function humanSvg(kind){
  const c='#eaf2ff',a='#61e6b7',m='#7db7ff',f='#24405f';
  const bg=`<rect width="300" height="180" fill="#081321"/><line x1="14" y1="158" x2="286" y2="158" stroke="${f}" stroke-width="2"/>`;
  const head=(x,y)=>`<circle cx="${x}" cy="${y}" r="9" fill="none" stroke="${c}" stroke-width="5"/>`;
  const line=(x1,y1,x2,y2,col=c,w=6)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const arrow=(x1,y1,x2,y2)=>`${line(x1,y1,x2,y2,a,3)}<polyline points="${x2-6},${y2-5} ${x2},${y2} ${x2-6},${y2+5}" fill="none" stroke="${a}" stroke-width="3"/>`;
  const label=t=>`<text x="14" y="22" fill="${a}" font-size="12" font-family="system-ui" font-weight="700">${t}</text>`;
  let s=bg;
  if(kind==='pullup'||kind==='pullupBand'){
    s+=label('ziehen · Brust Richtung Stange')+line(45,34,255,34,m,5)+head(150,68)+line(150,77,150,118)+line(150,84,108,44)+line(150,84,192,44)+line(150,118,130,151)+line(150,118,170,151)+arrow(265,130,265,68);
    if(kind==='pullupBand')s+=`<path d="M150 118 C150 138 150 150 150 163" stroke="${a}" stroke-width="5" fill="none"/><text x="165" y="146" fill="${a}" font-size="11">Band</text>`;
  }else if(kind==='dip'){
    s+=label('kontrolliert runter · stark hoch')+line(76,72,76,154,m,5)+line(224,72,224,154,m,5)+head(150,57)+line(150,66,150,111)+line(150,77,83,84)+line(150,77,217,84)+line(150,111,132,150)+line(150,111,168,150)+arrow(270,126,270,73);
  }else if(kind==='row'){
    s+=label('Körper bleibt wie ein Brett')+line(48,62,252,62,m,5)+head(82,105)+line(92,105,166,126)+line(104,109,88,68)+line(128,116,128,68)+line(166,126,226,151)+line(166,126,198,151)+arrow(260,121,222,99);
  }else if(kind==='split'){
    s+=label('3 Sekunden absenken')+head(150,48)+line(150,57,150,102)+line(150,71,124,93)+line(150,71,177,91)+line(150,102,110,139)+line(110,139,62,151)+line(150,102,195,121)+line(195,121,235,151)+arrow(270,76,270,127);
  }else if(kind==='pike'){
    s+=label('Kopf VOR die Hände')+head(88,119)+line(97,115,151,78)+line(151,78,197,136)+line(98,117,64,150)+line(108,112,89,151)+line(197,136,236,151)+arrow(49,82,49,123);
  }else if(kind==='handstand'){
    s+=label('Linie · Rippen einziehen')+head(150,35)+line(150,44,150,91)+line(150,55,120,136)+line(150,55,180,136)+line(150,91,133,136)+line(150,91,167,136)+line(108,141,192,141,m,5)+`<line x1="204" y1="24" x2="204" y2="158" stroke="${f}" stroke-width="7"/>`+arrow(260,127,260,62);
  }else if(kind==='kickup'){
    s+=label('kontrolliert in Balance')+head(120,80)+line(128,87,157,109)+line(134,95,104,145)+line(143,98,129,148)+line(157,109,189,63)+line(157,109,215,125)+arrow(235,132,235,70);
  }else if(kind==='hollow'){
    s+=label('unterer Rücken bleibt am Boden')+head(82,119)+line(92,116,146,125)+line(95,112,58,87)+line(146,125,211,108)+line(211,108,250,91)+`<path d="M57 142 Q155 126 250 131" fill="none" stroke="${a}" stroke-width="3"/>`;
  }else if(kind==='kneeRaise'){
    s+=label('Pendeln stoppen · Becken einrollen')+line(48,30,252,30,m,5)+head(150,58)+line(150,67,150,109)+line(150,75,108,36)+line(150,75,192,36)+line(150,109,112,124)+line(112,124,132,148)+line(150,109,188,124)+line(188,124,168,148)+arrow(260,140,260,92);
  }else if(kind==='hang'){
    s+=label('ruhig hängen · Griff fest')+line(48,30,252,30,m,5)+head(150,59)+line(150,68,150,116)+line(150,75,110,36)+line(150,75,190,36)+line(150,116,130,151)+line(150,116,170,151)+`<text x="206" y="92" fill="${a}" font-size="12">30–45 s</text>`;
  }else if(kind==='pushup'){
    s+=label('Körper bleibt gerade')+head(74,111)+line(84,111,168,124)+line(168,124,246,151)+line(106,116,95,151)+line(128,119,118,151)+arrow(47,100,47,132);
  }else if(kind==='bandRow'){
    s+=label('Ellbogen Richtung Hüfte')+line(255,35,255,155,m,5)+`<path d="M240 78 Q180 78 132 92" stroke="${a}" stroke-width="4" fill="none"/>`+head(101,73)+line(106,82,119,124)+line(111,90,136,93)+line(119,124,92,151)+line(119,124,148,151)+arrow(200,109,148,96);
  }else if(kind==='facePull'){
    s+=label('Band Richtung Gesicht ziehen')+line(255,35,255,155,m,5)+`<path d="M240 74 L145 74" stroke="${a}" stroke-width="4"/>`+head(112,72)+line(112,82,112,126)+line(114,92,149,74)+line(108,91,143,63)+line(112,126,88,151)+line(112,126,139,151)+arrow(205,101,153,76);
  }else if(kind==='sidePlank'){
    s+=label('Becken hoch · Körper gerade')+head(79,115)+line(89,115,168,126)+line(168,126,247,151)+line(107,118,100,151)+line(117,114,128,82);
  }else if(kind==='pistol'){
    s+=label('kontrolliert · nur wenig Hilfe')+head(141,58)+line(141,67,141,110)+line(141,79,112,94)+line(141,79,171,92)+line(141,110,108,143)+line(108,143,80,151)+line(141,110,200,119)+line(200,119,239,120)+arrow(270,75,270,123);
  }else{
    s+=label('Schulter & Ellbogen vorbereiten')+head(150,58)+line(150,67,150,116)+line(150,77,110,98)+line(150,77,190,98)+line(150,116,130,151)+line(150,116,170,151)+`<circle cx="150" cy="93" r="63" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="7 7"/>`;
  }
  return `<svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration ${kind}">${s}</svg>`;
}

function getDay(){return new Date().getDay()}
function currentWorkoutKey(){const d=getDay(); if(d===1)return'A'; if(d===4)return'B'; if(d===0||d===6)return'C'; return d<4?'A':'C'}
function weekStartISO(date=new Date()){const x=new Date(date);const d=(x.getDay()+6)%7;x.setDate(x.getDate()-d);return x.toISOString().slice(0,10)}
function recentDaily(days=14){const out=[];for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);out.push({date:k,...(state.daily[k]||{})})}return out}
function latestMeasurement(){return [...state.measurements].sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||defaultState.measurements[0]}
function thisWeekWorkoutCount(){const start=weekStartISO();return Object.entries(state.workouts).filter(([d])=>d>=start).reduce((sum,[,sessions])=>sum+Object.values(sessions).filter(x=>x.complete).length,0)}

function recoveryMode(){
  const d=state.daily[todayISO()]||{}; const sleep=+d.sleep||0, pain=Math.max(+d.elbow||0,+d.shoulder||0), energy=+d.energy||3;
  if(pain>=5||sleep>0&&sleep<4.5)return{mode:'STOP',cls:'danger',title:'Recovery zuerst',text:'Heute kein hartes Krafttraining. Bei deutlich zunehmendem, scharfem oder anhaltendem Gelenkschmerz Belastung stoppen und abklären.',factor:.45};
  if(pain>=3||sleep>0&&sleep<5.5||energy<=1)return{mode:'REDUZIERT',cls:'danger',title:'Volumen runter',text:'Heute Technik sauber halten, keine Maximalversuche und ca. 30–40 % weniger Arbeitssätze.',factor:.65};
  if(sleep>0&&sleep<6.5||energy===2)return{mode:'LEICHT',cls:'warn',title:'Kraft ja, Ego nein',text:'Hauptübungen machen, 2 Reps im Tank lassen. Wochenend-Einheit bleibt optional.',factor:.8};
  return{mode:'NORMAL',cls:'good',title:'Normale Session',text:'Plan wie vorgesehen. 1–2 Reps im Tank, Technik vor Wiederholungszahl.',factor:1};
}

function coachTips(){
  const d=state.daily[todayISO()]||{},r=recoveryMode(),tips=[];
  const key=currentWorkoutKey();
  if(state.settings.vacation)tips.push('Urlaubsmodus aktiv: Gewicht halten, Protein priorisieren, kurze Sessions reichen.');
  if(+d.protein>0&&+d.protein<150)tips.push('Protein heute deutlich unter Ziel: auf mindestens 170 g auffüllen.');
  if(+d.sleep>0&&+d.sleep<6)tips.push('Mit 5–6 h Schlaf ist Regeneration aktuell der Engpass. Keine Zusatz-Max-Sets.');
  if(Math.max(+d.elbow||0,+d.shoulder||0)>=2)tips.push('Gelenke melden sich: Warm-up ernst nehmen und schmerzhafte ROM nicht erzwingen.');
  if(key==='C'&&r.factor<1)tips.push('Home C ist heute optional. Wenn du platt bist: nur 10 Min. Handstand-Technik + Spaziergang.');
  if(!tips.length)tips.push('Heute zählt saubere Qualität: keine Wiederholung erzwingen, die technisch zerfällt.');
  return tips;
}

function renderCoach(){
  const r=recoveryMode();
  const t=document.getElementById('coachTitle'),b=document.getElementById('coachMode'),p=document.getElementById('coachText'),a=document.getElementById('coachActions');
  if(!t)return;t.textContent=r.title;b.textContent=r.mode;b.className=`mode-badge ${r.cls}`;p.textContent=r.text;a.innerHTML=coachTips().map(x=>`<div class="coach-tip">${x}</div>`).join('');
}

function renderDashboard(){
  const m=latestMeasurement();
  document.getElementById('heroWeight').textContent=fmt(m.weight??state.profile.startWeight);
  document.getElementById('heroPullups').textContent=m.pullups??2;
  document.getElementById('heroHs').textContent=m.handstand??5;
  document.getElementById('heroWeek').textContent=thisWeekWorkoutCount();
  document.getElementById('calTarget').textContent=state.settings.vacation?'Erhalt':'2.300';
  document.getElementById('creatineStreak').textContent=calcCreatineStreak();
  renderCoach(); renderTodayPreview(); renderWeekChecklist(); updateDailyScore();
}

function renderTodayPreview(){
  const key=currentWorkoutKey(),w=workouts[key];document.getElementById('todayWorkoutTitle').textContent=w.label;document.getElementById('todayDuration').textContent=w.duration;
  const root=document.getElementById('todayPreview');root.innerHTML='';
  w.items.slice(0,7).forEach(it=>{const e=exercises[it.id],d=document.createElement('div');d.className='today-item';d.innerHTML=`<b>${e.name}</b><span>${e.prescription}</span>`;root.appendChild(d)});
  if(w.items.length>7){const d=document.createElement('div');d.className='today-item';d.innerHTML=`<b>+ ${w.items.length-7} weitere</b><span>${w.duration}</span>`;root.appendChild(d)}
}

function renderWeekChecklist(){
  const start=weekStartISO();
  const checks=[
    ['Montag Park A',isWorkoutDoneSince('A',start)],['Donnerstag Park B',isWorkoutDoneSince('B',start)],['Home C',isWorkoutDoneSince('C',start)],
    ['4× Handstand kurz',countEntriesSince(state.handstandPractice,start)>=4],['1× lockerer Lauf',countEntriesSince(state.runs,start)>=1]
  ];
  document.getElementById('weekChecklist').innerHTML=checks.map(([n,done])=>`<div class="checklist-item ${done?'done':''}"><b>${done?'✓ ':'○ '}${n}</b><span>${done?'erledigt':'offen'}</span></div>`).join('');
}
function isWorkoutDoneSince(k,start){return Object.entries(state.workouts).some(([d,s])=>d>=start&&s[k]?.complete)}
function countEntriesSince(obj,start){return Object.keys(obj||{}).filter(d=>d>=start&&obj[d]).length}

function dailyScore(d=state.daily[todayISO()]||{}){
  let s=0,n=0; const add=(ok,w=1)=>{s+=ok?w:0;n+=w};
  if(d.sleep!=null)add(+d.sleep>=6.5,2); if(d.protein!=null)add(+d.protein>=170,2);if(d.water!=null)add(+d.water>=2,1);if(d.steps!=null)add(+d.steps>=7000,1);if(d.creatine!=null)add(!!d.creatine,1);if(d.energy!=null)add(+d.energy>=3,1);if(d.elbow!=null)add(+d.elbow<=2,1);if(d.shoulder!=null)add(+d.shoulder<=2,1);
  return n?Math.round(s/n*100):null;
}
function updateDailyScore(){const s=dailyScore();const el=document.getElementById('dailyScore');if(!el)return;el.textContent=s==null?'–':s;el.style.borderColor=s==null?'var(--line)':s>=75?'var(--accent)':s>=50?'var(--warn)':'var(--danger)'}
function calcCreatineStreak(){let streak=0;for(let i=0;i<365;i++){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10);if(state.daily[k]?.creatine)streak++;else if(i===0)continue;else break}return streak}

const dailyEls={weight:'dWeight',sleep:'dSleep',calories:'dCalories',protein:'dProtein',water:'dWater',steps:'dSteps',elbow:'dElbow',shoulder:'dShoulder',energy:'dEnergy',creatine:'dCreatine'};
function loadDailyForm(){const d=state.daily[todayISO()]||{};Object.entries(dailyEls).forEach(([k,id])=>{const el=document.getElementById(id);if(!el)return;if(k==='creatine')el.checked=!!d[k];else if(d[k]!=null)el.value=d[k]})}
document.getElementById('dailyForm').onsubmit=e=>{e.preventDefault();const date=todayISO(),d={};Object.entries(dailyEls).forEach(([k,id])=>{const el=document.getElementById(id);d[k]=k==='creatine'?el.checked:(el.value===''?null:+el.value)});state.daily[date]=d;if(d.weight!=null)upsertMeasurement(date,{weight:d.weight});saveState();document.getElementById('dailyMsg').textContent='Gespeichert ✓';setTimeout(()=>document.getElementById('dailyMsg').textContent='',1600)};

function workoutLogFor(key){const date=todayISO();state.workouts[date]||={};state.workouts[date][key]||={started:new Date().toISOString(),exercises:{},complete:false};return state.workouts[date][key]}
function renderWorkoutTabs(active=currentWorkoutKey()){
  const root=document.getElementById('workoutTabs');root.innerHTML='';Object.entries(workouts).forEach(([k,w])=>{const b=document.createElement('button');b.textContent=w.label;b.className=k===active?'active':'';b.onclick=()=>{renderWorkoutTabs(k);renderWorkout(k)};root.appendChild(b)})
}
function adjustedSets(base){const f=recoveryMode().factor;return f>=.95?base:Math.max(1,Math.round(base*f))}
function progressionAdvice(id,exlog){
  if(!exlog?.sets?.length)return exercises[id]?.progress||'';
  const vals=exlog.sets.map(s=>+s.value).filter(Number.isFinite),loads=exlog.sets.map(s=>+s.load).filter(Number.isFinite);if(!vals.length)return exercises[id].progress;
  const allRirOk=exlog.sets.every(s=>s.rir===''||+s.rir>=1);
  if(id==='bandPull46'&&vals.length>=4&&vals.every(v=>v>=6)&&allRirOk){const band=Math.max(...loads);return band>10?`Nächste Session weniger Hilfe: ${band===30?20:10}-kg-Band testen.`:'Du hast 4×6 mit 10 kg geschafft: in der nächsten Kraftsession erste Sätze ohne Band testen.'}
  if(id==='bandPull58'&&vals.length>=4&&vals.every(v=>v>=8)&&allRirOk){const band=Math.max(...loads);return band>10?`Volumenziel erreicht: auf ${band===30?20:10} kg Hilfe reduzieren.`:'4×8 mit 10 kg erreicht: nächstes Ziel mehr saubere Bodyweight-Reps.'}
  if(id==='dips'&&vals.length>=3&&vals.every(v=>v>=10)&&allRirOk)return'3×10 erreicht. Wenn das 2–3 Sessions stabil bleibt: Zusatzgewicht einführen.';
  if(id==='pike'&&vals.length>=4&&vals.every(v=>v>=6)&&allRirOk)return'Pike-Ziel erreicht: Füße erhöhen und wieder bei 3–5 sauberen Reps starten.';
  if(id==='deadHang'&&vals.some(v=>v>=60))return'60 s erreicht. Langfristig Richtung 90 s; danach Towel/Uneven/Weighted Hang.';
  return exercises[id].progress;
}
function renderWorkout(key){
  const w=workouts[key],log=workoutLogFor(key);const root=document.getElementById('workoutRoot');
  const total=w.items.filter(x=>x.sets).reduce((s,x)=>s+adjustedSets(x.sets),0);const doneSets=Object.values(log.exercises).reduce((s,e)=>s+(e.sets||[]).filter(x=>x.done).length,0);const pct=Math.min(100,Math.round(doneSets/Math.max(1,total)*100));
  root.innerHTML=`<article class="card workout-summary"><div><div class="eyebrow">${w.focus}</div><h2>${w.label}</h2><div class="meta"><span class="pill">${w.duration}</span><span class="pill">Recovery: ${recoveryMode().mode}</span><span class="pill">1–2 Reps im Tank</span></div></div><button id="finishWorkout" class="${log.complete?'secondary':'primary'}">${log.complete?'Training abgeschlossen ✓':'Training abschließen'}</button></article><article class="card"><div class="session-bar"><div class="progress-bar"><i style="width:${pct}%"></i></div><span>${pct}%</span><button id="openTimer" class="small-btn">Timer</button></div><div id="workoutRows"></div></article>`;
  const rows=document.getElementById('workoutRows');
  w.items.forEach((it,idx)=>{
    const ex=exercises[it.id],sets=it.sets?adjustedSets(it.sets):0;log.exercises[it.id]||={done:false,sets:Array.from({length:sets},()=>({value:'',load:it.loadLabel?10:'',rir:'2',done:false}))};const exlog=log.exercises[it.id];
    while(exlog.sets.length<sets)exlog.sets.push({value:'',load:it.loadLabel?10:'',rir:'2',done:false}); if(exlog.sets.length>sets)exlog.sets=exlog.sets.slice(0,sets);
    const inputSets=sets?`<div class="set-inputs">${exlog.sets.map((s,i)=>`<label class="set-pill ${it.loadLabel?'':'simple'}">S${i+1}<input data-i="${i}" data-f="value" inputmode="decimal" value="${s.value??''}" placeholder="${it.unit==='s'?'s':'Wdh'}">${it.loadLabel?`<input data-i="${i}" data-f="load" inputmode="decimal" value="${s.load??10}" placeholder="Band">`:''}<input data-i="${i}" data-f="rir" inputmode="numeric" value="${s.rir??2}" placeholder="RIR"></label>`).join('')}</div>`:'';
    const row=document.createElement('div');row.className='exercise-row';row.innerHTML=`<div class="exercise-thumb">${humanSvg(ex.visual)}</div><div><h4>${idx+1}. ${ex.name}</h4><p>${ex.prescription}${sets&&sets!==it.sets?` · heute ${sets}/${it.sets} Sätze wegen Recovery`:''}</p>${inputSets}<div class="progression-note">${progressionAdvice(it.id,exlog)}</div></div><div class="exercise-actions"><button class="small-btn info-btn">Technik</button><button class="done-btn ${exlog.done?'done':''}">${exlog.done?'Erledigt ✓':'Erledigt'}</button></div>`;
    row.querySelector('.info-btn').onclick=()=>openExercise(it.id);row.querySelector('.done-btn').onclick=e=>{exlog.done=!exlog.done;exlog.sets.forEach(x=>x.done=exlog.done);saveState(false);renderWorkout(key);renderDashboard()};
    row.querySelectorAll('input[data-i]').forEach(inp=>inp.onchange=()=>{const s=exlog.sets[+inp.dataset.i];s[inp.dataset.f]=inp.value;s.done=s.value!=='';exlog.done=exlog.sets.length?exlog.sets.every(x=>x.done):exlog.done;saveState(false);renderWorkout(key)});rows.appendChild(row)
  });
  saveState(false);document.getElementById('finishWorkout').onclick=()=>{log.complete=!log.complete;log.finished=log.complete?new Date().toISOString():null;saveState();renderWorkout(key)};document.getElementById('openTimer').onclick=()=>openTimer(120)
}

document.getElementById('openTodayWorkout').onclick=()=>{switchView('train');const k=currentWorkoutKey();renderWorkoutTabs(k);renderWorkout(k)};

function openExercise(id){const ex=exercises[id],d=document.getElementById('exerciseDialog');document.getElementById('exerciseDialogBody').innerHTML=`<div class="dialog-visual">${humanSvg(ex.visual)}</div><div class="eyebrow">${ex.cat}</div><h2>${ex.name}</h2><p><b>Plan:</b> ${ex.prescription}</p><h3>Technik</h3><ul class="cue-list">${ex.cues.map(c=>`<li>${c}</li>`).join('')}</ul><h3>Typische Fehler</h3><ul class="cue-list">${ex.mistakes.map(c=>`<li>${c}</li>`).join('')}</ul><h3>Progression</h3><p class="muted">${ex.progress}</p>`;d.showModal()}
document.querySelector('#exerciseDialog .dialog-close').onclick=()=>document.getElementById('exerciseDialog').close();document.getElementById('exerciseDialog').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
function renderExerciseGrid(filter=''){const root=document.getElementById('exerciseGrid');root.innerHTML='';Object.entries(exercises).filter(([,e])=>`${e.name} ${e.cat}`.toLowerCase().includes(filter.toLowerCase())).forEach(([id,e])=>{const c=document.createElement('article');c.className='card exercise-card';c.innerHTML=`<div class="exercise-visual">${humanSvg(e.visual)}</div><div class="eyebrow">${e.cat}</div><h3>${e.name}</h3><p>${e.prescription}</p>`;c.onclick=()=>openExercise(id);root.appendChild(c)})}
document.getElementById('exerciseSearch').oninput=e=>renderExerciseGrid(e.target.value);

let timerId=null,timerLeft=120,timerRunning=false;function openTimer(sec=120){timerLeft=sec;timerRunning=false;updateTimerDisplay();document.getElementById('timerToggle').textContent='Start';document.getElementById('timerDialog').showModal()}function updateTimerDisplay(){const m=Math.floor(timerLeft/60),s=timerLeft%60;document.getElementById('timerDisplay').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}function stopTimer(){clearInterval(timerId);timerId=null;timerRunning=false;document.getElementById('timerToggle').textContent='Start'}document.querySelector('.timer-close').onclick=()=>{stopTimer();document.getElementById('timerDialog').close()};document.querySelectorAll('.timer-preset').forEach(b=>b.onclick=()=>{stopTimer();timerLeft=+b.dataset.seconds;updateTimerDisplay()});document.getElementById('timerToggle').onclick=()=>{if(timerRunning){stopTimer();return}timerRunning=true;document.getElementById('timerToggle').textContent='Pause';timerId=setInterval(()=>{timerLeft--;updateTimerDisplay();if(timerLeft<=0){stopTimer();navigator.vibrate?.([200,100,200])}},1000)};

function upsertMeasurement(date,patch){let m=state.measurements.find(x=>x.date===date);if(!m){m={date,weight:null,waist:null,pullups:null,dips:null,handstand:null,hang:null,hspu:null};state.measurements.push(m)}Object.entries(patch).forEach(([k,v])=>{if(v!==null&&v!=='')m[k]=+v})}
const mEls={weight:'mWeight',waist:'mWaist',pullups:'mPullups',dips:'mDips',handstand:'mHs',hang:'mHang',hspu:'mHspu'};document.getElementById('mDate').value=todayISO();document.getElementById('measureForm').onsubmit=e=>{e.preventDefault();const p={};Object.entries(mEls).forEach(([k,id])=>{const v=document.getElementById(id).value;p[k]=v===''?null:+v});upsertMeasurement(document.getElementById('mDate').value||todayISO(),p);saveState();e.target.reset();document.getElementById('mDate').value=todayISO()};
function renderMeasurements(){const root=document.getElementById('measurementRows');root.innerHTML='';[...state.measurements].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,24).forEach(m=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${m.date}</td><td>${m.weight!=null?fmt(m.weight)+' kg':'–'}</td><td>${m.waist!=null?fmt(m.waist)+' cm':'–'}</td><td>${m.pullups??'–'}</td><td>${m.dips??'–'}</td><td>${m.handstand!=null?m.handstand+' s':'–'}</td><td>${m.hang!=null?m.hang+' s':'–'}</td>`;root.appendChild(tr)})}
document.getElementById('clearMeasurements').onclick=()=>{if(confirm('Messhistorie löschen? Die Ausgangsmessung bleibt erhalten.')){state.measurements=clone(defaultState.measurements);saveState()}};

function rolling7(arr){return arr.map((p,i)=>{const s=arr.slice(Math.max(0,i-6),i+1).filter(x=>x.value!=null);return{...p,avg:s.length?s.reduce((a,b)=>a+b.value,0)/s.length:null}})}
function drawLineChart(canvas,series){if(!canvas)return;const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#081321';ctx.fillRect(0,0,W,H);const pad={l:60,r:20,t:28,b:40},vals=series.flatMap(s=>s.data.map(p=>p.value).filter(v=>v!=null));if(!vals.length){ctx.fillStyle='#9cabc0';ctx.font='18px system-ui';ctx.fillText('Noch nicht genug Daten',70,90);return}let min=Math.min(...vals),max=Math.max(...vals);if(min===max){min-=1;max+=1}else{const m=(max-min)*.18;min-=m;max+=m}ctx.strokeStyle='#263a54';ctx.lineWidth=1;ctx.fillStyle='#9cabc0';ctx.font='12px system-ui';for(let i=0;i<5;i++){const y=pad.t+(H-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText((max-(max-min)*i/4).toFixed(1),8,y+4)}const n=Math.max(...series.map(s=>s.data.length));const xAt=i=>pad.l+(W-pad.l-pad.r)*(n<=1?.5:i/(n-1)),yAt=v=>pad.t+(max-v)/(max-min)*(H-pad.t-pad.b);series.forEach((s,si)=>{ctx.strokeStyle=s.color;ctx.lineWidth=si?4:3;ctx.beginPath();let started=false;s.data.forEach((p,i)=>{if(p.value==null)return;const x=xAt(i),y=yAt(p.value);if(!started){ctx.moveTo(x,y);started=true}else ctx.lineTo(x,y)});ctx.stroke()});const labels=series[0].data;if(labels.length){[0,Math.floor((labels.length-1)/2),labels.length-1].filter((v,i,a)=>a.indexOf(v)===i).forEach(i=>{ctx.fillStyle='#9cabc0';ctx.fillText(labels[i].date.slice(5),xAt(i)-16,H-14)})}let lx=pad.l;series.forEach(s=>{ctx.fillStyle=s.color;ctx.fillRect(lx,10,14,4);ctx.fillStyle='#d8e2f0';ctx.fillText(s.label,lx+20,15);lx+=130})}
function drawCharts(){const ms=[...state.measurements].sort((a,b)=>a.date.localeCompare(b.date)),weights=ms.filter(m=>m.weight!=null).map(m=>({date:m.date,value:+m.weight})),roll=rolling7(weights).map(x=>({date:x.date,value:x.avg}));drawLineChart(document.getElementById('weightChart'),[{label:'Gewicht',color:'#7db7ff',data:weights},{label:'7-Tage',color:'#61e6b7',data:roll}]);drawLineChart(document.getElementById('waistChart'),[{label:'Bauch cm',color:'#f8c45c',data:ms.filter(m=>m.waist!=null).map(m=>({date:m.date,value:+m.waist}))}]);const dd=recentDaily(30).filter(x=>x.sleep!=null);drawLineChart(document.getElementById('sleepChart'),[{label:'Schlaf h',color:'#b7a1ff',data:dd.map(x=>({date:x.date,value:+x.sleep}))}]);drawLineChart(document.getElementById('strengthChart'),[{label:'Pull-ups',color:'#61e6b7',data:ms.filter(m=>m.pullups!=null).map(m=>({date:m.date,value:+m.pullups}))},{label:'HS s',color:'#7db7ff',data:ms.filter(m=>m.handstand!=null).map(m=>({date:m.date,value:+m.handstand}))}])}

const milestones=[['Pull-ups strikt','pullups',2,10,'Wdh'],['Dips','dips',10,15,'Wdh'],['Freier Handstand','handstand',5,30,'s'],['Dead Hang','hang',45,90,'s'],['Wall HSPU','hspu',0,1,'Wdh']];function renderMilestones(){const m=latestMeasurement(),root=document.getElementById('milestones');root.innerHTML='';milestones.forEach(([label,key,start,target,unit])=>{const cur=m[key]??start,pct=Math.max(0,Math.min(100,cur/target*100));const d=document.createElement('div');d.className='milestone';d.innerHTML=`<div><b>${label}</b><div class="progress-bar"><i style="width:${pct}%"></i></div></div><span>${cur} / ${target} ${unit}</span>`;root.appendChild(d)})}

function avg(arr,key){const v=arr.map(x=>+x[key]).filter(Number.isFinite).filter(x=>x>0);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null}
function weightWeekAvg(offset=0){const today=new Date(),vals=[];for(let i=0;i<7;i++){const d=new Date(today);d.setDate(d.getDate()-(i+offset*7));const k=d.toISOString().slice(0,10),v=state.daily[k]?.weight??state.measurements.find(m=>m.date===k)?.weight;if(v!=null)vals.push(+v)}return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null}
function renderWeeklyReview(){const cur=weightWeekAvg(0),prev=weightWeekAvg(1),delta=cur!=null&&prev!=null?cur-prev:null,d=recentDaily(14),cal=avg(d,'calories'),prot=avg(d,'protein'),sleep=avg(d,'sleep');let badge='DATEN',cls='',advice='Noch Daten sammeln. Wiege dich möglichst täglich morgens unter ähnlichen Bedingungen.';if(delta!=null){const loss=-delta;if(loss>=.3&&loss<=.6){badge='PERFEKT';cls='good';advice='Gewicht sinkt im Zielbereich. Kalorien nicht ändern.'}else if(loss<.15){badge='LANGSAM';cls='warn';advice='Wenn das 2–3 Wochen so bleibt und Tracking sauber ist: auf ca. 2.150–2.200 kcal senken.'}else if(loss>.8){badge='ZU SCHNELL';cls='danger';advice='Verlust ist aggressiv. Wenn Leistung/Erholung sinken: ca. 100–150 kcal erhöhen.'}else{badge='OK';cls='good';advice='Trend ist grundsätzlich passend. Noch nicht hektisch an Kalorien drehen.'}}const b=document.getElementById('trendBadge');b.textContent=badge;b.className=`mode-badge ${cls}`;document.getElementById('weeklyReview').innerHTML=`<div class="review-line"><span>7-Tage Gewicht</span><b>${cur!=null?fmt(cur)+' kg':'–'}</b></div><div class="review-line"><span>Veränderung vs. Vorwoche</span><b>${delta!=null?(delta>0?'+':'')+fmt(delta)+' kg':'–'}</b></div><div class="review-line"><span>Ø Kalorien</span><b>${cal!=null?Math.round(cal):'–'}</b></div><div class="review-line"><span>Ø Protein</span><b>${prot!=null?Math.round(prot)+' g':'–'}</b></div><div class="review-line"><span>Ø Schlaf</span><b>${sleep!=null?fmt(sleep)+' h':'–'}</b></div><div class="coach-tip">${advice}${prot!=null&&prot<160?' Protein liegt außerdem zu niedrig: zuerst 170 g zuverlässig treffen.':''}</div>`}

const mealPresets=[{name:'Körniger Frischkäse + Protein-Milchreis',cal:520,protein:55},{name:'Porridge + Whey',cal:500,protein:40},{name:'Whey + Banane',cal:230,protein:28},{name:'Hähnchen + Reis + Gemüse',cal:720,protein:65},{name:'Döner grob',cal:750,protein:40}];
function ensureMeals(){state.meals[todayISO()]||=[];return state.meals[todayISO()]}
function addMeal(m){ensureMeals().push({...m,id:Date.now()});saveState()}
function renderMealPresets(){document.getElementById('mealPresets').innerHTML=mealPresets.map((m,i)=>`<button data-preset="${i}">${m.name}</button>`).join('');document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>addMeal(mealPresets[+b.dataset.preset]))}
function renderMeals(){const list=ensureMeals(),root=document.getElementById('mealList');root.innerHTML=list.length?list.map(m=>`<div class="meal-log-item"><div><b>${m.name}</b><br><small>${m.cal} kcal · ${m.protein} g Protein</small></div><button data-delmeal="${m.id}">×</button></div>`).join(''):'<p class="muted">Noch nichts geloggt.</p>';document.querySelectorAll('[data-delmeal]').forEach(b=>b.onclick=()=>{state.meals[todayISO()]=list.filter(m=>m.id!==+b.dataset.delmeal);saveState()});const c=list.reduce((s,m)=>s+(+m.cal||0),0),p=list.reduce((s,m)=>s+(+m.protein||0),0),d=state.daily[todayISO()]||{},target=state.settings.vacation?null:state.settings.calories;document.getElementById('foodCalories').textContent=c;document.getElementById('foodProtein').textContent=p+' g';document.getElementById('foodCaloriesLeft').textContent=target?`${Math.max(0,target-c)} übrig`:'Urlaub: Erhalt';document.getElementById('foodProteinLeft').textContent=`${Math.max(0,state.settings.protein-p)} g übrig`;document.getElementById('foodWater').textContent=(d.water??0)+' L';document.getElementById('foodCreatine').textContent=d.creatine?'Ja':'Nein';document.getElementById('foodModeBadge').textContent=state.settings.vacation?'URLAUB':'CUT'}
document.getElementById('mealForm').onsubmit=e=>{e.preventDefault();const name=document.getElementById('mealName').value.trim(),cal=+document.getElementById('mealCalories').value,protein=+document.getElementById('mealProtein').value;if(!name||!cal)return;addMeal({name,cal,protein:protein||0});e.target.reset()};document.getElementById('clearMeals').onclick=()=>{if(confirm('Heutige Mahlzeiten leeren?')){state.meals[todayISO()]=[];saveState()}};
function renderVacation(){const c=document.getElementById('vacationCard'),b=document.getElementById('toggleVacation');c.classList.toggle('active',state.settings.vacation);b.textContent=state.settings.vacation?'Deaktivieren':'Aktivieren'}document.getElementById('toggleVacation').onclick=()=>{state.settings.vacation=!state.settings.vacation;saveState()};

const hspuStages=[{name:'Pike Push-up',need:'4×6 sauber',desc:'Schulterkraft und Vorverlagerung.'},{name:'Elevated Pike Push-up',need:'3–4×6 sauber',desc:'Füße erhöht, Hüfte über Schultern.'},{name:'Wall HSPU Negative',need:'3–5 kontrollierte Negative',desc:'Langsam absenken.'},{name:'Teil-ROM Wall HSPU',need:'mehrere saubere Reps',desc:'ROM schrittweise vergrößern.'},{name:'Full Wall HSPU',need:'3+ saubere Reps',desc:'Volle Kontrolle.'},{name:'Freier HSPU',need:'langfristig',desc:'Balance + Kraft zusammenführen.'}];
function skillReadiness(){const m=latestMeasurement();return{flag:(m.pullups||0)>=8,weighted:(m.pullups||0)>=10&&(m.dips||0)>=15}}
function renderSkillTree(){const root=document.getElementById('skillTree'),ready=skillReadiness();root.innerHTML='';hspuStages.forEach((s,i)=>{const unlocked=i<=state.skillStages.hspu+1,c=document.createElement('article');c.className=`card skill-card ${unlocked?'':'locked'}`;c.innerHTML=`<span class="skill-num">${i+1}</span><div class="eyebrow">HSPU Pfad</div><h3>${s.name}</h3><p class="muted">${s.desc}</p><ul><li>Ziel: ${s.need}</li><li>${i<=state.skillStages.hspu?'aktuelle/erreichte Stufe':'später freischalten'}</li></ul>${i===state.skillStages.hspu?'<button class="secondary full" data-advance-hspu>Stufe geschafft markieren</button>':''}`;root.appendChild(c)});const flag=document.createElement('article');flag.className=`card skill-card ${ready.flag?'':'locked'}`;flag.innerHTML=`<span class="skill-num">F</span><div class="eyebrow">Human Flag</div><h3>${ready.flag?'Grundlagen starten':'Noch nicht priorisieren'}</h3><p class="muted">${ready.flag?'Tuck-Flag und Straight-arm Basics können jetzt systematisch rein.':'Erst 8–10 saubere Pull-ups, stabile Schulter und stärkeren Core aufbauen.'}</p><ul><li>Upper arm zieht</li><li>Lower arm drückt</li><li>Seitlicher Core stabilisiert</li></ul>`;root.appendChild(flag);document.querySelector('[data-advance-hspu]')?.addEventListener('click',()=>{if(state.skillStages.hspu<hspuStages.length-1){state.skillStages.hspu++;saveState()}});renderHandstandDays()}
function renderHandstandDays(){const days=['Mo','Mi','Do','Sa'],root=document.getElementById('handstandDays'),start=weekStartISO(),map=[0,2,3,5];root.innerHTML=days.map((d,i)=>{const x=new Date(start+'T12:00:00');x.setDate(x.getDate()+map[i]);const k=x.toISOString().slice(0,10),done=!!state.handstandPractice[k];return`<button class="hs-day ${done?'done':''}" data-hsdate="${k}">${done?'✓ ':''}${d}</button>`}).join('');document.querySelectorAll('[data-hsdate]').forEach(b=>b.onclick=()=>{const k=b.dataset.hsdate;state.handstandPractice[k]=!state.handstandPractice[k];saveState()})}

async function resizePhoto(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const max=700,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.68))};img.onerror=reject;img.src=fr.result};fr.onerror=reject;fr.readAsDataURL(file)})}
document.querySelectorAll('[data-photo]').forEach(inp=>inp.onchange=async()=>{if(!inp.files[0])return;state.photos[inp.dataset.photo]=await resizePhoto(inp.files[0]);saveState();renderPhotos()});function renderPhotos(){document.querySelectorAll('[data-photo]').forEach(inp=>{const slot=inp.closest('.photo-slot'),img=slot.querySelector('img'),src=state.photos[inp.dataset.photo];slot.classList.toggle('has-image',!!src);if(src)img.src=src;else img.removeAttribute('src')})}

document.getElementById('logRunBtn').onclick=()=>{state.runs[todayISO()]={easy:true,minutes:25};saveState();document.getElementById('runStatus').textContent='Lockerer Lauf für heute geloggt ✓'};

function switchView(id){document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===id));if(id==='stats')setTimeout(()=>{drawCharts();renderWeeklyReview()},30);window.scrollTo({top:0,behavior:'smooth'})}document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>switchView(b.dataset.target));

document.getElementById('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`calisthenics-coach-v2-${todayISO()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};document.getElementById('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());state={...clone(defaultState),...d,settings:{...defaultState.settings,...(d.settings||{})},profile:{...defaultState.profile,...(d.profile||{})}};saveState();renderAll();alert('Backup importiert.')}catch{alert('Backup konnte nicht gelesen werden.')}};document.getElementById('resetBtn').onclick=()=>{if(confirm('Wirklich ALLE App-Daten löschen?')){localStorage.removeItem(STORE_KEY);state=clone(defaultState);saveState();renderAll()}};

let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden')});document.getElementById('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').classList.add('hidden')};if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
function updateOnline(){const b=document.getElementById('onlineBadge');b.textContent=navigator.onLine?'online':'offline';b.classList.toggle('offline',!navigator.onLine)}window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);

function renderAllDerived(){renderDashboard();renderMeasurements();renderMilestones();renderMeals();renderVacation();renderSkillTree();renderPhotos();renderWeeklyReview();drawCharts();}
function renderAll(){loadDailyForm();renderWorkoutTabs();renderWorkout(currentWorkoutKey());renderExerciseGrid();renderMealPresets();renderAllDerived();updateOnline()}
renderAll();
