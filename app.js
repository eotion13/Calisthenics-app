'use strict';

const STORE_KEY = 'calisthenicsCoach_v2'; // bewusst gleich: V2-Daten bleiben erhalten
const VERSION = '3.0.0';

const pad = n => String(n).padStart(2, '0');
const localDateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDateKey = key => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};
const addDaysKey = (key, days) => {
  const d = parseDateKey(key); d.setDate(d.getDate() + days); return localDateKey(d);
};
const weekStartKey = (key = localDateKey()) => {
  const d = parseDateKey(key); const dow = d.getDay(); const diff = dow === 0 ? -6 : 1 - dow; d.setDate(d.getDate() + diff); return localDateKey(d);
};
const weekKeys = (key = localDateKey()) => Array.from({ length: 7 }, (_, i) => addDaysKey(weekStartKey(key), i));
const fmt = (n, digits = 1) => Number.isFinite(+n) ? (+n).toFixed(digits).replace(/\.0$/, '') : '–';
const clone = obj => JSON.parse(JSON.stringify(obj));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
const deDate = key => parseDateKey(key).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const deDateLong = key => parseDateKey(key).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const dayDiff = (a, b) => Math.round((parseDateKey(b) - parseDateKey(a)) / 86400000);

const defaultState = {
  profile: {
    age: 34, sex: 'm', height: 180, startWeight: 87, bands: [10, 20, 30], sleepBaseline: '5–6',
    goal: 'Maximale Kraft → Muskeln → shredded → Handstand-Skills'
  },
  settings: { calories: 2300, protein: 170, carbs: 245, fat: 70, fiber: 30, creatine: 5, vacation: false },
  daily: {}, meals: {}, workouts: {}, handstandPractice: {}, runs: {},
  measurements: [],
  strengthTests: [{ date: '2026-09-07', pullups: 2, dips: 10, handstand: 5, hang: 45, hspu: 0 }],
  photoSets: [],
  skillStages: { hspu: 0, flag: 0 },
  app: { version: VERSION }
};

function migrate(raw) {
  const out = {
    ...clone(defaultState),
    ...raw,
    profile: { ...defaultState.profile, ...(raw.profile || {}) },
    settings: { ...defaultState.settings, ...(raw.settings || {}) },
    skillStages: { ...defaultState.skillStages, ...(raw.skillStages || {}) },
    app: { version: VERSION }
  };

  out.daily ||= {}; out.meals ||= {}; out.workouts ||= {}; out.handstandPractice ||= {}; out.runs ||= {};
  out.measurements = Array.isArray(raw.measurements) ? raw.measurements.filter(x => x && x.date && x.waist != null).map(x => ({ date: x.date, waist: +x.waist })) : [];

  if (Array.isArray(raw.strengthTests)) {
    out.strengthTests = raw.strengthTests;
  } else if (Array.isArray(raw.measurements)) {
    const legacyStrength = raw.measurements
      .filter(x => x && x.date && [x.pullups, x.dips, x.handstand, x.hang, x.hspu].some(v => v != null))
      .map(x => ({ date: x.date, pullups: +x.pullups || 0, dips: +x.dips || 0, handstand: +x.handstand || 0, hang: +x.hang || 0, hspu: +x.hspu || 0 }));
    out.strengthTests = legacyStrength.length ? legacyStrength : clone(defaultState.strengthTests);
  }
  if (!Array.isArray(out.strengthTests) || !out.strengthTests.length) out.strengthTests = clone(defaultState.strengthTests);

  out.photoSets = Array.isArray(raw.photoSets) ? raw.photoSets : [];
  if (!out.photoSets.length && raw.photos && Object.values(raw.photos).some(Boolean)) {
    out.photoSets.push({ date: localDateKey(), front: raw.photos.front || '', side: raw.photos.side || '', back: raw.photos.back || '' });
  }
  return out;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? migrate(JSON.parse(raw)) : clone(defaultState);
  } catch (e) {
    console.warn('State konnte nicht geladen werden', e);
    return clone(defaultState);
  }
}

let state = loadState();
function saveState(render = true) {
  state.app = { version: VERSION };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  if (render) renderAllDerived();
}

const EX = {
  warmup: {
    name: 'Warm-up Schulter & Ellenbogen', cat: 'Vorbereitung', visual: 'warmup',
    prescription: 'ca. 5 Minuten',
    cues: ['Locker und kontrolliert – nicht ermüden.', 'Bei scharfem oder zunehmendem Schmerz nicht hineintrainieren.'],
    mistakes: ['Warm-up als Workout behandeln.', 'Schmerz durch aggressive Endpositionen erzwingen.'],
    progress: 'Ziel ist nur: warm, beweglich und kontrolliert in die Hauptübungen starten.'
  },
  handstand: {
    name: 'Handstand-Block', cat: 'Skill', visual: 'handstand',
    prescription: 'Chest-to-wall + freie Kick-ups',
    cues: ['Chest-to-wall: 3×20–30 s.', 'Danach 5–8 kontrollierte freie Kick-ups.', 'Bauch/Po fest, Rippen einziehen, Schultern aktiv hochdrücken.', 'Fingerspitzen aktiv zum Balancieren nutzen.'],
    mistakes: ['Bananenform im Hohlkreuz.', 'Zu hart hochkicken.', 'Bis zur völligen Ermüdung weiterprobieren.'],
    progress: 'Phase-1-Ziel: 10+ Sekunden freier Handstand reproduzierbar.'
  },
  pullup: {
    name: 'Strikte Pull-ups', cat: 'Pull', visual: 'pullup',
    cues: ['Aus aktivem Hang starten.', 'Kinn klar über die Stange.', 'Kein Kipping und kein Beinpendeln.'],
    mistakes: ['Halbe ROM.', 'Hals nach vorne strecken statt den Körper hochzuziehen.'],
    progress: '2 → 4 → 6 → 8–10 strikt. Danach Weighted Pull-ups.'
  },
  bandPullA: {
    name: 'Band Pull-ups · Kraftvolumen', cat: 'Pull', visual: 'pullupBand',
    cues: ['Leichtestes Band nehmen, mit dem alle Sätze sauber gehen.', 'Volle Streckung unten.', 'Ziel: 1–2 saubere Wiederholungen im Tank.'],
    mistakes: ['Stärkeres Band nehmen, nur um mehr Wiederholungen zu sammeln.', 'Mit den Beinen schwingen.'],
    progress: '4×6 sauber → weniger Hilfe: 30 → 20 → 10 → ohne Band.'
  },
  bandPullB: {
    name: 'Band Pull-ups · Volumen', cat: 'Pull', visual: 'pullupBand',
    cues: ['Donnerstag keine Maximalversuche.', 'Jede Wiederholung gleich sauber.', '1–2 Wiederholungen im Tank.'],
    mistakes: ['Die letzten Wiederholungen mit Kipping retten.'],
    progress: '4×8 sauber → weniger Bandhilfe.'
  },
  dips: {
    name: 'Dips', cat: 'Push', visual: 'dip',
    cues: ['Schultern stabil halten.', 'Kontrollierte Tiefe, die deine vordere Schulter nicht reizt.', 'Rumpf fest.'],
    mistakes: ['Tiefer gehen, obwohl die Schulter meckert.', 'Zwischen den Holmen schwingen.'],
    progress: 'Mehrere Sessions 3×10 sauber → Zusatzgewicht, sobald Equipment da ist.'
  },
  rows: {
    name: 'Schwere Inverted Rows', cat: 'Pull', visual: 'row',
    cues: ['Körper wie ein Brett.', 'Brust zur Stange.', 'Schulterblätter hinten zusammen.'],
    mistakes: ['Hüfte absinken lassen.', 'Nur aus den Armen ziehen.'],
    progress: '3×12 → Füße höher / Körper horizontaler / später Zusatzlast.'
  },
  bulgarian: {
    name: 'Bulgarian Split Squats', cat: 'Beine', visual: 'split',
    cues: ['Du startest ohne Zusatzgewicht; das Bild zeigt die gleiche Technik optional mit Gewicht.', '3 Sekunden kontrolliert absenken.', 'Über den ganzen Vorderfuß drücken.', 'Knie folgt der Fußrichtung.'],
    mistakes: ['Auf die Zehenspitze kippen.', 'Tempo beschleunigen, um Reps zu retten.'],
    progress: 'Oberes Ende leicht → Rucksack beladen.'
  },
  hollow: {
    name: 'Hollow Body Hold', cat: 'Core', visual: 'hollow',
    cues: ['Unteren Rücken fest in den Boden drücken.', 'Rippen einziehen.', 'Beine nur so tief, wie der Rücken Kontakt hält.'],
    mistakes: ['Hohlkreuz zulassen.'],
    progress: 'Bis 40 s sauber → Hebel verlängern / Arme weiter nach hinten.'
  },
  pike: {
    name: 'Pike Push-ups', cat: 'HSPU', visual: 'pike',
    cues: ['Hüfte hoch.', 'Kopf VOR den Händen Richtung Boden.', 'Schultern nach vorne über die Hände bringen.'],
    mistakes: ['Wie einen normalen Push-up ausführen.', 'Kopf einfach zwischen die Hände senken.'],
    progress: '4×6 sauber → Füße erhöhen → Negative HSPU → Teil-ROM → Wall HSPU → frei.'
  },
  pistol: {
    name: 'Assisted Pistol Squat', cat: 'Beine', visual: 'pistol',
    cues: ['Nur so viel Hilfe wie nötig.', 'Kontrolliert tief gehen.', 'Knie stabil über dem Fuß.'],
    mistakes: ['In die Tiefe fallen.'],
    progress: 'Donnerstags wochenweise mit Bulgarian Split Squats abwechseln.'
  },
  kneeRaises: {
    name: 'Hanging Knee Raises', cat: 'Core', visual: 'kneeRaise',
    cues: ['Vor jeder Wiederholung Pendeln stoppen.', 'Knie hoch und Becken oben leicht einrollen.'],
    mistakes: ['Die Knie aus Hüftschwung hochreißen.'],
    progress: '3×10 ohne Schwingen → langsam Richtung Leg Raises.'
  },
  deadHang: {
    name: 'Dead Hang', cat: 'Grip', visual: 'hang',
    cues: ['Griff fest, aber nicht verkrampft.', 'Bei zunehmendem Ellenbogenschmerz abbrechen.'],
    mistakes: ['Schmerz ignorieren, nur um die Zeit zu erzwingen.'],
    progress: '60–90 s → Towel Hangs / Uneven Hangs / Weighted Hangs.'
  },
  pushupHard: {
    name: 'Schwere Push-up-Variante', cat: 'Push', visual: 'pushup',
    cues: ['Variante wählen, bei der 8–15 Reps wirklich fordern.', 'Körper gerade.', 'Brust kontrolliert tief.'],
    mistakes: ['Hüfte absinken lassen.'],
    progress: '3×15 → Füße höher / langsamere Exzentrik / schwerere Variante.'
  },
  bandRow: {
    name: 'Band Rows', cat: 'Pull', visual: 'bandRow',
    cues: ['Band sicher befestigen.', 'Ellbogen Richtung Hüfte.', 'Schulterblätter aktiv zurück.'],
    mistakes: ['Oberkörper nach hinten werfen.'],
    progress: '3×20 → mehr Bandspannung.'
  },
  facePull: {
    name: 'Band Face Pull / Pull Apart', cat: 'Schulter', visual: 'facePull',
    cues: ['Leicht bis moderat.', 'Hintere Schulter arbeiten lassen.', 'Rippen unten halten.'],
    mistakes: ['Zu schwer wählen und Schwung nehmen.'],
    progress: '25 sauber → Spannung leicht erhöhen.'
  },
  sidePlank: {
    name: 'Side Plank', cat: 'Core', visual: 'sidePlank',
    cues: ['Körper als gerade Linie.', 'Becken oben halten.'],
    mistakes: ['Becken absinken lassen.'],
    progress: 'Bis 60 s → längerer Hebel / obere Beinvariante.'
  }
};

const VISUAL_ASSETS = {
  warmup: 'assets/exercises/warmup.webp',
  handstand: 'assets/exercises/handstand.webp',
  pullup: 'assets/exercises/pullup.webp',
  pullupBand: 'assets/exercises/pullupBand.webp',
  dip: 'assets/exercises/dip.webp',
  row: 'assets/exercises/row.webp',
  split: 'assets/exercises/split.webp',
  pike: 'assets/exercises/pike.webp',
  pistol: 'assets/exercises/pistol.webp',
  kneeRaise: 'assets/exercises/kneeRaise.webp',
  hang: 'assets/exercises/hang.webp',
  pushup: 'assets/exercises/pushup.webp',
  bandRow: 'assets/exercises/bandRow.webp',
  facePull: 'assets/exercises/facePull.webp',
  sidePlank: 'assets/exercises/sidePlank.webp',
  hollow: 'assets/exercises/hollow.webp',
  circles: 'assets/exercises/circles.webp',
  wrists: 'assets/exercises/wrists.webp',
  pullapart: 'assets/exercises/pullapart.webp',
  external: 'assets/exercises/external.webp',
  scapPull: 'assets/exercises/scapPull.webp',
  scapPush: 'assets/exercises/scapPush.webp'
};

function visualHTML(kind, compact = false, alt = '') {
  const src = VISUAL_ASSETS[kind] || VISUAL_ASSETS.warmup;
  const cls = compact ? 'exercise-photo compact' : 'exercise-photo';
  const safeAlt = alt || 'Übungsbild';
  return `<img src="${src}" alt="${safeAlt}" loading="lazy" class="${cls}">`;
}

const WARMUP_STEPS = [
  ['Armkreisen', '30–45 s je Richtung', 'circles'],
  ['Handgelenke mobilisieren', '30–45 s', 'wrists'],
  ['Band Pull-Aparts', '2×15', 'pullapart'],
  ['Band External Rotation', '2×12 je Seite', 'external'],
  ['Scapular Pull-ups', '2×5', 'scapPull'],
  ['Scapular Push-ups', '1×10', 'scapPush']
];

function workoutTemplate(key, dateKey = localDateKey()) {
  const week = isoWeekNumber(parseDateKey(dateKey));
  const thursdayLeg = week % 2 === 0 ? 'pistol' : 'bulgarian';
  const common = {
    A: {
      label: 'Montag · Park A', short: 'Mo', duration: '45–60 Min.', focus: 'Pull + Push + Handstand',
      items: [
        { id: 'warmup', special: 'warmup' },
        { id: 'handstand', special: 'handstand', minutes: 8 },
        { id: 'pullup', sets: 1, min: 1, max: 2, unit: 'reps', rest: 180 },
        { id: 'bandPullA', sets: 4, min: 4, max: 6, unit: 'reps', rest: 180, loadType: 'band' },
        { id: 'dips', sets: 3, min: 6, max: 9, unit: 'reps', rest: 150 },
        { id: 'rows', sets: 3, min: 8, max: 12, unit: 'reps', rest: 120 },
        { id: 'bulgarian', sets: 3, min: 8, max: 12, unit: 'reps', rest: 90, suffix: 'je Bein · 3 s runter' },
        { id: 'hollow', sets: 3, min: 20, max: 30, unit: 's', rest: 60 }
      ]
    },
    B: {
      label: 'Donnerstag · Park B', short: 'Do', duration: '45–60 Min.', focus: 'HSPU-Kraft + Pull',
      items: [
        { id: 'warmup', special: 'warmup' },
        { id: 'handstand', special: 'handstand', minutes: 8 },
        { id: 'pike', sets: 4, min: 3, max: 5, unit: 'reps', rest: 150, progressGoal: '4×6 = nächste Stufe' },
        { id: 'bandPullB', sets: 4, min: 5, max: 8, unit: 'reps', rest: 150, loadType: 'band' },
        { id: 'dips', sets: 3, min: 6, max: 10, unit: 'reps', rest: 150 },
        { id: thursdayLeg, sets: 3, min: 8, max: 12, unit: 'reps', rest: 90, suffix: 'je Bein', dynamicLeg: true },
        { id: 'kneeRaises', sets: 3, min: 6, max: 10, unit: 'reps', rest: 90 },
        { id: 'deadHang', sets: 2, min: 30, max: 45, unit: 's', rest: 90 }
      ],
      legChoice: thursdayLeg
    },
    C: {
      label: 'Wochenende · Home C', short: 'WE', duration: '35–50 Min.', focus: 'Technik + Volumen · bei Schlafmangel optional',
      items: [
        { id: 'handstand', special: 'handstand', minutes: 12, range: '10–15 Min.' },
        { id: 'pike', sets: 3, min: 5, max: 8, unit: 'reps', rest: 120 },
        { id: 'pushupHard', sets: 3, min: 8, max: 15, unit: 'reps', rest: 90 },
        { id: 'bulgarian', sets: 3, min: 10, max: 15, unit: 'reps', rest: 90, suffix: 'je Bein' },
        { id: 'bandRow', sets: 3, min: 12, max: 20, unit: 'reps', rest: 75, loadType: 'resistance' },
        { id: 'facePull', sets: 3, min: 15, max: 25, unit: 'reps', rest: 60, loadType: 'resistance' },
        { id: 'sidePlank', sets: 3, min: 30, max: 45, unit: 's', rest: 60, suffix: 'je Seite' },
        { id: 'hollow', sets: 3, min: 20, max: 40, unit: 's', rest: 60 }
      ]
    }
  };
  return clone(common[key]);
}

function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function sessions() {
  return Object.entries(state.workouts || {}).flatMap(([date, value]) => {
    const arr = Array.isArray(value) ? value : [value];
    return arr.filter(Boolean).map(s => ({ date: s.date || date, ...s }));
  }).filter(s => s.completed);
}

function weekSessions(key = localDateKey()) {
  const days = new Set(weekKeys(key));
  return sessions().filter(s => days.has(s.date));
}
function workoutDoneThisWeek(workoutKey, key = localDateKey()) { return weekSessions(key).some(s => s.key === workoutKey); }
function weekendDone(key = localDateKey()) { return workoutDoneThisWeek('C', key); }
function workoutDoneDate(key, workoutKey) {
  return sessions().some(s => s.date === key && (!workoutKey || s.key === workoutKey));
}

function planForDate(key = localDateKey()) {
  const d = parseDateKey(key); const dow = d.getDay();
  if (dow === 1) return { type: 'workout', workout: 'A', title: 'Park A · Pull + Push + Handstand', duration: '45–60 Min.' };
  if (dow === 2) return { type: 'recovery', title: 'Pause · optional lockerer Lauf', duration: '20–30 Min. optional' };
  if (dow === 3) return { type: 'skill', title: 'Handstand-Technik', duration: '5–10 Min.' };
  if (dow === 4) return { type: 'workout', workout: 'B', title: 'Park B · HSPU-Kraft + Pull', duration: '45–60 Min.' };
  if (dow === 5) return { type: 'recovery', title: 'Pause / Regeneration', duration: 'kein Krafttraining' };
  if (dow === 6) {
    if (weekendDone(key)) return { type: 'recovery', title: 'Home C ist diese Woche erledigt', duration: 'Pause' };
    return { type: 'workout', workout: 'C', optional: true, title: 'Home C · Technik + Volumen', duration: '35–50 Min.' };
  }
  if (weekendDone(key)) return { type: 'recovery', title: 'Wochenende erledigt · Pause', duration: 'Regeneration' };
  return { type: 'workout', workout: 'C', optional: true, title: 'Home C · falls Samstag nicht gemacht', duration: '35–50 Min.' };
}

function todayDaily() { return state.daily[localDateKey()] || {}; }
function recoveryDecision(key = localDateKey()) {
  const d = state.daily[key] || {};
  const pain = Math.max(+d.elbow || 0, +d.shoulder || 0);
  if (d.sleep == null || +d.sleep <= 0) return { mode: 'CHECK', score: null, text: 'Bitte zuerst Schlaf sowie Ellenbogen/Schulter im Tagescheck eintragen.' };
  const sleep = +d.sleep || 0, energy = +d.energy || 3;
  const score = clamp(Math.round((Math.min(sleep / 8, 1) * 45) + (energy / 5 * 35) + ((10 - pain) / 10 * 20)), 0, 100);
  if (pain >= 4) return { mode: 'STOP', score, text: 'Heute kein schmerzhaftes Oberkörpertraining. Wenn Beschwerden anhalten oder zunehmen: Belastung reduzieren und abklären lassen.' };
  if (sleep < 5 || energy <= 1) return { mode: 'REDUCED', score, text: 'Sehr wenig Recovery: Technik sauber halten, 2–3 RIR, keine Maximalversuche; Home C notfalls verschieben.' };
  if (sleep < 6 || pain >= 2 || energy === 2) return { mode: 'LIGHT', score, text: 'Leicht reduzieren: 2 RIR, saubere Technik, keine erzwungenen Wiederholungen.' };
  return { mode: 'NORMAL', score, text: 'Normales Training. Bei den meisten Sätzen 1–2 RIR lassen.' };
}

function mealTotals(key = localDateKey()) {
  const list = state.meals[key] || [];
  const sum = field => list.reduce((s, m) => s + (+m[field] || 0), 0);
  return {
    calories: Math.round(sum('cal')),
    protein: +sum('protein').toFixed(1),
    carbs: +sum('carbs').toFixed(1),
    fat: +sum('fat').toFixed(1),
    fiber: +sum('fiber').toFixed(1)
  };
}

// Richtwerte pro 100 g / 100 ml. Bei verpackten Produkten gilt das Etikett.
const FOOD_DB = [
  {id:'chicken',name:'Hähnchenbrust, gegart',aliases:'huhn chicken brust halal',cat:'Protein',kcal:165,p:31,c:0,f:3.6,fi:0,portion:200},
  {id:'turkey',name:'Putenbrust, gegart',aliases:'pute turkey halal',cat:'Protein',kcal:135,p:29,c:0,f:1.5,fi:0,portion:200},
  {id:'beeflean',name:'Rindfleisch, mager',aliases:'rind beef halal steak',cat:'Protein',kcal:200,p:26,c:0,f:10,fi:0,portion:200},
  {id:'mincelean',name:'Rinderhack, mager',aliases:'hackfleisch rind halal',cat:'Protein',kcal:180,p:25,c:0,f:8,fi:0,portion:200},
  {id:'salmon',name:'Lachs',aliases:'salmon fisch',cat:'Protein',kcal:208,p:20,c:0,f:13,fi:0,portion:180},
  {id:'tuna',name:'Thunfisch in Wasser, abgetropft',aliases:'thunfisch tuna dose',cat:'Protein',kcal:116,p:26,c:0,f:1,fi:0,portion:150},
  {id:'egg',name:'Ei',aliases:'eier eggs',cat:'Protein',kcal:143,p:12.6,c:0.7,f:9.5,fi:0,portion:60,portionLabel:'1 Ei ≈ 60 g'},
  {id:'eggwhite',name:'Eiklar',aliases:'eiweiss egg white',cat:'Protein',kcal:52,p:11,c:0.7,f:0.2,fi:0,portion:150},
  {id:'cottage',name:'Körniger Frischkäse light / laktosefrei',aliases:'hüttenkäse cottage frischkäse',cat:'Milchprotein',kcal:82,p:13,c:3,f:2,fi:0,portion:250},
  {id:'skyr',name:'Skyr natur, laktosefrei',aliases:'skyr joghurt yogurt',cat:'Milchprotein',kcal:63,p:11,c:4,f:0.2,fi:0,portion:250},
  {id:'quark',name:'Magerquark, laktosefrei',aliases:'quark mager',cat:'Milchprotein',kcal:67,p:12,c:4,f:0.2,fi:0,portion:250},
  {id:'greekyogurt',name:'Griechischer Joghurt 2 %',aliases:'joghurt yogurt griechisch',cat:'Milchprotein',kcal:73,p:9,c:4,f:2,fi:0,portion:250},
  {id:'whey',name:'Whey Protein',aliases:'proteinpulver protein shake isolat isolate',cat:'Supplement',kcal:390,p:78,c:8,f:6,fi:1,portion:30,portionLabel:'1 Scoop ≈ 30 g'},
  {id:'proteinpudding',name:'Protein-Pudding',aliases:'high protein pudding',cat:'Milchprotein',kcal:75,p:10,c:6,f:1.5,fi:0,portion:200},
  {id:'proteinrice',name:'Protein-Milchreis',aliases:'protein reis pudding milchreis',cat:'Milchprotein',kcal:80,p:10,c:7,f:1.5,fi:0,portion:200},
  {id:'milk15',name:'Milch 1,5 %, laktosefrei',aliases:'milch lactosefree milk',cat:'Getränk',kcal:47,p:3.4,c:4.8,f:1.5,fi:0,portion:250,unit:'ml',portionLabel:'1 Glas ≈ 250 ml'},

  {id:'oats',name:'Haferflocken',aliases:'hafer oats porridge',cat:'Kohlenhydrate',kcal:372,p:13.5,c:59,f:7,fi:10,portion:70},
  {id:'ricecooked',name:'Reis, gekocht',aliases:'reis basmati jasmin cooked',cat:'Kohlenhydrate',kcal:130,p:2.7,c:28,f:0.3,fi:0.4,portion:250},
  {id:'ricedry',name:'Reis, roh / trocken',aliases:'reis trocken roh ungekocht',cat:'Kohlenhydrate',kcal:350,p:7,c:78,f:0.7,fi:1.3,portion:80},
  {id:'potato',name:'Kartoffeln, gekocht',aliases:'kartoffel potato',cat:'Kohlenhydrate',kcal:77,p:2,c:17,f:0.1,fi:2.2,portion:300},
  {id:'sweetpotato',name:'Süßkartoffel',aliases:'süsskartoffel sweet potato',cat:'Kohlenhydrate',kcal:86,p:1.6,c:20,f:0.1,fi:3,portion:250},
  {id:'pasta',name:'Nudeln, gekocht',aliases:'pasta spaghetti',cat:'Kohlenhydrate',kcal:157,p:5.8,c:31,f:0.9,fi:1.8,portion:250},
  {id:'pastawhole',name:'Vollkornnudeln, gekocht',aliases:'vollkorn pasta nudeln',cat:'Kohlenhydrate',kcal:149,p:5.5,c:27,f:1.4,fi:4,portion:250},
  {id:'breadwhole',name:'Vollkornbrot',aliases:'brot bread',cat:'Kohlenhydrate',kcal:230,p:8.5,c:40,f:3.5,fi:7,portion:50,portionLabel:'1–2 Scheiben ≈ 50 g'},
  {id:'wrap',name:'Weizen-Wrap / Tortilla',aliases:'wrap tortilla',cat:'Kohlenhydrate',kcal:300,p:8,c:50,f:7,fi:3,portion:65,portionLabel:'1 Wrap ≈ 65 g'},
  {id:'ricecake',name:'Reiswaffeln',aliases:'reiswaffel rice cake',cat:'Kohlenhydrate',kcal:385,p:8,c:81,f:3,fi:3,portion:18,portionLabel:'2 Stück ≈ 18 g'},

  {id:'banana',name:'Banane',aliases:'banana',cat:'Obst',kcal:89,p:1.1,c:23,f:0.3,fi:2.6,portion:120,portionLabel:'1 Banane ≈ 120 g'},
  {id:'apple',name:'Apfel',aliases:'apple',cat:'Obst',kcal:52,p:0.3,c:14,f:0.2,fi:2.4,portion:180,portionLabel:'1 Apfel ≈ 180 g'},
  {id:'orange',name:'Orange',aliases:'apfelsine',cat:'Obst',kcal:47,p:0.9,c:12,f:0.1,fi:2.4,portion:180},
  {id:'berries',name:'Beeren, gemischt',aliases:'beeren himbeeren blaubeeren erdbeeren',cat:'Obst',kcal:50,p:1,c:10,f:0.5,fi:4,portion:150},
  {id:'grapes',name:'Weintrauben',aliases:'trauben grapes',cat:'Obst',kcal:69,p:0.7,c:18,f:0.2,fi:0.9,portion:150},
  {id:'avocado',name:'Avocado',aliases:'avocado',cat:'Fette',kcal:160,p:2,c:8.5,f:15,fi:6.7,portion:100},

  {id:'broccoli',name:'Brokkoli',aliases:'broccoli gemüse',cat:'Gemüse',kcal:34,p:2.8,c:7,f:0.4,fi:2.6,portion:200},
  {id:'spinach',name:'Spinat',aliases:'spinach gemüse',cat:'Gemüse',kcal:23,p:2.9,c:3.6,f:0.4,fi:2.2,portion:150},
  {id:'mixedveg',name:'Gemüsemix, ohne Sauce',aliases:'gemüse mix tiefkühl tk',cat:'Gemüse',kcal:50,p:2.5,c:8,f:0.5,fi:3,portion:250},
  {id:'tomato',name:'Tomate',aliases:'tomaten tomato',cat:'Gemüse',kcal:18,p:0.9,c:3.9,f:0.2,fi:1.2,portion:150},
  {id:'cucumber',name:'Gurke',aliases:'gurken cucumber',cat:'Gemüse',kcal:15,p:0.7,c:3.6,f:0.1,fi:0.5,portion:200},
  {id:'pepper',name:'Paprika',aliases:'paprika pepper',cat:'Gemüse',kcal:31,p:1,c:6,f:0.3,fi:2.1,portion:150},
  {id:'salad',name:'Blattsalat',aliases:'salat lettuce',cat:'Gemüse',kcal:15,p:1.4,c:2.9,f:0.2,fi:1.3,portion:100},

  {id:'lentils',name:'Linsen, gekocht',aliases:'linsen lentils',cat:'Hülsenfrüchte',kcal:116,p:9,c:20,f:0.4,fi:7.9,portion:200},
  {id:'chickpeas',name:'Kichererbsen, gekocht',aliases:'kichererbsen chickpeas',cat:'Hülsenfrüchte',kcal:164,p:8.9,c:27,f:2.6,fi:7.6,portion:180},
  {id:'kidney',name:'Kidneybohnen, gekocht',aliases:'bohnen kidney beans',cat:'Hülsenfrüchte',kcal:127,p:8.7,c:23,f:0.5,fi:6.4,portion:180},

  {id:'oliveoil',name:'Olivenöl',aliases:'öl olive oil',cat:'Fette',kcal:884,p:0,c:0,f:100,fi:0,portion:10,portionLabel:'1 EL ≈ 10 g'},
  {id:'almonds',name:'Mandeln',aliases:'nüsse nuts almonds',cat:'Fette',kcal:579,p:21,c:22,f:50,fi:12.5,portion:30},
  {id:'mixednuts',name:'Nussmix',aliases:'nüsse nuts',cat:'Fette',kcal:607,p:20,c:15,f:54,fi:8,portion:30},
  {id:'peanutbutter',name:'Erdnussbutter',aliases:'peanut butter erdnuss',cat:'Fette',kcal:588,p:25,c:20,f:50,fi:6,portion:20},

  {id:'doner',name:'Döner Kebab, grob',aliases:'döner kebab dönertasche',cat:'Fast Food',kcal:215,p:12,c:20,f:9,fi:1.5,portion:350,portionLabel:'1 Döner ≈ 350 g'},
  {id:'donerplate',name:'Dönerteller mit Reis/Salat, grob',aliases:'dönerteller döner teller',cat:'Fast Food',kcal:180,p:13,c:15,f:7,fi:1.5,portion:500},
  {id:'pizza',name:'Pizza Margherita, grob',aliases:'pizza',cat:'Fast Food',kcal:250,p:10,c:31,f:9,fi:2.2,portion:350},
  {id:'fries',name:'Pommes frites',aliases:'pommes fries',cat:'Fast Food',kcal:312,p:3.4,c:41,f:15,fi:3.8,portion:150},
  {id:'burger',name:'Burger, einfach, grob',aliases:'burger hamburger',cat:'Fast Food',kcal:260,p:14,c:24,f:12,fi:1.5,portion:220},
  {id:'chocolatemilk',name:'Kakao / Schokomilch',aliases:'kakao schokomilch',cat:'Getränk',kcal:75,p:3.2,c:11,f:2,fi:0.5,portion:250,unit:'ml'},
  {id:'juice',name:'Orangensaft / Saft',aliases:'saft juice',cat:'Getränk',kcal:45,p:0.7,c:10.4,f:0.2,fi:0.2,portion:250,unit:'ml'},
  {id:'zero',name:'Zero-Getränk',aliases:'cola zero pepsi zero softdrink',cat:'Getränk',kcal:0,p:0,c:0,f:0,fi:0,portion:330,unit:'ml'},
  {id:'chocolate',name:'Schokolade, Vollmilch',aliases:'schokolade chocolate süßigkeit',cat:'Snack',kcal:535,p:7.5,c:59,f:30,fi:3,portion:25},
  {id:'dates',name:'Datteln',aliases:'datteln dates',cat:'Snack',kcal:282,p:2.5,c:75,f:0.4,fi:8,portion:30}
];

const MEAL_PRESETS = [
  { name: 'Körniger Frischkäse + Protein-Milchreis', cal: 405, protein: 52.5, carbs: 21.5, fat: 8, fiber: 0 },
  { name: 'Porridge + Whey', cal: 377, protein: 32.9, carbs: 43.7, fat: 6.7, fiber: 7.3 },
  { name: 'Whey + Banane', cal: 224, protein: 24.7, carbs: 30, fat: 2.2, fiber: 3.4 },
  { name: 'Hähnchen + Reis + Gemüse', cal: 705, protein: 70, carbs: 90, fat: 9, fiber: 8 },
  { name: 'Döner grob', cal: 753, protein: 42, carbs: 70, fat: 31.5, fiber: 5.3 }
];

const normalizeFoodText = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').trim();
const round1 = n => Math.round((+n || 0) * 10) / 10;
let selectedFood = null;

function foodMacros(food, amount) {
  const factor = Math.max(0, +amount || 0) / 100;
  return {
    cal: Math.round(food.kcal * factor),
    protein: round1(food.p * factor),
    carbs: round1(food.c * factor),
    fat: round1(food.f * factor),
    fiber: round1(food.fi * factor)
  };
}

function foodCoachAnalysis(totals = mealTotals()) {
  const target = state.settings;
  const left = {
    cal: target.calories - totals.calories,
    p: target.protein - totals.protein,
    c: target.carbs - totals.carbs,
    f: target.fat - totals.fat,
    fi: target.fiber - totals.fiber
  };
  if (state.settings.vacation) {
    return { badge:'URLAUB', cls:'light', title:'Protein zuerst', text:`Heute ${Math.round(totals.protein)} g Protein. Im Urlaub reicht: Protein zu jeder Hauptmahlzeit, Wasser/Zero und nicht jedes Buffet maximal ausnutzen.`, short:`Urlaubsmodus · ${Math.max(0,Math.round(left.p))} g Protein bis zum normalen Ziel.` };
  }
  if (totals.calories === 0) {
    return { badge:'START', cls:'', title:'Noch nichts gegessen', text:'Starte mit einer proteinreichen Mahlzeit. Hähnchen, Skyr, körniger Frischkäse oder Eier + eine Kohlenhydratquelle passen gut.', short:'Noch nichts geloggt · erste Mahlzeit proteinreich planen.' };
  }
  if (left.cal < -150) {
    let extra = left.p > 15 ? ` Protein fehlen trotzdem noch etwa ${Math.round(left.p)} g – falls Hunger da ist, sehr mager auffüllen (z. B. Skyr/Whey/Thunfisch).` : ' Protein ist ausreichend.';
    return { badge:'KCAL HOCH', cls:'stop', title:'Kalorien heute zu hoch', text:`Du liegst etwa ${Math.abs(Math.round(left.cal))} kcal über deinem Ziel.${extra} Jetzt keine kaloriendichten Extras mehr nötig.`, short:`${Math.abs(Math.round(left.cal))} kcal über Ziel · ${left.p>0?Math.round(left.p)+' g Protein fehlen':'Protein passt'}.` };
  }
  if (left.p > 35 && left.cal < 350) {
    return { badge:'PROTEIN', cls:'light', title:'Protein fehlt – Kalorien sind knapp', text:`Noch ca. ${Math.round(left.p)} g Protein, aber nur ${Math.max(0,Math.round(left.cal))} kcal frei. Nimm jetzt etwas sehr Proteinreiches: 30 g Whey, 250 g Skyr oder 150 g Thunfisch/Hähnchen.`, short:`Protein priorisieren: ${Math.round(left.p)} g fehlen, ${Math.max(0,Math.round(left.cal))} kcal übrig.` };
  }
  if (left.p > 25) {
    let suggestion;
    if (left.p > 50 && left.cal >= 450) suggestion = 'Sehr effizient: 200 g Hähnchen und später 250 g Skyr – damit holst du viel Protein bei moderaten Kalorien.';
    else if (left.cal > 550) suggestion = 'Gute nächste Mahlzeit: 200 g Hähnchen + 250 g gekochter Reis + Gemüse.';
    else suggestion = 'Gute Optionen: 250 g Skyr plus 30 g Whey oder 200 g mageres Hähnchen/Thunfisch.';
    return { badge:'EIWEISS', cls:'light', title:`Noch ${Math.round(left.p)} g Protein`, text:`Du hast noch ca. ${Math.max(0,Math.round(left.cal))} kcal frei. ${suggestion}`, short:`${Math.round(left.p)} g Protein fehlen · ${Math.max(0,Math.round(left.cal))} kcal übrig.` };
  }
  if (totals.fat > target.fat + 10 && left.cal > 100) {
    return { badge:'FETT HOCH', cls:'light', title:'Fett ist heute schon hoch', text:`Du liegst bei etwa ${Math.round(totals.fat)} g Fett. Für den Rest des Tages eher mager essen: Hähnchen, Thunfisch, Skyr, Reis/Kartoffeln und Gemüse – Öl, Nüsse und sehr fettes Fast Food heute klein halten.`, short:`Fett bei ${Math.round(totals.fat)} g · Rest des Tages eher mager wählen.` };
  }
  if (left.fi > 10 && left.cal > 150) {
    return { badge:'BALLASTSTOFFE', cls:'light', title:'Protein passt – Ballaststoffe fehlen', text:`Protein ist fast/komplett drin. Noch ca. ${Math.round(left.fi)} g Ballaststoffe fehlen. Ergänze Gemüse, Beeren, Apfel, Linsen oder Haferflocken.`, short:`Protein passt · noch ${Math.round(left.fi)} g Ballaststoffe anpeilen.` };
  }
  if (left.cal > 450) {
    return { badge:'MEHR ESSEN', cls:'', title:'Du hast noch Luft', text:`Noch ungefähr ${Math.round(left.cal)} kcal frei. Protein ist gut. Fülle jetzt vor allem mit normalem Essen – Reis/Kartoffeln, Gemüse und etwas Fett nach Bedarf.`, short:`Noch ${Math.round(left.cal)} kcal frei · Protein fast/komplett getroffen.` };
  }
  if (left.cal >= -100) {
    return { badge:'PASST', cls:'', title:'Tagesziel sehr gut getroffen', text:`Kalorien und Protein liegen nah am Ziel. ${left.fi > 5 ? `Wenn noch Hunger da ist: Gemüse/Obst für etwa ${Math.round(left.fi)} g fehlende Ballaststoffe.` : 'Für heute musst du nichts erzwingen.'}`, short:'Kalorien und Protein liegen im Zielbereich.' };
  }
  return { badge:'OK', cls:'', title:'Protein passt', text:'Protein ist im Ziel. Behalte jetzt nur noch die Gesamtkalorien im Auge.', short:`Protein passt · ${Math.max(0,Math.round(left.cal))} kcal übrig.` };
}

function foodSearch(query) {
  const q = normalizeFoodText(query);
  if (!q) return FOOD_DB.filter(f => ['chicken','ricecooked','cottage','proteinrice','oats','whey','banana','skyr','egg','potato','doner','mixedveg'].includes(f.id));
  const parts = q.split(/\s+/).filter(Boolean);
  return FOOD_DB.filter(f => {
    const hay = normalizeFoodText(`${f.name} ${f.aliases || ''} ${f.cat || ''}`);
    return parts.every(part => hay.includes(part));
  }).slice(0,12);
}

function recentFoodIds() {
  const entries = Object.entries(state.meals || {}).sort(([a],[b])=>b.localeCompare(a));
  const ids=[];
  for (const [,meals] of entries) {
    for (let i=(meals||[]).length-1;i>=0;i--) {
      const id=meals[i]?.foodId;
      if (id && !ids.includes(id)) ids.push(id);
      if (ids.length>=8) return ids;
    }
  }
  return ids;
}

function addFoodEntry(food, amount, key = localDateKey()) {
  const macros = foodMacros(food, amount);
  state.meals[key] ||= [];
  state.meals[key].push({
    id: Date.now() + Math.floor(Math.random()*1000), foodId: food.id, name: food.name,
    amount: round1(amount), unit: food.unit || 'g', ...macros
  });
  saveState();
}

function latestStrength() {
  return [...state.strengthTests].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || defaultState.strengthTests[0];
}
function maxStrength(field) {
  return Math.max(0, ...state.strengthTests.map(x => +x[field] || 0));
}
function latestWaist() {
  return [...state.measurements].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null;
}
function latestWeight() {
  const entries = Object.entries(state.daily).filter(([, d]) => d.weight != null).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? +entries.at(-1)[1].weight : state.profile.startWeight;
}
function weightsSorted() {
  return Object.entries(state.daily).filter(([, d]) => d.weight != null && Number.isFinite(+d.weight)).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, value: +d.weight }));
}
function movingAverageWeight(endKey = localDateKey(), days = 7) {
  const vals = weightsSorted().filter(x => x.date <= endKey && dayDiff(x.date, endKey) < days).map(x => x.value);
  return avg(vals);
}
function previousWeekWeightAvg() {
  const end = addDaysKey(localDateKey(), -7);
  return movingAverageWeight(end, 7);
}

function addMeal(meal, key = localDateKey()) {
  state.meals[key] ||= [];
  state.meals[key].push({ carbs:0, fat:0, fiber:0, ...meal, id: Date.now() + Math.floor(Math.random() * 1000) });
  saveState();
}

function bandRecommendation() {
  const all = sessions().sort((a, b) => `${a.date}${a.finishedAt || ''}`.localeCompare(`${b.date}${b.finishedAt || ''}`));
  let found = null;
  for (let i = all.length - 1; i >= 0; i--) {
    const s = all[i];
    for (const id of ['bandPullA', 'bandPullB']) {
      const log = s.logs?.[id];
      if (log?.sets?.length >= 4) { found = { id, log }; break; }
    }
    if (found) break;
  }
  if (!found) return { band: 10, text: 'Start: 10-kg-Band. Nimm das leichteste Band, mit dem alle Sätze sauber gehen.' };
  const target = found.id === 'bandPullA' ? 6 : 8;
  const sets = found.log.sets.slice(-4);
  const sameBand = sets.every(s => (+s.load || 0) === (+sets[0].load || 0));
  const band = +sets[0].load || 0;
  const hit = sets.length === 4 && sets.every(s => +s.value >= target);
  if (sameBand && hit) {
    const order = [30, 20, 10, 0]; const idx = order.indexOf(band);
    const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : band;
    return { band: next, text: next === 0 ? 'Letztes Band-Ziel geschafft → nächster Versuch ohne Bandhilfe.' : `Letztes Ziel geschafft → nächstes Mal ${next}-kg-Band.` };
  }
  return { band: band || 10, text: `Bleib vorerst beim ${band || 10}-kg-Band und fülle den Wiederholungsbereich sauber auf.` };
}

function lastExerciseLog(id) {
  const all = sessions().sort((a, b) => `${a.date}${a.finishedAt || ''}`.localeCompare(`${b.date}${b.finishedAt || ''}`));
  for (let i = all.length - 1; i >= 0; i--) if (all[i].logs?.[id]?.sets?.length) return all[i].logs[id];
  return null;
}


function bestExerciseAchievement(id, minSets, minReps) {
  const all = sessions();
  let best = null;
  for (const s of all) {
    const log = s.logs?.[id];
    if (!log?.sets?.length) continue;
    const qualifying = log.sets.filter(x => +x.value >= minReps).length;
    if (!best || qualifying > best.qualifying) best = { qualifying, total: log.sets.length };
  }
  return !!best && best.qualifying >= minSets;
}

function progressionCards() {
  const strength = latestStrength();
  const band = bandRecommendation();
  const pikeHit = bestExerciseAchievement('pike', 4, 6);
  const dips = Math.max(maxStrength('dips'), +strength.dips || 0);
  return [
    { title: 'Pull-ups', text: `${band.text} Striktes Ziel: aktuell ${maxStrength('pullups')} → zuerst 4, dann 6, dann 8–10.` },
    { title: 'HSPU-Pfad', text: pikeHit ? '4×6 Pike geschafft → Elevated Pike Push-ups als nächste Stufe.' : 'Pike Push-ups sauber aufbauen. 4×6 kontrolliert = Füße erhöhen.' },
    { title: 'Dips & Griff', text: `${dips >= 10 ? 'Dips: Richtung 3×10 reproduzierbar, danach Zusatzgewicht.' : 'Dips: Wiederholungen sauber auffüllen.'} Dead Hang: 60–90 s ist das nächste große Griffziel.` }
  ];
}

function targetText(item) {
  if (item.special === 'warmup') return 'ca. 5 Min.';
  if (item.special === 'handstand') return item.range || `${item.minutes} Min.`;
  const unit = item.unit === 's' ? 's' : 'Wdh.';
  return `${item.sets}×${item.min}–${item.max} ${unit}${item.suffix ? ` · ${item.suffix}` : ''}`;
}

function renderWarmupSteps() {
  return `<div class="warmup-list">${WARMUP_STEPS.map(([name, target, kind]) => `<div class="warmup-step">${visualHTML(kind, true, name)}<div><b>${name}</b><small>${target}</small></div></div>`).join('')}</div>`;
}

function renderExerciseCard(item) {
  const ex = EX[item.id];
  return `<article class="card exercise-card">
    <div class="card-head"><div><div class="eyebrow">${ex.cat}</div><h3>${ex.name}</h3></div><span class="pill">${targetText(item)}</span></div>
    <div class="visual">${visualHTML(ex.visual, false, ex.name)}</div>
    ${item.special === 'warmup' ? renderWarmupSteps() : ''}
    ${item.dynamicLeg ? `<p class="coach-tip">Diese Woche ist <b>${ex.name}</b> dran. Nächste Woche wechselt die Beinübung.</p>` : ''}
    <ul class="cue-list">${ex.cues.map(c => `<li>${c}</li>`).join('')}</ul>
    <details><summary>Fehler + Progression</summary><ul class="cue-list mistake">${ex.mistakes.map(c => `<li>${c}</li>`).join('')}</ul><div class="progress-note">${ex.progress}</div></details>
  </article>`;
}

function renderDashboard() {
  const today = localDateKey(), plan = planForDate(today), rec = recoveryDecision(today), d = state.daily[today] || {}, meals = mealTotals(today);
  const strength = latestStrength(), currentW = d.weight != null ? +d.weight : latestWeight();
  document.getElementById('heroWeight').textContent = fmt(currentW);
  document.getElementById('heroPullups').textContent = maxStrength('pullups');
  document.getElementById('heroHs').textContent = maxStrength('handstand');
  document.getElementById('heroWeek').textContent = weekSessions(today).filter(s => ['A','B','C'].includes(s.key)).length;
  document.getElementById('todayDateLabel').textContent = `${deDateLong(today)} · ${today}`;

  const mode = document.getElementById('coachMode');
  mode.textContent = rec.mode === 'CHECK' ? 'CHECK' : rec.mode;
  mode.className = `mode-badge ${['LIGHT','REDUCED'].includes(rec.mode) ? 'light' : rec.mode === 'STOP' ? 'stop' : ''}`;
  document.getElementById('dailyScore').textContent = rec.score == null ? '–' : rec.score;

  let coachTitle = plan.title, coachText = rec.text, bullets = [], canTrain = true;
  if (plan.type === 'workout') {
    const wt = workoutTemplate(plan.workout, today);
    bullets.push(`<span class="coach-bullet"><b>1</b><span>${wt.focus} · ${wt.duration}</span></span>`);
    if (plan.workout === 'B') bullets.push(`<span class="coach-bullet"><b>2</b><span>Beine diese Woche: ${EX[wt.legChoice].name}</span></span>`);
    if (plan.optional) bullets.push(`<span class="coach-bullet"><b>!</b><span>Home C ist bei deinem aktuellen Schlaf optional. Wenn du platt bist: auf Sonntag verschieben oder auslassen.</span></span>`);
    bullets.push(`<span class="coach-bullet"><b>RIR</b><span>Ziel meistens 1–2: Du hättest noch 1–2 saubere Wiederholungen geschafft.</span></span>`);
    if (rec.mode === 'STOP') canTrain = false;
  } else if (plan.type === 'skill') {
    bullets.push(`<span class="coach-bullet"><b>HS</b><span>5–10 Minuten Handstand, frisch bleiben. Kein komplettes Workout.</span></span>`);
    bullets.push(`<span class="coach-bullet"><b>✓</b><span>Chest-to-wall + kontrollierte freie Kick-ups.</span></span>`);
  } else {
    bullets.push(`<span class="coach-bullet"><b>✓</b><span>Heute kein Krafttraining. Regeneration ist Teil des Plans.</span></span>`);
    if (parseDateKey(today).getDay() === 2) bullets.push(`<span class="coach-bullet"><b>Run</b><span>Optional: 20–30 Min. sehr locker joggen, Gespräch möglich.</span></span>`);
  }
  document.getElementById('coachTitle').textContent = coachTitle;
  document.getElementById('coachText').textContent = coachText;
  document.getElementById('coachBullets').innerHTML = bullets.join('');

  const openBtn = document.getElementById('openTodayWorkout');
  const hsBtn = document.getElementById('quickHandstandBtn');
  if (plan.type === 'workout') {
    const resume = !!state.activeSession;
    const alreadyDone = workoutDoneDate(today, plan.workout);
    openBtn.classList.remove('hidden');
    openBtn.disabled = alreadyDone || !canTrain || (rec.mode === 'CHECK' && !resume);
    openBtn.textContent = alreadyDone ? 'Heute schon erledigt ✓' : (resume ? 'Training fortsetzen' : (rec.mode === 'CHECK' ? 'Erst Recovery-Check ausfüllen' : canTrain ? 'Training starten' : 'Heute nicht starten'));
    hsBtn.classList.add('hidden');
    if (alreadyDone) coachText = 'Die geplante Session für heute ist bereits abgeschlossen. Regeneration zählt jetzt.';
  } else if (plan.type === 'skill') {
    openBtn.classList.add('hidden'); hsBtn.classList.remove('hidden'); hsBtn.textContent = '5–10 Min. Handstand starten';
  } else {
    openBtn.classList.add('hidden');
    const dow = parseDateKey(today).getDay();
    const hsRecommended = dow === 6 && !state.handstandPractice[today];
    hsBtn.classList.toggle('hidden', !hsRecommended); hsBtn.textContent = 'Kurzen Handstand-Block starten';
  }
  if (state.activeSession) {
    const a=state.activeSession, wt=workoutTemplate(a.key,a.date||today), item=wt.items[a.itemIndex||0]||wt.items[0];
    mode.textContent = 'OFFEN'; mode.className = 'mode-badge';
    coachTitle=`Offenes Training · ${wt.label}`;
    coachText=`Fortsetzen bei ${EX[item.id].name} · Satz ${(a.setIndex||0)+1}. Deine bisherigen Sätze sind gespeichert.`;
    bullets.unshift(`<span class="coach-bullet"><b>▶</b><span>Offene Session vom ${deDate(a.date||today)}.</span></span>`);
    openBtn.classList.remove('hidden'); openBtn.disabled=false; openBtn.textContent='Training fortsetzen'; hsBtn.classList.add('hidden');
  }
  document.getElementById('coachTitle').textContent = coachTitle;
  document.getElementById('coachText').textContent = coachText;
  document.getElementById('coachBullets').innerHTML = bullets.join('');

  document.getElementById('todayCalories').textContent = meals.calories;
  document.getElementById('todayProtein').textContent = meals.protein;
  document.getElementById('calProgress').style.width = `${clamp(meals.calories / state.settings.calories * 100, 0, 100)}%`;
  const nutritionAnalysis = foodCoachAnalysis(meals);
  document.getElementById('nutritionCoach').textContent = nutritionAnalysis.short;

  document.getElementById('todayWorkoutTitle').textContent = plan.title;
  document.getElementById('todayDuration').textContent = plan.duration;
  const preview = document.getElementById('todayPreview');
  if (plan.type === 'workout') {
    const wt = workoutTemplate(plan.workout, today);
    if (state.activeSession) {
      const activeWt = workoutTemplate(state.activeSession.key, state.activeSession.date || today);
      const idx = state.activeSession.itemIndex || 0;
      const nextItem = activeWt.items[idx] || activeWt.items[0];
      preview.innerHTML = `<div class="preview-item"><span class="num">▶</span><div><b>Fortsetzen: ${EX[nextItem.id].name}</b><small>${activeWt.label} · Satz ${(state.activeSession.setIndex || 0) + 1} · ${targetText(nextItem)}</small></div></div>`;
    } else {
      preview.innerHTML = wt.items.map((item, i) => `<div class="preview-item"><span class="num">${i+1}</span><div><b>${EX[item.id].name}</b><small>${targetText(item)}</small></div></div>`).join('');
    }
  } else if (plan.type === 'skill') {
    preview.innerHTML = `<div class="preview-item"><span class="num">1</span><div><b>Chest-to-wall</b><small>3×20–30 s</small></div></div><div class="preview-item"><span class="num">2</span><div><b>Freie Kick-ups</b><small>5–8 kontrollierte Versuche</small></div></div>`;
  } else {
    preview.innerHTML = `<div class="preview-item"><span class="num">✓</span><div><b>Regeneration</b><small>Spazieren, Alltag, Schlaf priorisieren. Kein Nachholzwang.</small></div></div>`;
  }

  const weekStart = weekStartKey(today);
  const hsWed = addDaysKey(weekStart, 2), aDay = weekStart, bDay = addDaysKey(weekStart, 3);
  const checks = [
    ['Montag · Park A', workoutDoneThisWeek('A', today)],
    ['Mittwoch · kurzer Handstand', !!state.handstandPractice[hsWed] || sessions().some(s => s.date === hsWed && s.logs?.handstand)],
    ['Donnerstag · Park B', workoutDoneThisWeek('B', today)],
    ['Wochenende · Home C', workoutDoneThisWeek('C', today)]
  ];
  const doneCount = checks.filter(x => x[1]).length;
  document.getElementById('weekScore').textContent = `${doneCount}/4`;
  document.getElementById('weekChecklist').innerHTML = checks.map(([label, done]) => `<div class="check-row ${done ? 'done' : ''}"><b>${label}</b><span class="checkmark">${done ? '✓' : ''}</span></div>`).join('');
  document.getElementById('nextProgressions').innerHTML = progressionCards().map(x => `<div class="progression-item"><strong>${x.title}</strong><span>${x.text}</span></div>`).join('');

  renderWaistReminder();
  renderTodayQuickPresets();
}

function renderWaistReminder() {
  const start = weekStartKey(); const has = state.measurements.some(m => m.date >= start && m.date <= addDaysKey(start, 6));
  document.getElementById('waistReminder').classList.toggle('hidden', has);
}

function renderTodayQuickPresets() {
  const root = document.getElementById('todayMealPresets');
  root.innerHTML = MEAL_PRESETS.slice(0, 3).map((m, i) => `<button type="button" data-today-preset="${i}">+ ${m.name}</button>`).join('');
  root.querySelectorAll('[data-today-preset]').forEach(btn => btn.onclick = () => addMeal(MEAL_PRESETS[+btn.dataset.todayPreset]));
}

function loadDailyForm() {
  const d = todayDaily();
  const map = { dWeight:'weight', dSleep:'sleep', dWater:'water', dSteps:'steps', dElbow:'elbow', dShoulder:'shoulder', dEnergy:'energy' };
  Object.entries(map).forEach(([id, key]) => { const el = document.getElementById(id); if (el) el.value = d[key] ?? (['dElbow','dShoulder'].includes(id) ? 0 : id === 'dEnergy' ? 3 : ''); });
  document.getElementById('dCreatine').checked = !!d.creatine;
}

document.getElementById('dailyForm').addEventListener('submit', e => {
  e.preventDefault(); const key = localDateKey();
  const get = id => document.getElementById(id).value;
  state.daily[key] = {
    ...(state.daily[key] || {}),
    weight: get('dWeight') === '' ? null : +get('dWeight'),
    sleep: get('dSleep') === '' ? null : +get('dSleep'),
    water: get('dWater') === '' ? null : +get('dWater'),
    steps: get('dSteps') === '' ? null : +get('dSteps'),
    elbow: +get('dElbow') || 0,
    shoulder: +get('dShoulder') || 0,
    energy: +get('dEnergy') || 3,
    creatine: document.getElementById('dCreatine').checked
  };
  saveState();
  document.getElementById('dailyMsg').textContent = 'Gespeichert ✓';
  setTimeout(() => document.getElementById('dailyMsg').textContent = '', 1600);
});

let selectedWorkout = 'A';
let guided = null;
let manualWorkoutMode = false;

function renderWorkoutTabs() {
  const root = document.getElementById('workoutTabs');
  const activeKey = state.activeSession?.key || null;
  root.innerHTML = ['A','B','C'].map(k => {
    const locked = activeKey && k !== activeKey;
    return `<button type="button" data-workout-tab="${k}" class="${selectedWorkout === k ? 'active' : ''}" ${locked ? 'disabled' : ''}>${workoutTemplate(k).label}${locked ? ' · gesperrt' : ''}</button>`;
  }).join('');
  root.querySelectorAll('[data-workout-tab]').forEach(btn => btn.onclick = () => {
    if (btn.disabled) return;
    selectedWorkout = btn.dataset.workoutTab; guided = null; manualWorkoutMode = true; renderWorkoutTabs(); renderTrainingOverview();
  });
}

function renderTrainingOverview() {
  const root = document.getElementById('trainingOverview'); const coach = document.getElementById('guidedCoach');
  if (guided) { root.classList.add('hidden'); coach.classList.remove('hidden'); renderGuided(); return; }
  root.classList.remove('hidden'); coach.classList.add('hidden');
  const dayPlan = planForDate();
  if (dayPlan.type !== 'workout' && !manualWorkoutMode) {
    root.innerHTML = `<article class="card"><div class="eyebrow">Heute</div><h2>${dayPlan.title}</h2><p class="coach-tip">${dayPlan.type === 'skill' ? 'Heute ist nur der kurze Handstand-Block vorgesehen. Kein komplettes Krafttraining nötig.' : 'Heute ist Regeneration eingeplant. Ein komplettes Workout ist nicht erforderlich.'}</p><p class="muted">Falls du bewusst eine andere Einheit nachholen willst, öffne unten „Andere Einheit auswählen“.</p></article>`;
    return;
  }
  const wt = workoutTemplate(selectedWorkout, localDateKey()), rec = recoveryDecision();
  const activeForThisWorkout = state.activeSession && state.activeSession.key === selectedWorkout;
  const alreadyDone = workoutDoneDate(localDateKey(), selectedWorkout) && !activeForThisWorkout;
  const blockStart = ((['CHECK','STOP'].includes(rec.mode) && !activeForThisWorkout) || alreadyDone);
  const btnText = alreadyDone ? 'Heute schon erledigt ✓' : (activeForThisWorkout ? 'Training fortsetzen' : (rec.mode === 'CHECK' ? 'Erst Recovery-Check ausfüllen' : rec.mode === 'STOP' ? 'Wegen Gelenk-Check nicht starten' : 'Geführtes Training starten'));
  root.innerHTML = `<article class="card">
      <div class="workout-header"><div><div class="eyebrow">${wt.focus}</div><h2>${wt.label}</h2><p class="muted">${wt.duration}</p></div><span class="mode-badge ${['LIGHT','REDUCED'].includes(rec.mode)?'light':rec.mode==='STOP'?'stop':''}">${rec.mode}</span></div>
      <p class="coach-tip">${alreadyDone ? '<b>Heute erledigt:</b> Dieses Training ist schon gespeichert. Kein zweites Pflicht-Workout nötig.' : (activeForThisWorkout ? `<b>Offene Einheit:</b> ${EX[wt.items[state.activeSession.itemIndex]?.id || wt.items[0].id].name} · Satz ${(state.activeSession.setIndex || 0) + 1}.` : rec.text)} ${selectedWorkout === 'B' ? `Beine heute: <b>${EX[wt.legChoice].name}</b>.` : ''}</p>
      <button id="startWorkoutBtn" class="primary full" type="button" ${blockStart ? 'disabled' : ''}>${btnText}</button>
    </article>
    <details class="inline-details workout-details"><summary>Übungen ansehen</summary><div class="workout-list">${wt.items.map(renderExerciseCard).join('')}</div></details>`;
  document.getElementById('startWorkoutBtn').onclick = () => {
    if (activeForThisWorkout) { guided = restoreActiveSession() ? guided : guided; renderTrainingOverview(); return; }
    if (alreadyDone) return;
    startGuided(selectedWorkout);
  };
}

function startGuided(key) {
  if (state.activeSession) {
    restoreActiveSession();
    renderTrainingOverview();
    return;
  }
  const rec = recoveryDecision();
  if (['CHECK','STOP'].includes(rec.mode)) return;
  guided = {
    key, date: localDateKey(), template: workoutTemplate(key, localDateKey()), itemIndex: 0, setIndex: 0,
    logs: {}, startedAt: new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }), completed: false
  };
  state.activeSession = { key, date: guided.date, itemIndex: 0, setIndex: 0, logs: {}, startedAt: guided.startedAt };
  saveState(false);
  renderTrainingOverview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderGuided() {
  const root = document.getElementById('guidedCoach');
  const wt = guided.template;
  if (guided.completed) {
    root.innerHTML = `<div class="guided-shell"><article class="card done-screen"><div class="big-check">✓</div><div class="eyebrow">Training gespeichert</div><h2>${wt.label} erledigt</h2><p class="muted">Nicht mehr nachdenken. Essen, Schlaf und die nächste Session führt die App weiter.</p><button id="finishCoachBtn" class="primary full" type="button">Zur Startseite</button></article></div>`;
    document.getElementById('finishCoachBtn').onclick = () => { guided = null; selectedWorkout = wt.short === 'Mo' ? 'A' : selectedWorkout; switchView('today'); renderTrainingOverview(); };
    return;
  }
  const item = wt.items[guided.itemIndex];
  if (!item) { completeGuidedSession(); return; }
  const ex = EX[item.id]; const progress = guided.itemIndex / wt.items.length * 100;
  const currentLog = guided.logs[item.id] || { sets: [] };
  let body = '';

  if (item.special === 'warmup') {
    body = `${renderWarmupSteps()}<ul class="cue-list">${ex.cues.map(x => `<li>${x}</li>`).join('')}</ul><button id="specialDone" class="primary full" type="button">Warm-up erledigt → Weiter</button>`;
  } else if (item.special === 'handstand') {
    body = `<div class="target-box"><span>Gesamtzeit</span><strong>${item.range || `${item.minutes} Min.`}</strong></div>
      <div class="coach-tip"><b>1.</b> Chest-to-wall 3×20–30 s<br><b>2.</b> 5–8 freie Kick-ups<br><b>3.</b> Frisch bleiben – keine Ermüdungsschlacht</div>
      <div class="action-row"><button id="skillTimerBtn" class="secondary" type="button">${item.minutes}-Min-Timer starten</button><button id="specialDone" class="primary" type="button">Handstand erledigt → Weiter</button></div>`;
  } else {
    const unitLabel = item.unit === 's' ? 'Sekunden' : 'Wiederholungen';
    const setNo = guided.setIndex + 1;
    const bandRec = bandRecommendation().band;
    const loadField = item.loadType === 'band'
      ? `<label>Band-Hilfe<select id="setLoad"><option value="30" ${bandRec===30?'selected':''}>30 kg Hilfe</option><option value="20" ${bandRec===20?'selected':''}>20 kg Hilfe</option><option value="10" ${bandRec===10?'selected':''}>10 kg Hilfe</option><option value="0" ${bandRec===0?'selected':''}>ohne Band</option></select></label>`
      : item.loadType === 'resistance'
        ? `<label>Band-Widerstand<select id="setLoad"><option value="10" selected>10 kg</option><option value="20">20 kg</option><option value="30">30 kg</option></select></label>` : '';
    const rirField = item.unit === 'reps'
      ? `<label>RIR<select id="setRir"><option value="3">3</option><option value="2" selected>2</option><option value="1">1</option><option value="0">0</option></select></label>` : '';
    body = `<div class="target-box"><span>Satz ${setNo} von ${item.sets}</span><strong>${item.min}–${item.max} ${item.unit === 's' ? 's' : 'Wdh.'}</strong></div>
      ${item.progressGoal ? `<p class="coach-tip">${item.progressGoal}</p>` : ''}
      <div class="set-history">${currentLog.sets.map((s,i) => `<span class="set-chip">S${i+1}: ${s.value}${item.unit==='s'?'s':''}${s.load!=null?` · ${s.load===0?'ohne Band':s.load+'kg'}`:''}${s.rir!=null?` · RIR ${s.rir}`:''}</span>`).join('')}</div>
      <div class="set-entry"><label>${unitLabel}<input id="setValue" type="number" min="0" step="1" inputmode="numeric" autofocus placeholder="Ergebnis"></label>${loadField}${rirField}</div>
      ${item.unit === 'reps' ? '<div class="rir-help"><b>RIR = Reps in Reserve.</b> RIR 2 bedeutet: Du hättest noch ungefähr 2 saubere Wiederholungen geschafft. Dein Standardziel ist 1–2.</div>' : ''}
      <button id="saveSetBtn" class="primary full" type="button">Satz speichern${guided.setIndex + 1 < item.sets ? ' · dann Pause' : ' · Übung abschließen'}</button>`;
  }

  root.innerHTML = `<div class="guided-shell">
    <div class="guided-top"><div class="guided-progress"><span style="width:${progress}%"></span></div><div class="guided-count"><span>${wt.label}</span><span>Übung ${guided.itemIndex+1}/${wt.items.length}</span></div></div>
    <article class="card coach-exercise">
      <div class="card-head"><div><div class="eyebrow">${ex.cat}</div><h2>${ex.name}</h2></div><span class="pill">${targetText(item)}</span></div>
      <div class="coach-visual">${visualHTML(ex.visual, false, ex.name)}</div>
      <ul class="cue-list">${ex.cues.map(x => `<li>${x}</li>`).join('')}</ul>
      ${body}
      <div class="coach-nav"><button id="cancelCoach" class="ghost-btn" type="button">Beenden</button>${guided.itemIndex > 0 ? '<button id="prevExercise" class="ghost-btn" type="button">Zurück</button>' : ''}</div>
    </article>
  </div>`;

  document.getElementById('cancelCoach').onclick = () => {
    if (confirm('Training wirklich beenden? Bisherige Sätze bleiben nicht als abgeschlossenes Workout gespeichert.')) {
      guided = null; delete state.activeSession; saveState(false); renderTrainingOverview();
    }
  };
  document.getElementById('prevExercise')?.addEventListener('click', () => { guided.itemIndex = Math.max(0, guided.itemIndex - 1); guided.setIndex = 0; renderGuided(); });
  document.getElementById('specialDone')?.addEventListener('click', () => {
    guided.logs[item.id] = { done: true, sets: [] };
    if (item.id === 'handstand') state.handstandPractice[guided.date] = true;
    guided.itemIndex++; guided.setIndex = 0; persistActive(); renderGuided();
  });
  document.getElementById('skillTimerBtn')?.addEventListener('click', () => {
    openTimer(item.minutes * 60, 'Handstand-Block', () => {
      state.handstandPractice[guided.date] = true; saveState(false);
      document.getElementById('specialDone')?.click();
    }, false);
  });
  document.getElementById('saveSetBtn')?.addEventListener('click', () => saveGuidedSet(item));
}

function saveGuidedSet(item) {
  const valueEl = document.getElementById('setValue'); const value = +valueEl.value;
  if (!Number.isFinite(value) || value <= 0) { valueEl.focus(); return; }
  guided.logs[item.id] ||= { sets: [] };
  const entry = { value };
  if (['band','resistance'].includes(item.loadType)) entry.load = +document.getElementById('setLoad').value;
  if (item.unit === 'reps') entry.rir = +document.getElementById('setRir').value;
  guided.logs[item.id].sets.push(entry);
  const moreSets = guided.setIndex + 1 < item.sets;
  if (moreSets) {
    guided.setIndex++;
    persistActive();
    openTimer(item.rest || 90, `${EX[item.id].name} · Pause`, () => renderGuided(), true);
  } else {
    guided.itemIndex++; guided.setIndex = 0; persistActive(); renderGuided();
  }
}

function persistActive() {
  state.activeSession = { key: guided.key, date: guided.date, itemIndex: guided.itemIndex, setIndex: guided.setIndex, logs: guided.logs, startedAt: guided.startedAt };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function updateAutoStrengthFromSession(session) {
  const current = {
    pullups: maxStrength('pullups'),
    dips: maxStrength('dips'),
    handstand: maxStrength('handstand'),
    hang: maxStrength('hang'),
    hspu: maxStrength('hspu')
  };
  const sessionPull = Math.max(0, ...(session.logs?.pullup?.sets || []).map(x=>+x.value||0));
  const sessionDips = Math.max(0, ...(session.logs?.dips?.sets || []).map(x=>+x.value||0));
  const sessionHang = Math.max(0, ...(session.logs?.deadHang?.sets || []).map(x=>+x.value||0));
  const improved = sessionPull > current.pullups || sessionDips > current.dips || sessionHang > current.hang;
  if (improved) {
    const test = {
      date: session.date,
      pullups: Math.max(current.pullups, sessionPull),
      dips: Math.max(current.dips, sessionDips),
      handstand: current.handstand,
      hang: Math.max(current.hang, sessionHang),
      hspu: current.hspu,
      auto: true
    };
    state.strengthTests = state.strengthTests.filter(x => !(x.date === session.date && x.auto));
    state.strengthTests.push(test);
    state.strengthTests.sort((a,b)=>a.date.localeCompare(b.date));
  }
  const pikeSets = session.logs?.pike?.sets || [];
  if (pikeSets.length >= 4 && pikeSets.slice(0,4).every(x => +x.value >= 6)) {
    state.skillStages.hspu = Math.max(state.skillStages.hspu || 0, 1);
  }
}

function completeGuidedSession() {
  const session = {
    date: guided.date, key: guided.key, completed: true, logs: guided.logs, startedAt: guided.startedAt,
    finishedAt: new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    legChoice: guided.template.legChoice || null,
    id: Date.now()
  };
  const existing = state.workouts[guided.date];
  if (!existing) state.workouts[guided.date] = session;
  else if (Array.isArray(existing)) existing.push(session);
  else state.workouts[guided.date] = [existing, session];
  if (guided.logs.handstand?.done) state.handstandPractice[guided.date] = true;
  updateAutoStrengthFromSession(session);
  delete state.activeSession;
  guided.completed = true;
  saveState();
  renderGuided();
}

const timer = { id: null, remaining: 0, onDone: null, allowSkipDone: true };
function openTimer(seconds, label, onDone, allowSkipDone = true) {
  clearInterval(timer.id); timer.remaining = Math.max(0, Math.round(seconds)); timer.onDone = onDone; timer.allowSkipDone = allowSkipDone;
  document.getElementById('timerLabel').textContent = label;
  document.getElementById('timerOverlay').classList.remove('hidden');
  updateTimerDisplay();
  timer.id = setInterval(() => {
    timer.remaining--;
    updateTimerDisplay();
    if (timer.remaining <= 0) closeTimer(true);
  }, 1000);
}
function updateTimerDisplay() {
  const m = Math.floor(timer.remaining / 60), s = timer.remaining % 60;
  document.getElementById('timerValue').textContent = `${pad(m)}:${pad(s)}`;
}
function closeTimer(done) {
  clearInterval(timer.id); timer.id = null; document.getElementById('timerOverlay').classList.add('hidden');
  const cb = timer.onDone; timer.onDone = null;
  if (done && cb) cb();
}
document.getElementById('timerMinus').onclick = () => { timer.remaining = Math.max(0, timer.remaining - 15); updateTimerDisplay(); };
document.getElementById('timerPlus').onclick = () => { timer.remaining += 15; updateTimerDisplay(); };
document.getElementById('timerSkip').onclick = () => closeTimer(timer.allowSkipDone);

function startHandstandSession() {
  const dow = new Date().getDay();
  const minutes = [1,4].includes(dow) ? 8 : dow === 3 ? 7 : [6,0].includes(dow) ? 10 : 7;
  openTimer(minutes * 60, 'Handstand-Technik', () => {
    state.handstandPractice[localDateKey()] = true; saveState();
    alert(`Handstand für heute geloggt ✓ (${minutes} Min.)`);
  }, false);
}

function setBar(id, value, target) {
  const el = document.getElementById(id); if (!el) return;
  el.style.width = `${clamp((+value || 0) / Math.max(1,+target || 1) * 100, 0, 100)}%`;
}

function renderFoodSearchResults(query = '') {
  const root = document.getElementById('foodSearchResults'); if (!root) return;
  const results = foodSearch(query);
  root.innerHTML = results.length ? results.map(f => `<button type="button" class="food-result" data-food-id="${f.id}"><span><b>${f.name}</b><small>${f.cat} · ${f.kcal} kcal · ${f.p} g P / 100 ${f.unit||'g'}</small></span><span>+</span></button>`).join('') : '<p class="muted">Kein Treffer. Nutze unten „Eigene / verpackte Lebensmittel“.</p>';
  root.querySelectorAll('[data-food-id]').forEach(btn=>btn.onclick=()=>selectFood(btn.dataset.foodId));
}

function selectFood(id) {
  selectedFood = FOOD_DB.find(f=>f.id===id) || null;
  const card=document.getElementById('selectedFoodCard'); if (!card) return;
  if (!selectedFood) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  document.getElementById('selectedFoodName').textContent=selectedFood.name;
  document.getElementById('selectedFoodPer100').textContent=`100 ${selectedFood.unit||'g'}: ${selectedFood.kcal} kcal · ${selectedFood.p} g Protein · ${selectedFood.c} g KH · ${selectedFood.f} g Fett · ${selectedFood.fi} g Ballaststoffe`;
  document.getElementById('foodAmountUnit').textContent=selectedFood.unit||'g';
  document.getElementById('foodAmount').value=selectedFood.portion||100;
  const quick=[50,100,selectedFood.portion||100,200,250].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4);
  document.getElementById('foodQuickPortions').innerHTML=quick.map(v=>`<button type="button" data-food-amount="${v}">${selectedFood.portion===v&&selectedFood.portionLabel?selectedFood.portionLabel:`${v} ${selectedFood.unit||'g'}`}</button>`).join('');
  document.querySelectorAll('[data-food-amount]').forEach(b=>b.onclick=()=>{document.getElementById('foodAmount').value=b.dataset.foodAmount;updateSelectedFoodCalc();});
  updateSelectedFoodCalc();
  card.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function updateSelectedFoodCalc() {
  if (!selectedFood) return;
  const amount=+document.getElementById('foodAmount').value||0, m=foodMacros(selectedFood,amount);
  document.getElementById('selectedFoodCalories').textContent=`${m.cal} kcal`;
  document.getElementById('selectedFoodMacros').textContent=`${m.protein} g P · ${m.carbs} g KH · ${m.fat} g F · ${m.fiber} g Ballastst.`;
}

function renderRecentFoods() {
  const root=document.getElementById('recentFoods'); if (!root) return;
  const recents=recentFoodIds().map(id=>FOOD_DB.find(f=>f.id===id)).filter(Boolean);
  const foods=(recents.length?recents:foodSearch('')).slice(0,8);
  root.innerHTML=foods.map(f=>`<button type="button" class="food-quick" data-recent-food="${f.id}"><b>${f.name}</b><small>${f.portion||100} ${f.unit||'g'} · ${foodMacros(f,f.portion||100).cal} kcal</small></button>`).join('');
  root.querySelectorAll('[data-recent-food]').forEach(btn=>btn.onclick=()=>selectFood(btn.dataset.recentFood));
}

function renderMeals() {
  const key = localDateKey(); state.meals[key] ||= [];
  const list = state.meals[key], totals = mealTotals(key), d = state.daily[key] || {}, t=state.settings;
  const analysis=foodCoachAnalysis(totals);
  document.getElementById('foodCalories').textContent = totals.calories;
  document.getElementById('foodProtein').textContent = `${totals.protein} g`;
  document.getElementById('foodCarbs').textContent = `${totals.carbs} g`;
  document.getElementById('foodFat').textContent = `${totals.fat} g`;
  document.getElementById('foodFiber').textContent = `${totals.fiber} g`;
  document.getElementById('foodCaloriesLeft').textContent = state.settings.vacation ? 'Urlaub: ungefähr halten' : `${Math.max(0,t.calories-totals.calories)} übrig`;
  document.getElementById('foodProteinLeft').textContent = `${Math.max(0,round1(t.protein-totals.protein))} g übrig`;
  document.getElementById('foodCarbsLeft').textContent = `${Math.max(0,round1(t.carbs-totals.carbs))} g übrig`;
  document.getElementById('foodFatLeft').textContent = `${Math.max(0,round1(t.fat-totals.fat))} g übrig`;
  document.getElementById('foodFiberLeft').textContent = `${Math.max(0,round1(t.fiber-totals.fiber))} g bis Ziel`;
  document.getElementById('foodWater').textContent = `${d.water ?? 0} L`;
  document.getElementById('foodCreatine').textContent = d.creatine ? 'Ja' : 'Nein';
  document.getElementById('foodModeBadge').textContent = state.settings.vacation ? 'URLAUB' : 'CUT';
  const badge=document.getElementById('foodCoachBadge'); badge.textContent=analysis.badge; badge.className=`mode-badge ${analysis.cls||''}`;
  document.getElementById('foodCoachTitle').textContent=analysis.title;
  document.getElementById('foodCoachAdvice').textContent=analysis.text;
  setBar('foodCaloriesBar',totals.calories,t.calories); setBar('foodProteinBar',totals.protein,t.protein); setBar('foodCarbsBar',totals.carbs,t.carbs); setBar('foodFatBar',totals.fat,t.fat);
  document.getElementById('mealList').innerHTML = list.length ? list.map(m => `<div class="meal-log-item"><div><b>${m.name}</b><small>${m.amount?`${m.amount} ${m.unit||'g'} · `:''}${Math.round(+m.cal||0)} kcal · ${round1(m.protein)} g P · ${round1(m.carbs)} g KH · ${round1(m.fat)} g F${(+m.fiber||0)>0?` · ${round1(m.fiber)} g Ballastst.`:''}</small></div><button type="button" data-delmeal="${m.id}">×</button></div>`).join('') : '<p class="muted">Noch nichts geloggt.</p>';
  document.querySelectorAll('[data-delmeal]').forEach(btn => btn.onclick = () => { state.meals[key] = list.filter(m => String(m.id) !== String(btn.dataset.delmeal)); saveState(); });
  renderRecentFoods();
  if (!selectedFood) renderFoodSearchResults(document.getElementById('foodSearch')?.value || '');
}

function renderMealPresets() { /* Food Tracker ersetzt die alte Preset-Liste auf der Essen-Seite. */ }

document.getElementById('foodSearch')?.addEventListener('input',e=>renderFoodSearchResults(e.target.value));
document.getElementById('foodAmount')?.addEventListener('input',updateSelectedFoodCalc);
document.getElementById('clearSelectedFood')?.addEventListener('click',()=>{selectedFood=null;document.getElementById('selectedFoodCard').classList.add('hidden');document.getElementById('foodSearch').value='';renderFoodSearchResults('');});
document.getElementById('addSelectedFood')?.addEventListener('click',()=>{
  if(!selectedFood)return; const amount=+document.getElementById('foodAmount').value; if(!amount||amount<=0)return;
  addFoodEntry(selectedFood,amount); selectedFood=null; document.getElementById('selectedFoodCard').classList.add('hidden'); document.getElementById('foodSearch').value=''; renderFoodSearchResults('');
});

document.getElementById('mealForm').onsubmit = e => {
  e.preventDefault(); const name = document.getElementById('mealName').value.trim(); const cal = +document.getElementById('mealCalories').value;
  if (!name || !cal) return;
  addMeal({ name, cal, protein:+document.getElementById('mealProtein').value||0, carbs:+document.getElementById('mealCarbs').value||0, fat:+document.getElementById('mealFat').value||0, fiber:+document.getElementById('mealFiber').value||0 });
  e.target.reset();
};
document.getElementById('clearMeals').onclick = () => { if (confirm('Heutige Lebensmittel wirklich komplett leeren?')) { state.meals[localDateKey()] = []; saveState(); } };

function renderVacation() {
  const card = document.getElementById('vacationCard'); card.classList.toggle('active', state.settings.vacation);
  document.getElementById('toggleVacation').textContent = state.settings.vacation ? 'Urlaubsmodus deaktivieren' : 'Urlaubsmodus aktivieren';
}
document.getElementById('toggleVacation').onclick = () => { state.settings.vacation = !state.settings.vacation; saveState(); };

function renderStats() {
  const wavg = movingAverageWeight(), waist = latestWaist();
  document.getElementById('statWeightAvg').textContent = wavg == null ? '–' : fmt(wavg);
  document.getElementById('statWaist').textContent = waist ? fmt(waist.waist) : '–';
  document.getElementById('statPullPR').textContent = maxStrength('pullups');
  document.getElementById('statHsPR').textContent = maxStrength('handstand');
  document.getElementById('wDate').value ||= localDateKey(); document.getElementById('sDate').value ||= localDateKey();
  renderWeeklyReview();
  requestAnimationFrame(drawCharts);
}

document.getElementById('waistForm').onsubmit = e => {
  e.preventDefault(); const date = document.getElementById('wDate').value || localDateKey(), waist = +document.getElementById('wWaist').value;
  if (!waist) return; state.measurements = state.measurements.filter(m => m.date !== date); state.measurements.push({ date, waist }); state.measurements.sort((a,b)=>a.date.localeCompare(b.date)); saveState(); e.target.reset(); document.getElementById('wDate').value = localDateKey();
};
document.getElementById('strengthForm').onsubmit = e => {
  e.preventDefault(); const date = document.getElementById('sDate').value || localDateKey();
  const test = { date, pullups:+document.getElementById('sPullups').value||0, dips:+document.getElementById('sDips').value||0, handstand:+document.getElementById('sHs').value||0, hang:+document.getElementById('sHang').value||0, hspu:+document.getElementById('sHspu').value||0 };
  state.strengthTests = state.strengthTests.filter(s => s.date !== date); state.strengthTests.push(test); state.strengthTests.sort((a,b)=>a.date.localeCompare(b.date)); saveState(); e.target.reset(); document.getElementById('sDate').value = localDateKey();
};

function renderWeeklyReview() {
  const cur = movingAverageWeight(), prev = previousWeekWeightAvg(), delta = cur != null && prev != null ? cur - prev : null;
  const keys = Array.from({ length: 14 }, (_, i) => addDaysKey(localDateKey(), -i));
  const calories = keys.map(k => mealTotals(k).calories).filter(v => v > 0);
  const protein = keys.map(k => mealTotals(k).protein).filter(v => v > 0);
  const sleep = keys.map(k => +state.daily[k]?.sleep).filter(v => v > 0);
  const calAvg = avg(calories), protAvg = avg(protein), sleepAvg = avg(sleep);
  let badge = 'SAMMELN', cls = '', advice = 'Noch ein paar Tage sauber loggen, dann wird der Trend aussagekräftig.';
  if (delta != null) {
    if (delta > -0.25) { badge = 'LANGSAM'; cls = 'light'; advice = 'Wenn dieser Trend 2–3 Wochen so bleibt: Kalorien Richtung 2.150–2.200 senken. Vorher Wochenenden sauber mitloggen.'; }
    else if (delta < -0.8) { badge = 'ZU SCHNELL'; cls = 'light'; advice = 'Verlust ist aggressiv. Wenn Kraft, Schlaf oder Erholung sinken: etwa 100–150 kcal erhöhen.'; }
    else { badge = 'OK'; cls = ''; advice = 'Gewichtstrend liegt grundsätzlich im Zielbereich von etwa 0,3–0,6 kg pro Woche.'; }
  }
  const b = document.getElementById('trendBadge'); b.textContent = badge; b.className = `mode-badge ${cls}`;
  document.getElementById('weeklyReview').innerHTML = `
    <div class="review-line"><span>7-Tage Gewicht</span><b>${cur != null ? fmt(cur)+' kg' : '–'}</b></div>
    <div class="review-line"><span>vs. Vorwoche</span><b>${delta != null ? `${delta>0?'+':''}${fmt(delta)} kg` : '–'}</b></div>
    <div class="review-line"><span>Ø Kalorien geloggte Tage</span><b>${calAvg != null ? Math.round(calAvg) : '–'}</b></div>
    <div class="review-line"><span>Ø Protein geloggte Tage</span><b>${protAvg != null ? Math.round(protAvg)+' g' : '–'}</b></div>
    <div class="review-line"><span>Ø Schlaf</span><b>${sleepAvg != null ? fmt(sleepAvg)+' h' : '–'}</b></div>
    <div class="coach-tip">${advice}${protAvg != null && protAvg < 160 ? ' Protein liegt noch zu niedrig – zuerst zuverlässig 170 g treffen.' : ''}</div>`;
}

function drawChart(canvasId, series, opts = {}) {
  const canvas = document.getElementById(canvasId); if (!canvas) return;
  const rect = canvas.getBoundingClientRect(); if (!rect.width) return;
  const dpr = window.devicePixelRatio || 1, width = Math.round(rect.width * dpr), height = Math.round(230 * dpr);
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); const W = rect.width, H = 230;
  ctx.clearRect(0,0,W,H); ctx.fillStyle = '#071321'; ctx.fillRect(0,0,W,H);
  const all = series.flatMap(s => s.data.map(p => p.value)).filter(Number.isFinite);
  if (!all.length) { ctx.fillStyle = '#7890a8'; ctx.font = '13px system-ui'; ctx.fillText('Noch nicht genug Daten', 18, 34); return; }
  let min = Math.min(...all), max = Math.max(...all); if (min === max) { min -= 1; max += 1; }
  const padX=34,padY=22,chartW=W-padX-16,chartH=H-padY-30;
  const dates = [...new Set(series.flatMap(s => s.data.map(p=>p.date)))].sort();
  const x = date => dates.length === 1 ? padX+chartW/2 : padX + dates.indexOf(date)/(dates.length-1)*chartW;
  const y = val => padY + (max-val)/(max-min)*chartH;
  ctx.strokeStyle='#17314a';ctx.lineWidth=1;
  for(let i=0;i<4;i++){const yy=padY+i/3*chartH;ctx.beginPath();ctx.moveTo(padX,yy);ctx.lineTo(W-16,yy);ctx.stroke();}
  const colors=['#61e6b7','#7db7ff','#ffd36b'];
  series.forEach((s,si)=>{ if(!s.data.length)return; ctx.strokeStyle=colors[si%colors.length];ctx.lineWidth=2.5;ctx.beginPath();s.data.forEach((p,i)=>{const xx=x(p.date),yy=y(p.value);i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();s.data.forEach(p=>{ctx.fillStyle=colors[si%colors.length];ctx.beginPath();ctx.arc(x(p.date),y(p.value),3,0,Math.PI*2);ctx.fill();});});
  ctx.fillStyle='#7890a8';ctx.font='10px system-ui';
  const labels=dates.length<=5?dates:dates.filter((_,i)=>i===0||i===dates.length-1||i%Math.ceil(dates.length/4)===0);
  labels.forEach(date=>{ctx.fillText(date.slice(5),x(date)-14,H-10)});
  ctx.fillText(fmt(max),2,padY+4);ctx.fillText(fmt(min),2,padY+chartH);
  if(opts.legend){ctx.font='11px system-ui';series.forEach((s,i)=>{ctx.fillStyle=colors[i%colors.length];ctx.fillRect(padX+i*110,5,10,3);ctx.fillStyle='#9fb1c6';ctx.fillText(s.name,padX+15+i*110,10)});}
}

function drawCharts() {
  const weights = weightsSorted().slice(-30);
  const avgSeries = weights.map(p => {
    const vals = weightsSorted().filter(x => x.date <= p.date && dayDiff(x.date,p.date)<7).map(x=>x.value); return { date:p.date, value:avg(vals) };
  });
  drawChart('weightChart', [{name:'Gewicht',data:weights},{name:'7T Ø',data:avgSeries}], {legend:true});
  drawChart('waistChart', [{name:'Bauch',data:state.measurements.slice(-20).map(x=>({date:x.date,value:+x.waist}))}]);
  const sleep = Object.entries(state.daily).filter(([,d])=>+d.sleep>0).sort(([a],[b])=>a.localeCompare(b)).slice(-30).map(([date,d])=>({date,value:+d.sleep}));
  drawChart('sleepChart', [{name:'Schlaf',data:sleep}]);
  const tests = [...state.strengthTests].sort((a,b)=>a.date.localeCompare(b.date)).slice(-20);
  drawChart('strengthChart', [{name:'Pull-ups',data:tests.map(x=>({date:x.date,value:+x.pullups||0}))},{name:'Handstand s',data:tests.map(x=>({date:x.date,value:+x.handstand||0}))}], {legend:true});
}
window.addEventListener('resize', () => { if (document.getElementById('stats').classList.contains('active')) drawCharts(); });

const HSPU_STAGES = [
  { name:'Pike Push-up', need:'4×6 sauber', desc:'Schulterkraft und Vorverlagerung.' },
  { name:'Elevated Pike Push-up', need:'3–4×6 sauber', desc:'Füße erhöht, Hüfte noch stärker über die Schultern.' },
  { name:'Wall HSPU Negative', need:'3–5 kontrollierte Negative', desc:'Langsam und stabil absenken.' },
  { name:'Teil-ROM Wall HSPU', need:'mehrere saubere Reps', desc:'Bewegungsumfang schrittweise vergrößern.' },
  { name:'Full Wall HSPU', need:'3+ saubere Reps', desc:'Volle Kontrolle und volle ROM.' },
  { name:'Freier HSPU', need:'langfristig', desc:'Balance und Kraft zusammenführen.' }
];

function renderSkills() {
  const root = document.getElementById('skillTree'), pull = maxStrength('pullups');
  root.innerHTML = HSPU_STAGES.map((s,i)=>{
    const current = i === state.skillStages.hspu, unlocked = i <= state.skillStages.hspu + 1;
    return `<article class="card skill-card ${current?'current':''} ${unlocked?'':'locked'}"><span class="skill-num">${i+1}</span><div class="eyebrow">HSPU-Pfad</div><h3>${s.name}</h3><p class="muted">${s.desc}</p><div class="progress-note">Ziel: ${s.need}</div>${current && i < HSPU_STAGES.length-1 ? '<button class="secondary full" type="button" data-hspu-next>Stufe geschafft markieren</button>' : ''}</article>`;
  }).join('');
  document.querySelector('[data-hspu-next]')?.addEventListener('click',()=>{state.skillStages.hspu=Math.min(HSPU_STAGES.length-1,state.skillStages.hspu+1);saveState();});
  const flagReady = pull >= 8;
  document.getElementById('flagLock').textContent = flagReady ? 'BASIS BEREIT' : 'LOCKED';
  document.getElementById('flagLock').className = `mode-badge ${flagReady?'':'light'}`;
  document.getElementById('flagText').textContent = flagReady ? 'Du hast die Pull-up-Basis erreicht. Jetzt können Tuck-Flag, Straight-arm Basics und seitliche Core-Arbeit systematisch ergänzt werden.' : `Noch ${Math.max(0,8-pull)} strikte Pull-ups bis zur ersten Flag-Freigabe. Erst 8–10 strikte Pull-ups, stabile Schulter und Core.`;
  renderHandstandDays();
}

function renderHandstandDays() {
  const start = weekStartKey();
  const specs = [
    { label:'Mo', keys:[addDaysKey(start,0)] },
    { label:'Mi', keys:[addDaysKey(start,2)] },
    { label:'Do', keys:[addDaysKey(start,3)] },
    { label:'WE', keys:[addDaysKey(start,5), addDaysKey(start,6)] }
  ];
  const root = document.getElementById('handstandDays');
  root.innerHTML = specs.map((spec,i)=>{
    const done=spec.keys.some(k=>!!state.handstandPractice[k]);
    return `<button type="button" class="hs-day ${done?'done':''}" data-hs-index="${i}">${done?'✓ ':''}${spec.label}</button>`;
  }).join('');
  root.querySelectorAll('[data-hs-index]').forEach(btn=>btn.onclick=()=>{
    const spec=specs[+btn.dataset.hsIndex], done=spec.keys.some(k=>!!state.handstandPractice[k]);
    if(done) spec.keys.forEach(k=>delete state.handstandPractice[k]);
    else {
      const today=localDateKey();
      const target=spec.keys.includes(today)?today:spec.keys[0];
      state.handstandPractice[target]=true;
    }
    saveState();
  });
}

const ROADMAP = [
  { phase:1, months:'Monate 1–3', title:'Cut + Grundkraft + Handstand', actions:['2–3 Kraftsessions/Woche','Pull-up-Bandhilfe reduzieren','Handstand 4× kurz','2300 kcal / 170 g Protein','Taille & 7-Tage-Gewicht verfolgen'], done:()=>maxStrength('pullups')>=8 && maxStrength('dips')>=12 && maxStrength('handstand')>=10 },
  { phase:2, months:'Monate 4–6', title:'Stärker werden + weiter leaner', actions:['8–10+ Pull-ups','Dips Richtung 15','Elevated Pike / HSPU Negative','Cut nur solange nötig','Human-Flag-Basis freischalten'], done:()=>maxStrength('pullups')>=10 && maxStrength('dips')>=15 && maxStrength('handstand')>=20 && state.skillStages.hspu>=2 },
  { phase:3, months:'Monate 6–9', title:'Erhaltung / erster Weighted-Fokus', actions:['Weighted Pull-ups beginnen','Weighted Dips beginnen','Wall-HSPU systematisieren','Kalorien Richtung Erhaltung, sobald lean','Human Flag Tuck/Straddle'], done:()=>maxStrength('pullups')>=12 && state.skillStages.hspu>=4 },
  { phase:4, months:'Monate 9–12+', title:'Muskelaufbau + Advanced Skills', actions:['Kleiner Kalorienüberschuss','Schwere Weighted Basics','Freier HSPU','Human Flag','später Front Lever / Muscle-up / Planche-Basis'], done:()=>false }
];
function currentPhase() {
  for (const p of ROADMAP) if (!p.done()) return p.phase;
  return 4;
}
function renderRoadmap() {
  const phase = currentPhase(); document.getElementById('currentPhaseBadge').textContent = `PHASE ${phase}`;
  document.getElementById('roadmapCards').innerHTML = ROADMAP.map(p=>`<article class="card roadmap-card ${p.phase===phase?'current':''} ${p.phase>phase?'locked':''}"><div class="eyebrow">Phase ${p.phase} · ${p.months}</div><h3>${p.title}</h3><div class="phase-criteria">${p.actions.map(a=>`<div><span class="${p.phase<phase?'yes':''}">${p.phase<phase?'✓':'•'}</span><span>${a}</span></div>`).join('')}</div></article>`).join('');
  renderMilestones(); renderRun();
}
function renderMilestones() {
  const vals = [
    ['Strikte Pull-ups',maxStrength('pullups'),10,'10'],['Dips',maxStrength('dips'),15,'15'],['Freier Handstand',maxStrength('handstand'),30,'30 s'],['Dead Hang',maxStrength('hang'),90,'90 s'],['Wall HSPU',maxStrength('hspu'),3,'3']
  ];
  document.getElementById('milestones').innerHTML = vals.map(([name,val,target,label])=>`<div class="milestone"><div><b>${name}</b><div class="bar"><span style="width:${clamp(val/target*100,0,100)}%"></span></div></div><strong>${val} / ${label}</strong></div>`).join('');
}
function runsThisWeek(){const set=new Set(weekKeys());return Object.entries(state.runs).filter(([d,v])=>set.has(d)&&v?.easy).length}
function renderRun(){const n=runsThisWeek(),sleepVals=weekKeys().map(k=>+state.daily[k]?.sleep).filter(v=>v>0),sleepAvg=avg(sleepVals),target=sleepAvg!=null&&sleepAvg>=7?2:1;document.getElementById('runWeek').textContent=`${n}/${target}`;document.getElementById('runAdvice').textContent=target===2?'Schlaf ist besser: 1–2× 20–30 Minuten locker sind okay. Krafttraining bleibt Priorität.':'Start: 1× pro Woche 20–30 Minuten sehr locker, Gespräch möglich. Bei besserem Schlaf später 2×.';document.getElementById('runStatus').textContent=state.runs[localDateKey()]?.easy?'Heute geloggt ✓':''}
document.getElementById('logRunBtn').onclick=()=>{state.runs[localDateKey()]={easy:true,minutes:25};saveState();};

const PHOTO_DB = 'calisthenicsCoachPhotos';
const PHOTO_STORE = 'photoSets';
function photoDBOpen() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(PHOTO_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(PHOTO_STORE))db.createObjectStore(PHOTO_STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
}
async function photoPut(record) {
  const db=await photoDBOpen();
  return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
}
async function photoGet(id) {
  const db=await photoDBOpen();
  return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readonly');const req=tx.objectStore(PHOTO_STORE).get(id);req.onsuccess=()=>{db.close();resolve(req.result||null);};req.onerror=()=>{db.close();reject(req.error);};});
}
async function photoGetAll() {
  const db=await photoDBOpen();
  return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readonly');const req=tx.objectStore(PHOTO_STORE).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[]);};req.onerror=()=>{db.close();reject(req.error);};});
}
async function photoDelete(id) {
  const db=await photoDBOpen();
  return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
}
async function photoClear() {
  const db=await photoDBOpen();
  return new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).clear();tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});
}
async function migrateLegacyPhotos() {
  let changed=false;
  for (const set of state.photoSets || []) {
    if (set && (set.front || set.side || set.back)) {
      const id=set.id || Date.now()+Math.floor(Math.random()*10000);
      try { await photoPut({id,front:set.front||'',side:set.side||'',back:set.back||''}); } catch(e) { console.warn('Foto-Migration fehlgeschlagen',e); continue; }
      set.id=id; delete set.front; delete set.side; delete set.back; changed=true;
    }
  }
  if(changed) saveState(false);
}

let pendingPhotos = { front:'', side:'', back:'' };
async function resizePhoto(file) {
  return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const max=720,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.56));};img.onerror=reject;img.src=fr.result;};fr.onerror=reject;fr.readAsDataURL(file);});
}
[['photoFront','front'],['photoSide','side'],['photoBack','back']].forEach(([id,key])=>{
  document.getElementById(id).onchange=async e=>{const file=e.target.files?.[0];if(!file)return;pendingPhotos[key]=await resizePhoto(file);const slot=e.target.closest('.photo-slot');slot.classList.add('has-image');slot.querySelector('img').src=pendingPhotos[key];};
});
document.getElementById('savePhotoSet').onclick=async()=>{
  if(!Object.values(pendingPhotos).some(Boolean)){alert('Bitte mindestens ein Foto auswählen.');return;}
  const id=Date.now();
  const metadata={date:localDateKey(),id};
  try {
    await photoPut({id,...pendingPhotos});
    state.photoSets.push(metadata);
  } catch(e) {
    console.warn('IndexedDB nicht verfügbar, Foto bleibt im lokalen State',e);
    state.photoSets.push({...metadata,...pendingPhotos});
  }
  pendingPhotos={front:'',side:'',back:''};
  document.querySelectorAll('.photo-slot').forEach(s=>{s.classList.remove('has-image');s.querySelector('img').removeAttribute('src');s.querySelector('input').value='';});
  saveState();
};
async function renderPhotos(){
  const root=document.getElementById('photoTimeline'),sets=[...state.photoSets].sort((a,b)=>b.date.localeCompare(a.date));
  if(!sets.length){root.innerHTML='<p class="muted">Noch kein Fotosatz gespeichert. Alle 4 Wochen unter ähnlichen Bedingungen fotografieren.</p>';return;}
  const resolved=[];
  for(const set of sets){
    let data=set;
    if(!(set.front||set.side||set.back)){
      try{data={...set,...(await photoGet(set.id)||{})};}catch(e){data=set;}
    }
    resolved.push(data);
  }
  root.innerHTML=resolved.map(set=>`<div class="photo-set"><div class="photo-set-head"><b>${deDateLong(set.date)}</b><button type="button" class="small-btn danger" data-del-photo="${set.id||set.date}">Löschen</button></div><div class="photo-set-images">${['front','side','back'].map(k=>set[k]?`<img src="${set[k]}" alt="Fortschrittsfoto ${k}">`:'<div></div>').join('')}</div></div>`).join('');
  root.querySelectorAll('[data-del-photo]').forEach(btn=>btn.onclick=async()=>{if(confirm('Diesen Fotosatz löschen?')){const id=btn.dataset.delPhoto;try{await photoDelete(+id);}catch(e){}state.photoSets=state.photoSets.filter(x=>String(x.id||x.date)!==id);saveState();}});
}

function renderCreatineStreak() {
  let streak=0,key=localDateKey(); for(let i=0;i<365;i++){if(state.daily[key]?.creatine){streak++;key=addDaysKey(key,-1)}else break;} return streak;
}

function renderAllDerived() {
  renderDashboard(); renderMeals(); renderVacation(); renderStats(); renderSkills(); renderRoadmap(); renderPhotos();
}
function restoreActiveSession() {
  if (!state.activeSession) return false;
  const a = state.activeSession;
  guided = {
    key: a.key,
    date: a.date || localDateKey(),
    template: workoutTemplate(a.key, a.date || localDateKey()),
    itemIndex: a.itemIndex || 0,
    setIndex: a.setIndex || 0,
    logs: a.logs || {},
    startedAt: a.startedAt || new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    completed: false
  };
  selectedWorkout = a.key || selectedWorkout;
  return true;
}

function renderAll() {
  migrateLegacyPhotos().then(()=>renderPhotos()).catch(()=>{});
  const todayPlan = planForDate();
  if (!state.activeSession && todayPlan.type === 'workout') selectedWorkout = todayPlan.workout;
  restoreActiveSession();
  loadDailyForm();
  renderWorkoutTabs();
  renderTrainingOverview();
  renderMealPresets();
  renderAllDerived();
  updateOnline();
}

function switchView(id) {
  if (id === 'train' && !state.activeSession && planForDate().type !== 'workout') manualWorkoutMode = false;
  document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===id));
  if(id==='stats') setTimeout(()=>{renderStats();drawCharts();},30);
  if(id==='train'){renderWorkoutTabs();renderTrainingOverview();}
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.target));
document.querySelectorAll('[data-nav]').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.nav));

document.getElementById('openTodayWorkout').onclick=()=>{if(state.activeSession){selectedWorkout=state.activeSession.key;switchView('train');restoreActiveSession();renderTrainingOverview();return;}const plan=planForDate();if(plan.type!=='workout')return;if(workoutDoneDate(localDateKey(),plan.workout))return;selectedWorkout=plan.workout;switchView('train');startGuided(plan.workout);};
document.getElementById('quickHandstandBtn').onclick=startHandstandSession;
document.getElementById('startSkillTimer').onclick=startHandstandSession;
document.getElementById('measureWaistNow').onclick=()=>{switchView('stats');setTimeout(()=>document.getElementById('wWaist').focus(),350);};

async function exportBackup() {
  let photoBlobs=[];
  try{photoBlobs=await photoGetAll();}catch(e){console.warn('Fotos konnten nicht ins Backup aufgenommen werden',e);}
  const backup={...state,photoBlobs};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`calisthenics-coach-v3-${localDateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
document.getElementById('exportBtn').onclick=exportBackup;
document.getElementById('importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const raw=JSON.parse(await f.text());const blobs=Array.isArray(raw.photoBlobs)?raw.photoBlobs:[];delete raw.photoBlobs;state=migrate(raw);for(const rec of blobs){try{await photoPut(rec);}catch(err){console.warn(err);}}saveState();renderAll();alert('Backup importiert ✓');}catch(err){console.error(err);alert('Backup konnte nicht gelesen werden.');}};
document.getElementById('resetBtn').onclick=async()=>{if(confirm('Wirklich ALLE lokalen App-Daten inklusive Fotos löschen?')){try{await photoClear();}catch(e){}localStorage.removeItem(STORE_KEY);state=clone(defaultState);saveState(false);location.reload();}};

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden');});
document.getElementById('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').classList.add('hidden');};
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
function updateOnline(){const b=document.getElementById('onlineBadge');b.textContent=navigator.onLine?'online':'offline';b.classList.toggle('offline',!navigator.onLine)}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);

renderAll();
