'use strict';

const STORE_KEY = 'calisthenicsCoach_v2'; // bewusst gleich: V2-Daten bleiben erhalten
const VERSION = '2.1.0';

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
  const W = 420, H = compact ? 100 : 210;
  const c = '#eaf2ff', a = '#61e6b7', b = '#7db7ff', line = '#294662', muted = '#7890a8';
  const ln = (x1, y1, x2, y2, color = c, w = 6) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  const head = (x, y, r = 9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="5"/>`;
  const txt = (x, y, t, color = a, size = 12) => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="system-ui" font-weight="800">${t}</text>`;
  const arrow = (x1, y1, x2, y2) => `${ln(x1,y1,x2,y2,a,3)}<polyline points="${x2-6},${y2-5} ${x2},${y2} ${x2-6},${y2+5}" fill="none" stroke="${a}" stroke-width="3"/>`;
  const base = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Übungsdarstellung"><rect width="${W}" height="${H}" rx="18" fill="#071321"/><line x1="210" y1="28" x2="210" y2="${H-14}" stroke="#17314a" stroke-width="2" stroke-dasharray="5 7"/>${txt(18,22,'START',b,10)}${txt(228,22,'ZIEL',a,10)}`;
  const end = '</svg>';

  if (compact) {
    const icons = {
      circles: `${head(42,40,6)}${ln(42,47,42,70,c,4)}<circle cx="42" cy="55" r="20" fill="none" stroke="${a}" stroke-width="3" stroke-dasharray="5 4"/>`,
      pullapart: `${head(42,30,6)}${ln(42,37,42,70,c,4)}${ln(20,48,64,48,a,4)}${arrow(36,48,18,48)}${arrow(48,48,66,48)}`,
      external: `${head(42,30,6)}${ln(42,37,42,70,c,4)}${ln(42,48,60,48,c,4)}${ln(60,48,60,67,a,4)}${arrow(60,64,73,54)}`,
      scapPull: `${ln(18,18,66,18,b,4)}${head(42,38,6)}${ln(42,44,42,70,c,4)}${ln(42,48,24,22,c,4)}${ln(42,48,60,22,c,4)}${arrow(76,60,76,38)}`,
      scapPush: `${ln(14,68,72,68,line,2)}${head(24,51,6)}${ln(30,54,56,60,c,4)}${ln(56,60,70,68,c,4)}${arrow(45,40,45,53)}`
    };
    return `<svg viewBox="0 0 84 84"><rect width="84" height="84" rx="14" fill="#071321"/>${icons[kind] || icons.circles}</svg>`;
  }

  let s = base;
  const floor = y => ln(15, y, 195, y, line, 2) + ln(225, y, 405, y, line, 2);
  if (['pullup','pullupBand'].includes(kind)) {
    s += ln(35,42,185,42,b,5)+ln(245,42,395,42,b,5);
    s += head(110,82)+ln(110,91,110,135)+ln(110,100,72,48)+ln(110,100,148,48)+ln(110,135,90,180)+ln(110,135,130,180);
    s += head(320,64)+ln(320,73,320,118)+ln(320,80,282,48)+ln(320,80,358,48)+ln(320,118,300,160)+ln(320,118,340,160)+arrow(387,150,387,72);
    if (kind === 'pullupBand') s += `<path d="M110 135 C110 160 110 178 110 197" stroke="${a}" stroke-width="5" fill="none"/>${txt(126,184,'Band',a,11)}`;
  } else if (kind === 'dip') {
    s += floor(190)+ln(62,82,62,188,b,4)+ln(158,82,158,188,b,4)+ln(272,82,272,188,b,4)+ln(368,82,368,188,b,4);
    s += head(110,58)+ln(110,67,110,118)+ln(110,78,67,88)+ln(110,78,153,88)+ln(110,118,93,170)+ln(110,118,127,170);
    s += head(320,82)+ln(320,91,320,138)+ln(320,105,276,90)+ln(320,105,364,90)+ln(320,138,302,180)+ln(320,138,338,180)+arrow(390,140,390,95);
  } else if (kind === 'row') {
    s += ln(30,76,190,76,b,5)+ln(240,76,400,76,b,5)+floor(190);
    s += head(72,112)+ln(82,116,145,157)+ln(145,157,183,184)+ln(82,116,68,82)+ln(82,116,110,82);
    s += head(282,98)+ln(292,102,350,143)+ln(350,143,390,181)+ln(292,102,276,82)+ln(292,102,316,82)+arrow(385,122,350,102);
  } else if (kind === 'split') {
    s += floor(190)+`<rect x="146" y="130" width="45" height="12" rx="5" fill="${line}"/><rect x="356" y="130" width="45" height="12" rx="5" fill="${line}"/>`;
    s += head(92,58)+ln(92,67,92,112)+ln(92,112,66,184)+ln(92,112,150,136)+ln(150,136,178,184)+ln(92,78,70,106)+ln(92,78,115,106);
    s += head(300,82)+ln(300,91,300,132)+ln(300,132,275,184)+ln(300,132,360,136)+ln(360,136,388,184)+ln(300,102,278,125)+ln(300,102,322,125)+arrow(402,72,402,135);
  } else if (kind === 'pike') {
    s += floor(190);
    s += head(65,146)+ln(74,150,115,120)+ln(115,120,150,70)+ln(150,70,184,188)+ln(74,150,42,186);
    s += head(276,168)+ln(285,166,320,132)+ln(320,132,352,72)+ln(352,72,392,188)+ln(285,166,252,188)+arrow(388,45,337,113);
  } else if (kind === 'pistol') {
    s += floor(190);
    s += head(104,58)+ln(104,67,104,118)+ln(104,118,82,188)+ln(104,118,176,124)+ln(104,80,72,106);
    s += head(314,98)+ln(314,107,314,140)+ln(314,140,292,188)+ln(314,140,384,144)+ln(314,116,270,104)+arrow(398,72,398,132);
  } else if (kind === 'kneeRaise') {
    s += ln(35,42,185,42,b,5)+ln(245,42,395,42,b,5);
    s += head(110,76)+ln(110,85,110,135)+ln(110,92,72,48)+ln(110,92,148,48)+ln(110,135,95,180)+ln(110,135,125,180);
    s += head(320,76)+ln(320,85,320,132)+ln(320,92,282,48)+ln(320,92,358,48)+ln(320,132,288,142)+ln(288,142,266,120)+ln(320,132,350,142)+ln(350,142,372,120)+arrow(392,165,365,132);
  } else if (kind === 'hang') {
    s += ln(35,42,185,42,b,5)+ln(245,42,395,42,b,5);
    s += head(110,80)+ln(110,89,110,138)+ln(110,96,72,48)+ln(110,96,148,48)+ln(110,138,90,184)+ln(110,138,130,184);
    s += head(320,80)+ln(320,89,320,138)+ln(320,96,282,48)+ln(320,96,358,48)+ln(320,138,300,184)+ln(320,138,340,184)+txt(270,199,'30–45 s ruhig halten',a,11);
  } else if (kind === 'pushup') {
    s += floor(190);
    s += head(50,120)+ln(60,124,132,145)+ln(132,145,182,182)+ln(60,124,38,184)+ln(68,128,85,184);
    s += head(260,152)+ln(270,154,338,164)+ln(338,164,392,184)+ln(270,154,248,184)+ln(278,155,296,184)+arrow(394,98,368,150);
  } else if (kind === 'bandRow') {
    s += floor(190)+ln(30,55,30,185,b,5)+ln(240,55,240,185,b,5);
    s += head(128,72)+ln(128,81,128,132)+ln(128,95,38,92,a,4)+ln(128,132,105,184)+ln(128,132,150,184);
    s += head(338,72)+ln(338,81,338,132)+ln(338,95,248,92,a,4)+ln(338,95,300,102,c,5)+ln(338,132,315,184)+ln(338,132,360,184)+arrow(260,58,300,94);
  } else if (kind === 'facePull') {
    s += floor(190)+ln(30,58,30,185,b,5)+ln(240,58,240,185,b,5);
    s += head(125,76)+ln(125,85,125,135)+ln(125,102,38,92,a,4)+ln(125,135,105,184)+ln(125,135,145,184);
    s += head(335,76)+ln(335,85,335,135)+ln(335,101,248,92,a,4)+ln(335,101,305,82,c,5)+ln(335,101,305,118,c,5)+ln(335,135,315,184)+ln(335,135,355,184)+arrow(268,62,306,86);
  } else if (kind === 'sidePlank') {
    s += floor(190);
    s += head(55,130)+ln(66,134,126,150)+ln(126,150,184,184)+ln(70,138,52,184)+ln(94,142,92,100);
    s += head(265,126)+ln(276,130,337,147)+ln(337,147,394,184)+ln(280,135,260,184)+ln(305,139,304,92)+arrow(392,98,392,142);
  } else if (kind === 'hollow') {
    s += floor(190);
    s += head(50,160)+ln(60,164,112,170)+ln(112,170,175,181)+ln(60,164,25,146);
    s += head(260,158)+ln(270,162,322,160)+ln(322,160,393,138)+ln(270,162,238,136)+arrow(392,105,366,134);
  } else if (kind === 'handstand') {
    s += floor(190);
    s += head(110,145)+ln(110,136,110,92)+ln(110,92,92,40)+ln(110,92,128,40)+ln(110,136,82,184)+ln(110,136,138,184)+txt(55,200,'Chest-to-wall',muted,10);
    s += head(320,145)+ln(320,136,320,90)+ln(320,90,300,38)+ln(320,90,340,38)+ln(320,136,294,184)+ln(320,136,346,184)+arrow(390,160,390,95)+txt(270,200,'frei balancieren',muted,10);
  } else {
    s += floor(190)+head(105,70)+ln(105,79,105,130)+ln(105,95,65,115)+ln(105,95,145,115)+ln(105,130,82,184)+ln(105,130,128,184)+head(315,70)+ln(315,79,315,130)+ln(315,95,275,115)+ln(315,95,355,115)+ln(315,130,292,184)+ln(315,130,338,184);
  }
  return s + end;
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
  state.activeSession = { key, date: guided.date, itemIndex: 0, setIndex: 0, logs: {} };
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
  state.activeSession = { key: guided.key, date: guided.date, itemIndex: guided.itemIndex, setIndex: guided.setIndex, logs: guided.logs };
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function completeGuidedSession() {
  const session = {
    date: guided.date, key: guided.key, completed: true, logs: guided.logs, startedAt: guided.startedAt,
    finishedAt: new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    legChoice: guided.template.legChoice || null
  };
  state.workouts[guided.date] = session;
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
function renderAll() {
  loadDailyForm(); renderWorkoutTabs(); renderTrainingOverview(); renderMealPresets(); renderAllDerived(); updateOnline();
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
