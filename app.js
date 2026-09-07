'use strict';

const STORE_KEY = 'calisthenicsCoach_v2'; // bewusst gleich: V2-Daten bleiben erhalten
const VERSION = '2.2.0';

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
  settings: { calories: 2300, protein: 170, creatine: 5, vacation: false },
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
    cues: ['3 Sekunden kontrolliert absenken.', 'Über den ganzen Vorderfuß drücken.', 'Knie folgt der Fußrichtung.'],
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
        { id: 'bandRow', sets: 3, min: 12, max: 20, unit: 'reps', rest: 75, loadType: 'band' },
        { id: 'facePull', sets: 3, min: 15, max: 25, unit: 'reps', rest: 60, loadType: 'band' },
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
  if (!d.sleep && d.energy == null && pain === 0) return { mode: 'CHECK', score: null, text: 'Recovery-Check noch offen.' };
  const sleep = +d.sleep || 0, energy = +d.energy || 3;
  const score = clamp(Math.round((Math.min(sleep / 8, 1) * 45) + (energy / 5 * 35) + ((10 - pain) / 10 * 20)), 0, 100);
  if (pain >= 4) return { mode: 'STOP', score, text: 'Heute kein schmerzhaftes Oberkörpertraining. Wenn Beschwerden anhalten oder zunehmen: Belastung reduzieren und abklären lassen.' };
  if (sleep < 5 || energy <= 1) return { mode: 'REDUCED', score, text: 'Sehr wenig Recovery: Technik sauber halten, 2–3 RIR, keine Maximalversuche; Home C notfalls verschieben.' };
  if (sleep < 6 || pain >= 2 || energy === 2) return { mode: 'LIGHT', score, text: 'Leicht reduzieren: 2 RIR, saubere Technik, keine erzwungenen Wiederholungen.' };
  return { mode: 'NORMAL', score, text: 'Normales Training. Bei den meisten Sätzen 1–2 RIR lassen.' };
}

function mealTotals(key = localDateKey()) {
  const list = state.meals[key] || [];
  return {
    calories: list.reduce((s, m) => s + (+m.cal || 0), 0),
    protein: list.reduce((s, m) => s + (+m.protein || 0), 0)
  };
}

const MEAL_PRESETS = [
  { name: 'Körniger Frischkäse + Protein-Milchreis', cal: 520, protein: 55 },
  { name: 'Porridge + Whey', cal: 500, protein: 40 },
  { name: 'Whey + Banane', cal: 230, protein: 28 },
  { name: 'Hähnchen + Reis + Gemüse', cal: 720, protein: 65 },
  { name: 'Döner grob', cal: 750, protein: 40 }
];

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
  state.meals[key].push({ ...meal, id: Date.now() + Math.floor(Math.random() * 1000) });
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

function progressionCards() {
  const strength = latestStrength();
  const band = bandRecommendation();
  const pike = lastExerciseLog('pike');
  const pikeHit = pike?.sets?.length >= 4 && pike.sets.slice(-4).every(s => +s.value >= 6);
  const dips = Math.max(maxStrength('dips'), +strength.dips || 0);
  return [
    { title: 'Pull-ups', text: `${band.text} Striktes Ziel: aktuell ${maxStrength('pullups')} → zuerst 4, dann 6, dann 8–10.` },
    { title: 'HSPU-Pfad', text: pikeHit ? '4×6 Pike geschafft → Elevated Pike Push-ups als nächste Stufe.' : 'Pike Push-ups sauber aufbauen. 4×6 kontrolliert = Füße erhöhen.' },
    { title: 'Dips & Griff', text: `${dips >= 10 ? 'Dips: Richtung 3×10 reproduzierbar, danach Zusatzgewicht.' : 'Dips: Wiederholungen sauber auffüllen.'} Dead Hang: 60–90 s ist das nächste große Griffziel.` }
  ];
}

function visualSVG(kind, compact = false) {
  const W = 420, H = compact ? 92 : 220;
  const bg = '#0b1623', panel = '#101d2d', panel2 = '#122338', line = '#23384f';
  const text = '#eef4fb', muted = '#9fb3c9', accent = '#79e4bf', accent2 = '#8ec5ff', accent3 = '#f1d37a';
  const svgText = (x, y, t, fill = text, size = 12, weight = 800, anchor = 'start') =>     '<text x="' + x + '" y="' + y + '" fill="' + fill + '" font-size="' + size + '" font-family="system-ui, sans-serif" font-weight="' + weight + '" text-anchor="' + anchor + '">' + t + '</text>';
  const lineSeg = (x1, y1, x2, y2, color = accent2, width = 12) =>     '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round" />';
  const roundRect = (x, y, w, h, r = 18, fill = panel, stroke = 'rgba(255,255,255,.05)') =>     '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + r + '" fill="' + fill + '" stroke="' + stroke + '" />';
  const circle = (x, y, r, fill = accent2) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + fill + '" />';
  const pill = (x, y, w, h, fill = accent2) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (h/2) + '" fill="' + fill + '" />';
  const label = (x, y, t) => roundRect(x, y - 16, 64, 24, 12, '#102132', '#1d334b') + svgText(x + 32, y, t, accent, 10, 900, 'middle');
  const arrow = (x1, y1, x2, y2, color = accent) => lineSeg(x1, y1, x2, y2, color, 4) + '<path d="M ' + (x2 - 7) + ' ' + (y2 - 6) + ' L ' + x2 + ' ' + y2 + ' L ' + (x2 - 7) + ' ' + (y2 + 6) + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />';
  const ground = (x, y, w) => lineSeg(x, y, x + w, y, line, 3);
  const bar = (x, y, w) => lineSeg(x, y, x + w, y, accent2, 7);
  const band = (x1, y1, x2, y2) => '<path d="M ' + x1 + ' ' + y1 + ' C ' + x1 + ' ' + (y1 + 20) + ', ' + x2 + ' ' + (y2 - 20) + ', ' + x2 + ' ' + y2 + '" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linecap="round" />';
  const rig = (x, y, h) => lineSeg(x, y, x, y + h, line, 6);
  const silhouette = (cx, cy, pose = 'stand', color = accent2) => {
    const headY = cy - 38;
    let s = circle(cx, headY, 13, color) + pill(cx - 14, cy - 20, 28, 48, color);
    if (pose === 'hang') {
      s += lineSeg(cx - 10, cy - 8, cx - 28, cy - 50, color, 14) + lineSeg(cx + 10, cy - 8, cx + 28, cy - 50, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 16, cy + 62, color, 14) + lineSeg(cx + 8, cy + 25, cx + 16, cy + 62, color, 14);
    } else if (pose === 'top') {
      s += lineSeg(cx - 8, cy - 12, cx - 26, cy - 28, color, 14) + lineSeg(cx + 8, cy - 12, cx + 26, cy - 28, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 18, cy + 58, color, 14) + lineSeg(cx + 8, cy + 25, cx + 18, cy + 58, color, 14);
    } else if (pose === 'dipTop') {
      s += lineSeg(cx - 8, cy - 8, cx - 36, cy + 8, color, 14) + lineSeg(cx + 8, cy - 8, cx + 36, cy + 8, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 18, cy + 60, color, 14) + lineSeg(cx + 8, cy + 25, cx + 18, cy + 60, color, 14);
    } else if (pose === 'dipBottom') {
      s += lineSeg(cx - 8, cy - 4, cx - 34, cy - 6, color, 14) + lineSeg(cx + 8, cy - 4, cx + 34, cy - 6, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 14, cy + 58, color, 14) + lineSeg(cx + 8, cy + 25, cx + 14, cy + 58, color, 14);
    } else if (pose === 'rowLow') {
      s += lineSeg(cx - 10, cy - 6, cx - 38, cy - 26, color, 14) + lineSeg(cx + 10, cy - 6, cx + 38, cy - 26, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 26, cy + 55, color, 14) + lineSeg(cx + 8, cy + 25, cx + 26, cy + 55, color, 14);
    } else if (pose === 'rowHigh') {
      s += lineSeg(cx - 10, cy - 8, cx - 40, cy - 18, color, 14) + lineSeg(cx + 10, cy - 8, cx + 40, cy - 18, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 26, cy + 55, color, 14) + lineSeg(cx + 8, cy + 25, cx + 26, cy + 55, color, 14);
    } else if (pose === 'splitTop') {
      s += lineSeg(cx - 8, cy - 8, cx - 28, cy + 10, color, 14) + lineSeg(cx + 8, cy - 8, cx + 26, cy + 8, color, 14);
      s += lineSeg(cx - 6, cy + 26, cx - 28, cy + 64, color, 14) + lineSeg(cx + 6, cy + 26, cx + 48, cy + 36, color, 14) + lineSeg(cx + 48, cy + 36, cx + 70, cy + 62, color, 14);
    } else if (pose === 'splitBottom') {
      s += lineSeg(cx - 8, cy - 10, cx - 20, cy + 12, color, 14) + lineSeg(cx + 8, cy - 10, cx + 16, cy + 10, color, 14);
      s += lineSeg(cx - 6, cy + 26, cx - 22, cy + 64, color, 14) + lineSeg(cx + 6, cy + 26, cx + 56, cy + 28, color, 14) + lineSeg(cx + 56, cy + 28, cx + 76, cy + 62, color, 14);
    } else if (pose === 'pikeTop') {
      s += lineSeg(cx - 2, cy - 8, cx - 28, cy + 12, color, 14) + lineSeg(cx + 2, cy - 8, cx + 28, cy + 12, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 28, cy + 62, color, 14) + lineSeg(cx + 8, cy + 25, cx + 28, cy + 62, color, 14);
    } else if (pose === 'pikeBottom') {
      s += lineSeg(cx - 2, cy + 2, cx - 28, cy + 18, color, 14) + lineSeg(cx + 2, cy + 2, cx + 28, cy + 18, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 28, cy + 62, color, 14) + lineSeg(cx + 8, cy + 25, cx + 28, cy + 62, color, 14);
    } else if (pose === 'pistolTop') {
      s += lineSeg(cx - 8, cy - 6, cx - 30, cy + 6, color, 14) + lineSeg(cx + 8, cy - 6, cx + 24, cy + 8, color, 14);
      s += lineSeg(cx - 6, cy + 26, cx - 22, cy + 62, color, 14) + lineSeg(cx + 6, cy + 26, cx + 52, cy + 26, color, 14);
    } else if (pose === 'pistolBottom') {
      s += lineSeg(cx - 8, cy - 4, cx - 26, cy + 8, color, 14) + lineSeg(cx + 8, cy - 4, cx + 18, cy + 10, color, 14);
      s += lineSeg(cx - 6, cy + 26, cx - 20, cy + 62, color, 14) + lineSeg(cx + 6, cy + 26, cx + 58, cy + 36, color, 14);
    } else if (pose === 'raiseLow') {
      s += lineSeg(cx - 10, cy - 8, cx - 28, cy - 50, color, 14) + lineSeg(cx + 10, cy - 8, cx + 28, cy - 50, color, 14);
      s += lineSeg(cx - 8, cy + 25, cx - 18, cy + 62, color, 14) + lineSeg(cx + 8, cy + 25, cx + 18, cy + 62, color, 14);
    } else if (pose === 'raiseHigh') {
      s += lineSeg(cx - 10, cy - 8, cx - 28, cy - 50, color, 14) + lineSeg(cx + 10, cy - 8, cx + 28, cy - 50, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 38, cy + 12, color, 14) + lineSeg(cx + 8, cy + 26, cx + 38, cy + 12, color, 14);
    } else if (pose === 'plankHigh') {
      s += lineSeg(cx - 8, cy - 8, cx - 32, cy + 18, color, 14) + lineSeg(cx + 8, cy - 8, cx + 34, cy + 18, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 34, cy + 62, color, 14) + lineSeg(cx + 8, cy + 26, cx + 34, cy + 62, color, 14);
    } else if (pose === 'plankLow') {
      s += lineSeg(cx - 8, cy - 2, cx - 34, cy + 22, color, 14) + lineSeg(cx + 8, cy - 2, cx + 34, cy + 22, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 34, cy + 62, color, 14) + lineSeg(cx + 8, cy + 26, cx + 34, cy + 62, color, 14);
    } else if (pose === 'bandRowStart') {
      s += lineSeg(cx - 8, cy - 8, cx - 44, cy + 4, color, 14) + lineSeg(cx + 8, cy - 8, cx + 18, cy + 8, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 18, cy + 62, color, 14) + lineSeg(cx + 8, cy + 26, cx + 18, cy + 62, color, 14);
    } else if (pose === 'bandRowFinish') {
      s += lineSeg(cx - 8, cy - 8, cx - 24, cy - 6, color, 14) + lineSeg(cx + 8, cy - 8, cx + 20, cy + 8, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 18, cy + 62, color, 14) + lineSeg(cx + 8, cy + 26, cx + 18, cy + 62, color, 14);
    } else if (pose === 'sidePlankA') {
      s += lineSeg(cx - 10, cy - 8, cx + 20, cy - 8, color, 14) + lineSeg(cx + 8, cy + 26, cx + 38, cy + 26, color, 14) + lineSeg(cx - 10, cy + 26, cx - 28, cy + 62, color, 14);
    } else if (pose === 'sidePlankB') {
      s += lineSeg(cx - 10, cy - 8, cx + 22, cy - 24, color, 14) + lineSeg(cx + 8, cy + 26, cx + 38, cy + 26, color, 14) + lineSeg(cx - 10, cy + 26, cx - 28, cy + 62, color, 14);
    } else if (pose === 'hollowA') {
      s += lineSeg(cx - 10, cy - 8, cx - 36, cy - 16, color, 14) + lineSeg(cx + 8, cy + 26, cx + 38, cy + 34, color, 14) + lineSeg(cx - 8, cy + 26, cx - 30, cy + 40, color, 14);
    } else if (pose === 'hollowB') {
      s += lineSeg(cx - 10, cy - 8, cx - 40, cy - 30, color, 14) + lineSeg(cx + 8, cy + 26, cx + 44, cy + 16, color, 14) + lineSeg(cx - 8, cy + 26, cx - 34, cy + 12, color, 14);
    } else if (pose === 'hsWall') {
      s += lineSeg(cx - 10, cy - 8, cx - 24, cy - 52, color, 14) + lineSeg(cx + 10, cy - 8, cx + 24, cy - 52, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 18, cy + 64, color, 14) + lineSeg(cx + 8, cy + 26, cx + 18, cy + 64, color, 14);
    } else if (pose === 'hsFree') {
      s += lineSeg(cx - 10, cy - 8, cx - 28, cy - 54, color, 14) + lineSeg(cx + 10, cy - 8, cx + 24, cy - 48, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 18, cy + 64, color, 14) + lineSeg(cx + 8, cy + 26, cx + 18, cy + 64, color, 14);
    } else {
      s += lineSeg(cx - 8, cy - 8, cx - 28, cy + 8, color, 14) + lineSeg(cx + 8, cy - 8, cx + 28, cy + 8, color, 14);
      s += lineSeg(cx - 8, cy + 26, cx - 18, cy + 62, color, 14) + lineSeg(cx + 8, cy + 26, cx + 18, cy + 62, color, 14);
    }
    return s;
  };
  const shellStart = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Übungsdarstellung"><rect width="' + W + '" height="' + H + '" rx="22" fill="' + bg + '" />';
  const shellEnd = '</svg>';

  if (compact) {
    const icons = {
      circles: roundRect(8, 8, 68, 68, 16, panel2, '#1f3550') + circle(42, 33, 8, accent2) + '<path d="M42 22 C53 22 60 30 60 41 C60 52 51 60 40 60" fill="none" stroke="' + accent + '" stroke-width="6" stroke-linecap="round" />' + '<path d="M36 24 C25 24 18 33 18 43" fill="none" stroke="' + accent3 + '" stroke-width="6" stroke-linecap="round" />',
      wrists: roundRect(8, 8, 68, 68, 16, panel2, '#1f3550') + pill(24, 42, 36, 10, accent2) + circle(30, 34, 8, accent) + circle(54, 34, 8, accent) + '<path d="M20 56 C28 50 32 47 40 47" fill="none" stroke="' + accent3 + '" stroke-width="5" stroke-linecap="round" />',
      pullapart: roundRect(8, 8, 68, 68, 16, panel2, '#1f3550') + pill(18, 38, 48, 8, accent) + arrow(30, 42, 16, 42, accent2) + arrow(54, 42, 68, 42, accent2),
      external: roundRect(8, 8, 68, 68, 16, panel2, '#1f3550') + circle(28, 28, 8, accent2) + pill(24, 36, 10, 26, accent2) + pill(32, 42, 22, 8, accent2) + arrow(48, 46, 62, 32, accent),
      scapPull: roundRect(8, 8, 68, 68, 16, panel2, '#1f3550') + bar(16, 18, 36) + silhouette(34, 44, 'hang', accent2) + arrow(58, 56, 58, 36, accent),
      scapPush: roundRect(8, 8, 68, 68, 16, panel2, '#1f3550') + ground(14, 58, 44) + silhouette(34, 42, 'plankLow', accent2) + arrow(56, 20, 56, 42, accent)
    };
    return '<svg viewBox="0 0 84 84">' + (icons[kind] || icons.circles) + '</svg>';
  }

  let svg = shellStart + roundRect(14, 16, 186, H - 30, 20, panel, '#17273a') + roundRect(220, 16, 186, H - 30, 20, panel, '#17273a') + label(26, 34, 'Start') + label(232, 34, 'Ziel');

  const drawPair = (left, right, extras = '') => {
    svg += left + right + extras;
  };

  if (['pullup','pullupBand'].includes(kind)) {
    drawPair(
      bar(56, 58, 100) + silhouette(108, 120, 'hang') + svgText(108, 194, 'Aktiver Hang', muted, 11, 700, 'middle'),
      bar(262, 58, 100) + silhouette(314, 102, 'top', accent) + arrow(385, 170, 385, 80) + svgText(314, 194, 'Kinn über Stange', muted, 11, 700, 'middle'),
      kind === 'pullupBand' ? band(108, 148, 108, 188) + band(314, 130, 314, 188) + svgText(352, 34, 'Bandhilfe', accent, 10, 900, 'middle') : ''
    );
  } else if (kind === 'dip') {
    drawPair(
      rig(72, 84, 92) + rig(144, 84, 92) + silhouette(108, 94, 'dipTop') + ground(34, 186, 132),
      rig(278, 84, 92) + rig(350, 84, 92) + silhouette(314, 112, 'dipBottom', accent) + ground(240, 186, 132) + arrow(388, 164, 388, 98)
    );
  } else if (kind === 'row') {
    drawPair(
      bar(50, 74, 116) + ground(34, 186, 142) + silhouette(98, 132, 'rowLow'),
      bar(256, 74, 116) + ground(240, 186, 142) + silhouette(304, 118, 'rowHigh', accent) + arrow(374, 120, 338, 106)
    );
  } else if (kind === 'split') {
    drawPair(
      ground(34, 186, 142) + roundRect(138, 135, 32, 12, 6, line, line) + silhouette(92, 96, 'splitTop'),
      ground(240, 186, 142) + roundRect(344, 135, 32, 12, 6, line, line) + silhouette(298, 114, 'splitBottom', accent) + arrow(390, 76, 390, 136)
    );
  } else if (kind === 'pike') {
    drawPair(
      ground(34, 186, 142) + silhouette(98, 116, 'pikeTop'),
      ground(240, 186, 142) + silhouette(304, 132, 'pikeBottom', accent) + arrow(387, 64, 348, 110)
    );
  } else if (kind === 'pistol') {
    drawPair(
      ground(34, 186, 142) + silhouette(92, 98, 'pistolTop'),
      ground(240, 186, 142) + silhouette(298, 118, 'pistolBottom', accent) + arrow(390, 76, 390, 136)
    );
  } else if (kind === 'kneeRaise') {
    drawPair(
      bar(56, 58, 100) + silhouette(108, 120, 'raiseLow'),
      bar(262, 58, 100) + silhouette(314, 120, 'raiseHigh', accent) + arrow(390, 170, 352, 128)
    );
  } else if (kind === 'hang') {
    drawPair(
      bar(56, 58, 100) + silhouette(108, 120, 'hang') + svgText(108, 194, 'Grip ruhig halten', muted, 11, 700, 'middle'),
      bar(262, 58, 100) + silhouette(314, 120, 'hang', accent) + svgText(314, 194, '30–45 s', accent, 12, 900, 'middle')
    );
  } else if (kind === 'pushup') {
    drawPair(
      ground(34, 186, 142) + silhouette(98, 116, 'plankHigh'),
      ground(240, 186, 142) + silhouette(304, 136, 'plankLow', accent) + arrow(390, 92, 362, 142)
    );
  } else if (kind === 'bandRow') {
    drawPair(
      rig(40, 60, 120) + silhouette(112, 102, 'bandRowStart') + band(42, 92, 68, 92),
      rig(246, 60, 120) + silhouette(318, 100, 'bandRowFinish', accent) + band(248, 92, 294, 92) + arrow(268, 58, 304, 82)
    );
  } else if (kind === 'facePull') {
    drawPair(
      rig(40, 60, 120) + silhouette(112, 100, 'bandRowStart') + band(42, 92, 68, 92),
      rig(246, 60, 120) + silhouette(318, 96, 'bandRowFinish', accent) + band(248, 92, 304, 92) + arrow(266, 60, 296, 82)
    );
  } else if (kind === 'sidePlank') {
    drawPair(
      ground(34, 186, 142) + silhouette(96, 124, 'sidePlankA'),
      ground(240, 186, 142) + silhouette(302, 124, 'sidePlankB', accent) + arrow(390, 104, 390, 136)
    );
  } else if (kind === 'hollow') {
    drawPair(
      ground(34, 186, 142) + silhouette(102, 142, 'hollowA'),
      ground(240, 186, 142) + silhouette(308, 138, 'hollowB', accent) + arrow(390, 96, 360, 122)
    );
  } else if (kind === 'handstand') {
    drawPair(
      ground(34, 186, 142) + lineSeg(160, 42, 160, 186, line, 4) + silhouette(102, 132, 'hsWall') + svgText(102, 194, 'Chest-to-wall', muted, 11, 700, 'middle'),
      ground(240, 186, 142) + silhouette(314, 132, 'hsFree', accent) + arrow(390, 166, 390, 96) + svgText(314, 194, 'frei balancieren', muted, 11, 700, 'middle')
    );
  } else {
    drawPair(
      ground(34, 186, 142) + silhouette(98, 104, 'stand'),
      ground(240, 186, 142) + silhouette(304, 104, 'stand', accent)
    );
  }
  return svg + shellEnd;
}

function targetText(item) {
  if (item.special === 'warmup') return 'ca. 5 Min.';
  if (item.special === 'handstand') return item.range || `${item.minutes} Min.`;
  const unit = item.unit === 's' ? 's' : 'Wdh.';
  return `${item.sets}×${item.min}–${item.max} ${unit}${item.suffix ? ` · ${item.suffix}` : ''}`;
}

function renderWarmupSteps() {
  return `<div class="warmup-list">${WARMUP_STEPS.map(([name, target, kind]) => `<div class="warmup-step">${visualSVG(kind, true)}<div><b>${name}</b><small>${target}</small></div></div>`).join('')}</div>`;
}

function renderExerciseCard(item) {
  const ex = EX[item.id];
  return `<article class="card exercise-card">
    <div class="card-head"><div><div class="eyebrow">${ex.cat}</div><h3>${ex.name}</h3></div><span class="pill">${targetText(item)}</span></div>
    <div class="visual">${visualSVG(ex.visual)}</div>
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
    openBtn.classList.remove('hidden'); openBtn.disabled = !canTrain; openBtn.textContent = canTrain ? 'Training starten' : 'Heute nicht starten';
    hsBtn.classList.add('hidden');
  } else if (plan.type === 'skill') {
    openBtn.classList.add('hidden'); hsBtn.classList.remove('hidden'); hsBtn.textContent = '5–10 Min. Handstand starten';
  } else {
    openBtn.classList.add('hidden');
    const dow = parseDateKey(today).getDay();
    const hsRecommended = dow === 6 && !state.handstandPractice[today];
    hsBtn.classList.toggle('hidden', !hsRecommended); hsBtn.textContent = 'Kurzen Handstand-Block starten';
  }

  document.getElementById('todayCalories').textContent = meals.calories;
  document.getElementById('todayProtein').textContent = meals.protein;
  document.getElementById('calProgress').style.width = `${clamp(meals.calories / state.settings.calories * 100, 0, 100)}%`;
  const calLeft = state.settings.calories - meals.calories, protLeft = state.settings.protein - meals.protein;
  document.getElementById('nutritionCoach').textContent = state.settings.vacation
    ? 'Urlaubsmodus: Gewicht ungefähr halten, Protein priorisieren, kein aggressiver Cut.'
    : `${calLeft > 0 ? `${calLeft} kcal übrig` : `${Math.abs(calLeft)} kcal über Ziel`} · ${protLeft > 0 ? `${protLeft} g Protein fehlen` : 'Proteinziel geschafft ✓'}`;

  document.getElementById('todayWorkoutTitle').textContent = plan.title;
  document.getElementById('todayDuration').textContent = plan.duration;
  const preview = document.getElementById('todayPreview');
  if (plan.type === 'workout') {
    const wt = workoutTemplate(plan.workout, today);
    preview.innerHTML = wt.items.map((item, i) => `<div class="preview-item"><span class="num">${i+1}</span><div><b>${EX[item.id].name}</b><small>${targetText(item)}</small></div></div>`).join('');
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

function renderWorkoutTabs() {
  const root = document.getElementById('workoutTabs');
  root.innerHTML = ['A','B','C'].map(k => `<button type="button" data-workout-tab="${k}" class="${selectedWorkout === k ? 'active' : ''}">${workoutTemplate(k).label}</button>`).join('');
  root.querySelectorAll('[data-workout-tab]').forEach(btn => btn.onclick = () => { selectedWorkout = btn.dataset.workoutTab; guided = null; renderWorkoutTabs(); renderTrainingOverview(); });
}

function renderTrainingOverview() {
  const root = document.getElementById('trainingOverview'); const coach = document.getElementById('guidedCoach');
  if (guided) { root.classList.add('hidden'); coach.classList.remove('hidden'); renderGuided(); return; }
  root.classList.remove('hidden'); coach.classList.add('hidden');
  const wt = workoutTemplate(selectedWorkout, localDateKey()), rec = recoveryDecision();
  root.innerHTML = `<article class="card">
      <div class="workout-header"><div><div class="eyebrow">${wt.focus}</div><h2>${wt.label}</h2><p class="muted">${wt.duration}</p></div><span class="mode-badge ${['LIGHT','REDUCED'].includes(rec.mode)?'light':rec.mode==='STOP'?'stop':''}">${rec.mode}</span></div>
      <p class="coach-tip">${rec.text} ${selectedWorkout === 'B' ? `Beine heute: <b>${EX[wt.legChoice].name}</b>.` : ''}</p>
      <button id="startWorkoutBtn" class="primary full" type="button" ${rec.mode === 'STOP' ? 'disabled' : ''}>${rec.mode === 'STOP' ? 'Wegen Gelenk-Check nicht starten' : 'Geführtes Training starten'}</button>
    </article>
    <div class="workout-list">${wt.items.map(renderExerciseCard).join('')}</div>`;
  document.getElementById('startWorkoutBtn').onclick = () => startGuided(selectedWorkout);
}

function startGuided(key) {
  const rec = recoveryDecision();
  if (rec.mode === 'STOP') return;
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
      ? `<label>Band-Hilfe<select id="setLoad"><option value="30" ${bandRec===30?'selected':''}>30 kg</option><option value="20" ${bandRec===20?'selected':''}>20 kg</option><option value="10" ${bandRec===10?'selected':''}>10 kg</option><option value="0" ${bandRec===0?'selected':''}>ohne Band</option></select></label>` : '';
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
      <div class="coach-visual">${visualSVG(ex.visual)}</div>
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
  if (item.loadType === 'band') entry.load = +document.getElementById('setLoad').value;
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

function renderMeals() {
  const key = localDateKey(); state.meals[key] ||= [];
  const list = state.meals[key], totals = mealTotals(key), d = state.daily[key] || {};
  document.getElementById('foodCalories').textContent = totals.calories;
  document.getElementById('foodProtein').textContent = `${totals.protein} g`;
  document.getElementById('foodCaloriesLeft').textContent = state.settings.vacation ? 'Urlaub: Erhalt' : `${Math.max(0, state.settings.calories - totals.calories)} übrig`;
  document.getElementById('foodProteinLeft').textContent = `${Math.max(0, state.settings.protein - totals.protein)} g übrig`;
  document.getElementById('foodWater').textContent = `${d.water ?? 0} L`;
  document.getElementById('foodCreatine').textContent = d.creatine ? 'Ja' : 'Nein';
  document.getElementById('foodModeBadge').textContent = state.settings.vacation ? 'URLAUB' : 'CUT';
  document.getElementById('mealList').innerHTML = list.length ? list.map(m => `<div class="meal-log-item"><div><b>${m.name}</b><small>${m.cal} kcal · ${m.protein} g Protein</small></div><button type="button" data-delmeal="${m.id}">×</button></div>`).join('') : '<p class="muted">Noch nichts geloggt.</p>';
  document.querySelectorAll('[data-delmeal]').forEach(btn => btn.onclick = () => { state.meals[key] = list.filter(m => m.id !== +btn.dataset.delmeal); saveState(); });
}

function renderMealPresets() {
  const root = document.getElementById('mealPresets');
  root.innerHTML = MEAL_PRESETS.map((m, i) => `<button type="button" data-preset="${i}">${m.name}</button>`).join('');
  root.querySelectorAll('[data-preset]').forEach(btn => btn.onclick = () => addMeal(MEAL_PRESETS[+btn.dataset.preset]));
}
document.getElementById('mealForm').onsubmit = e => {
  e.preventDefault(); const name = document.getElementById('mealName').value.trim(); const cal = +document.getElementById('mealCalories').value; const protein = +document.getElementById('mealProtein').value || 0;
  if (!name || !cal) return; addMeal({ name, cal, protein }); e.target.reset();
};
document.getElementById('clearMeals').onclick = () => { if (confirm('Heutige Mahlzeiten wirklich leeren?')) { state.meals[localDateKey()] = []; saveState(); } };

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
  const start = weekStartKey(); const specs = [['Mo',0],['Mi',2],['Do',3],['Sa',5]];
  const root = document.getElementById('handstandDays');
  root.innerHTML = specs.map(([label,offset])=>{const key=addDaysKey(start,offset),done=!!state.handstandPractice[key];return `<button type="button" class="hs-day ${done?'done':''}" data-hs-day="${key}">${done?'✓ ':''}${label}</button>`}).join('');
  root.querySelectorAll('[data-hs-day]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.hsDay;state.handstandPractice[key]=!state.handstandPractice[key];saveState();});
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

let pendingPhotos = { front:'', side:'', back:'' };
async function resizePhoto(file) {
  return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>{const img=new Image();img.onload=()=>{const max=720,scale=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.56));};img.onerror=reject;img.src=fr.result;};fr.onerror=reject;fr.readAsDataURL(file);});
}
[['photoFront','front'],['photoSide','side'],['photoBack','back']].forEach(([id,key])=>{
  document.getElementById(id).onchange=async e=>{const file=e.target.files?.[0];if(!file)return;pendingPhotos[key]=await resizePhoto(file);const slot=e.target.closest('.photo-slot');slot.classList.add('has-image');slot.querySelector('img').src=pendingPhotos[key];};
});
document.getElementById('savePhotoSet').onclick=()=>{if(!Object.values(pendingPhotos).some(Boolean)){alert('Bitte mindestens ein Foto auswählen.');return;}state.photoSets.push({date:localDateKey(),...pendingPhotos,id:Date.now()});pendingPhotos={front:'',side:'',back:''};document.querySelectorAll('.photo-slot').forEach(s=>{s.classList.remove('has-image');s.querySelector('img').removeAttribute('src');s.querySelector('input').value='';});saveState();};
function renderPhotos(){const root=document.getElementById('photoTimeline'),sets=[...state.photoSets].sort((a,b)=>b.date.localeCompare(a.date));root.innerHTML=sets.length?sets.map(set=>`<div class="photo-set"><div class="photo-set-head"><b>${deDateLong(set.date)}</b><button type="button" class="small-btn danger" data-del-photo="${set.id||set.date}">Löschen</button></div><div class="photo-set-images">${['front','side','back'].map(k=>set[k]?`<img src="${set[k]}" alt="Fortschrittsfoto ${k}">`:'<div></div>').join('')}</div></div>`).join(''):'<p class="muted">Noch kein Fotosatz gespeichert. Alle 4 Wochen unter ähnlichen Bedingungen fotografieren.</p>';root.querySelectorAll('[data-del-photo]').forEach(btn=>btn.onclick=()=>{if(confirm('Diesen Fotosatz löschen?')){state.photoSets=state.photoSets.filter(x=>String(x.id||x.date)!==btn.dataset.delPhoto);saveState();}});}

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
  document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===id));
  if(id==='stats') setTimeout(()=>{renderStats();drawCharts();},30);
  if(id==='train'){renderWorkoutTabs();renderTrainingOverview();}
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.target));
document.querySelectorAll('[data-nav]').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.nav));

document.getElementById('openTodayWorkout').onclick=()=>{const plan=planForDate();if(plan.type!=='workout')return;selectedWorkout=plan.workout;switchView('train');startGuided(plan.workout);};
document.getElementById('quickHandstandBtn').onclick=startHandstandSession;
document.getElementById('startSkillTimer').onclick=startHandstandSession;
document.getElementById('measureWaistNow').onclick=()=>{switchView('stats');setTimeout(()=>document.getElementById('wWaist').focus(),350);};

function exportBackup() {
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`calisthenics-coach-v2.1-${localDateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
document.getElementById('exportBtn').onclick=exportBackup;
document.getElementById('importFile').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{state=migrate(JSON.parse(await f.text()));saveState();renderAll();alert('Backup importiert ✓');}catch(err){console.error(err);alert('Backup konnte nicht gelesen werden.');}};
document.getElementById('resetBtn').onclick=()=>{if(confirm('Wirklich ALLE lokalen App-Daten inklusive Fotos löschen?')){localStorage.removeItem(STORE_KEY);state=clone(defaultState);saveState(false);location.reload();}};

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden');});
document.getElementById('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').classList.add('hidden');};
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
function updateOnline(){const b=document.getElementById('onlineBadge');b.textContent=navigator.onLine?'online':'offline';b.classList.toggle('offline',!navigator.onLine)}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);

renderAll();
