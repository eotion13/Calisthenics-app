'use strict';

const STORE_KEY = 'calisthenicsCoach_v2'; // bewusst gleich: V2-Daten bleiben erhalten
const VERSION = '5.3.0';
const GEMINI_KEY_STORE = 'calisthenicsCoach_geminiKey_v1';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';

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
    onboardingComplete: false,
    name: '', age: 30, sex: 'm', height: 175, startWeight: 75,
    bands: [10,20,30], sleepBaseline: '7', activity: 'mixed', goalMode: 'recomp', trainingDays: 3,
    diet: { halal: false, lactoseFree: false, vegetarian: false },
    goal: 'Kraft → Muskeln → Skills'
  },
  settings: { calories: 2200, protein: 150, carbs: 235, fat: 65, fiber: 30, creatine: 5, vacation: false, aiAutoDaily: false, aiAutoTraining: false, aiAutoFood: false, calorieSource: 'onboarding', maintenanceCalories: null },
  daily: {}, meals: {}, workouts: {}, handstandPractice: {}, runs: {}, customPlans: {},
  ai: { daily: {}, food: {}, workouts: {}, planReview: null, calories: null },
  measurements: [],
  strengthTests: [],
  photoSets: [],
  skillStages: { hspu: 0, flag: 0 },
  app: { version: VERSION }
};

function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ungültiges Backup');
  const out = {
    ...clone(defaultState),
    ...raw,
    profile: { ...defaultState.profile, ...(raw.profile || {}) },
    settings: { ...defaultState.settings, ...(raw.settings || {}) },
    skillStages: { ...defaultState.skillStages, ...(raw.skillStages || {}) },
    app: { version: VERSION }
  };

  if (raw && raw.profile && raw.profile.onboardingComplete == null) out.profile.onboardingComplete = true;
  out.daily ||= {}; out.meals ||= {}; out.workouts ||= {}; out.handstandPractice ||= {}; out.runs ||= {}; out.customPlans ||= {};
  out.ai = { daily: {}, food: {}, workouts: {}, planReview: null, calories: null, ...(raw.ai || {}) };
  out.ai.daily ||= {}; out.ai.food ||= {}; out.ai.workouts ||= {};
  out.measurements = Array.isArray(raw.measurements) ? raw.measurements.filter(x => x && x.date && x.waist != null).map(x => ({ date: x.date, waist: +x.waist })) : [];

  if (Array.isArray(raw.strengthTests)) {
    out.strengthTests = raw.strengthTests;
  } else if (Array.isArray(raw.measurements)) {
    const legacyStrength = raw.measurements
      .filter(x => x && x.date && [x.pullups, x.dips, x.handstand, x.hang, x.hspu].some(v => v != null))
      .map(x => ({ date: x.date, pullups: +x.pullups || 0, dips: +x.dips || 0, handstand: +x.handstand || 0, hang: +x.hang || 0, hspu: +x.hspu || 0 }));
    out.strengthTests = legacyStrength.length ? legacyStrength : clone(defaultState.strengthTests);
  }
  if (!Array.isArray(out.strengthTests)) out.strengthTests = [];

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
  persistState();
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
  negativePull: {
    name: 'Negative Pull-ups', cat: 'Pull', visual: 'pullup',
    cues: ['Mit Tritt/kleinem Sprung in die obere Position kommen.', '3–5 Sekunden kontrolliert absenken.', 'Unten kurz ruhig werden und neu starten.'],
    mistakes: ['Einfach herunterfallen.', 'Schulter unten komplett passiv kollabieren lassen.'],
    progress: '4×5 kontrollierte Negative → Band Pull-ups oder erste strikte Pull-ups.'
  },
  assistedDips: {
    name: 'Assisted Dips', cat: 'Push', visual: 'dip',
    cues: ['Mit Band oder Fußunterstützung nur so viel helfen wie nötig.', 'Schultern stabil halten.', 'Kontrolliert absenken.'],
    mistakes: ['Zu tief gehen, wenn die Schulter meckert.', 'Mit viel Schwung arbeiten.'],
    progress: '3×8 sauber → weniger Hilfe → normale Dips.'
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

Object.assign(EX, {
  elevatedPike: {
    name:'Elevated Pike Push-ups', cat:'HSPU', visual:'pike',
    cues:['Füße erhöht, Hüfte hoch und Schultern aktiv nach vorne bringen.','Kopf kontrolliert vor den Händen absenken.','Nur so tief, wie Schulter und Handgelenke stabil bleiben.'],
    mistakes:['Zu horizontal werden und daraus einen normalen Push-up machen.','ROM erzwingen, obwohl die Position instabil wird.'],
    progress:'4×6 sauber → Wall HSPU Negative.'
  },
  wallHspuNegative: {
    name:'Wall HSPU Negatives', cat:'HSPU', visual:'handstand',
    cues:['An der Wand stabil aufschwingen.','3–5 Sekunden kontrolliert absenken.','Mit sicherem Ausstieg arbeiten.'],
    mistakes:['Unkontrolliert auf den Kopf fallen.','Zu viele Wiederholungen bis die Technik bricht.'],
    progress:'3×3–5 kontrollierte Negative → Teil-ROM Wall HSPU.'
  },
  wallHspuPartial: {
    name:'Wall HSPU · Teil-ROM', cat:'HSPU', visual:'handstand',
    cues:['ROM mit Pad oder klarer Tiefenmarke steuern.','Kopf leicht vor den Händen führen.','Jede Wiederholung identisch tief.'],
    mistakes:['ROM von Satz zu Satz verkürzen.','Im unteren Punkt entspannen.'],
    progress:'3×5 sauber → ROM vergrößern bis Full Wall HSPU.'
  },
  wallHspu: {
    name:'Wall Handstand Push-ups', cat:'HSPU', visual:'handstand',
    cues:['Rumpf fest, Schultern aktiv.','Kontrolliert absenken und ohne Kipping drücken.','Saubere ROM vor Wiederholungszahl.'],
    mistakes:['Hohlkreuz und Kipping nutzen.','Halbe Wiederholungen als volle zählen.'],
    progress:'3×5 sauber → freie HSPU-Vorbereitung.'
  },
  tempoPullup: {
    name:'Tempo Pull-ups', cat:'Pull', visual:'pullup',
    cues:['2–3 Sekunden absenken.','Oben kurz kontrollieren.','Keine Wiederholung erzwingen.'],
    mistakes:['Tempo in den letzten Wiederholungen verlieren.','Mit Schwung aus dem unteren Punkt starten.'],
    progress:'4×5 kontrolliert → schwerere Pull-up-Variante oder Zusatzgewicht.'
  },
  strictPullVolume: {
    name:'Strikte Pull-ups · Volumen', cat:'Pull', visual:'pullup',
    cues:['Jede Wiederholung aus aktivem Hang.','1–2 RIR halten.','Volle ROM in jedem Satz.'],
    mistakes:['Zu früh ans Versagen gehen.','Kipping bei den letzten Wiederholungen.'],
    progress:'4×6–8 sauber → Tempo oder Zusatzgewicht.'
  },
  tempoDips: {
    name:'Tempo Dips', cat:'Push', visual:'dip',
    cues:['3 Sekunden kontrolliert absenken.','Schulter stabil und schmerzfrei halten.','Oben vollständig strecken.'],
    mistakes:['Unten federn.','Zu tief gehen, wenn die Schulter instabil wird.'],
    progress:'3×8–10 kontrolliert → Zusatzgewicht, sobald Equipment da ist.'
  },
  hangingLegRaise: {
    name:'Hanging Leg Raises', cat:'Core', visual:'kneeRaise',
    cues:['Pendeln vor jeder Wiederholung stoppen.','Beine kontrolliert heben und Becken oben einrollen.','Langsam absenken.'],
    mistakes:['Aus Schwung arbeiten.','Nur Hüftbeuger ohne Beckenkippung nutzen.'],
    progress:'3×10 sauber → Toes-to-bar Progression.'
  },
  towelHang: {
    name:'Towel Hang', cat:'Grip', visual:'hang',
    cues:['Handtuch sicher über der Stange platzieren.','Schultern leicht aktiv halten.','Griff nicht bis zu scharfem Ellenbogenschmerz erzwingen.'],
    mistakes:['Zu früh maximal lange hängen.','Schmerz ignorieren.'],
    progress:'Mehrere 30–45-s-Sätze → längere Zeit oder schwierigere Griffvariante.'
  },
  declinePushup: {
    name:'Decline Push-ups', cat:'Push', visual:'pushup',
    cues:['Füße erhöht, Körper bleibt als Linie.','Brust kontrolliert zwischen die Hände.','Schulterblätter frei bewegen lassen.'],
    mistakes:['Hüfte absinken lassen.','Nur halbe ROM nutzen.'],
    progress:'3×12–15 sauber → Pseudo-Planche Push-ups.'
  },
  feetElevatedRow: {
    name:'Feet-Elevated Inverted Rows', cat:'Pull', visual:'row',
    cues:['Füße erhöht und Körper komplett steif halten.','Brust kontrolliert zur Stange ziehen.','Oben Schulterblätter aktiv zusammenführen.'],
    mistakes:['Hüfte absinken lassen.','Mit Schwung aus der Hüfte ziehen.'],
    progress:'3×10–12 sauber → schwererer Hebel oder Zusatzlast.'
  },
  pistolSquat: {
    name:'Pistol Squats', cat:'Beine', visual:'pistol',
    cues:['Langsam absenken und Knie stabil über dem Fuß führen.','Freies Bein aktiv vorne halten.','Nur so tief, wie die Position kontrolliert bleibt.'],
    mistakes:['In die untere Position fallen.','Knie unkontrolliert nach innen kippen lassen.'],
    progress:'3×8 je Bein sauber → langsameres Tempo oder Zusatzlast.'
  },
  toesToBar: {
    name:'Toes-to-Bar', cat:'Core', visual:'kneeRaise',
    cues:['Pendeln zuerst vollständig stoppen.','Lat aktiv halten und Becken am Ende einrollen.','Kontrolliert absenken statt zurückzuschwingen.'],
    mistakes:['Aus Kipping und Schwung arbeiten.','Nur die Beine werfen, ohne Beckenkontrolle.'],
    progress:'Mehrere saubere Sätze → kontrolliertes Volumen statt mehr Schwung.'
  },
  pseudoPlanchePushup: {
    name:'Pseudo-Planche Push-ups', cat:'Push', visual:'pushup',
    cues:['Schultern deutlich vor die Hände bringen.','Rumpf und Gesäß fest halten.','Leaning nur so weit steigern, wie Handgelenke stabil bleiben.'],
    mistakes:['Hüfte absinken lassen.','Vorverlagerung mit verkürzter ROM kompensieren.'],
    progress:'3×8–10 sauber → Lean schrittweise vergrößern.'
  }
});

Object.assign(EX, {
 inclinePushup:{name:'Erhöhte Push-ups',cat:'Push',visual:'inclinePushup',cues:['Hände auf eine stabile Bank stellen.','Körper gerade halten und Brust kontrolliert zur Kante senken.'],mistakes:['Instabile Auflage.','Hüfte absinken lassen.'],progress:'3×12 sauber → niedrigere Auflage.'},
 gluteBridge:{name:'Glute Bridge',cat:'Beine',visual:'gluteBridge',cues:['Rückenlage, Knie beugen, Füße hüftbreit aufstellen.','Hüfte anheben, bis Schulter, Hüfte und Knie eine Linie bilden.'],mistakes:['Ins Hohlkreuz drücken.'],progress:'3×15 kontrolliert → oben länger halten.'},
 squat:{name:'Kniebeugen',cat:'Beine',visual:'squat',cues:['Füße etwa schulterbreit, Knie folgen den Fußspitzen.','So tief gehen, wie Fersen und Rumpf stabil bleiben.'],mistakes:['Fersen heben.','Knie nach innen fallen lassen.'],progress:'3×15 sauber → Split Squat.'}
});
const VISUAL_ASSETS = {'warmup': 'assets/exercises/warmup.webp', 'handstand': 'assets/exercises/handstand.webp', 'pullup': 'assets/exercises/pullup.webp', 'pullupBand': 'assets/exercises/pullupBand.webp', 'dip': 'assets/exercises/dip.webp', 'row': 'assets/exercises/row.webp', 'split': 'assets/exercises/split.webp', 'pike': 'assets/exercises/pike.webp', 'pistol': 'assets/exercises/pistol.webp', 'kneeRaise': 'assets/exercises/kneeRaise.webp', 'hang': 'assets/exercises/hang.webp', 'pushup': 'assets/exercises/pushup.webp', 'bandRow': 'assets/exercises/bandRow.webp', 'facePull': 'assets/exercises/facePull.webp', 'sidePlank': 'assets/exercises/sidePlank.webp', 'hollow': 'assets/exercises/hollow.webp', 'circles': 'assets/exercises/circles.webp', 'wrists': 'assets/exercises/wrists.webp', 'pullapart': 'assets/exercises/pullapart.webp', 'external': 'assets/exercises/external.webp', 'scapPull': 'assets/exercises/scapPull.webp', 'scapPush': 'assets/exercises/scapPush.webp'};

Object.assign(VISUAL_ASSETS, {'elevatedPike': 'assets/exercises/elevatedPike.png', 'wallHspu': 'assets/exercises/wallHspu.png', 'hangingLegRaise': 'assets/exercises/hangingLegRaise.png', 'towelHang': 'assets/exercises/towelHang.png', 'declinePushup': 'assets/exercises/declinePushup.png', 'feetElevatedRow': 'assets/exercises/feetElevatedRow.png', 'pistolSquat': 'assets/exercises/pistolSquat.png', 'toesToBar': 'assets/exercises/toesToBar.png', 'pseudoPlanchePushup': 'assets/exercises/pseudoPlanchePushup.png', 'inclinePushup': 'assets/exercises/inclinePushup.png', 'gluteBridge': 'assets/exercises/gluteBridge.png', 'squat': 'assets/exercises/squat.png'});
EX['elevatedPike'].visual='elevatedPike';
EX['wallHspu'].visual='wallHspu';
EX['hangingLegRaise'].visual='hangingLegRaise';
EX['towelHang'].visual='towelHang';
EX['declinePushup'].visual='declinePushup';
EX['feetElevatedRow'].visual='feetElevatedRow';
EX['pistolSquat'].visual='pistolSquat';
EX['toesToBar'].visual='toesToBar';
EX['pseudoPlanchePushup'].visual='pseudoPlanchePushup';
EX['inclinePushup'].visual='inclinePushup';
EX['gluteBridge'].visual='gluteBridge';
EX['squat'].visual='squat';
EX.wallHspuNegative.visual='wallHspu'; EX.wallHspuPartial.visual='wallHspu';
VISUAL_ASSETS.assistedDips='assets/exercises/assistedDips.png';EX.assistedDips.visual='assistedDips';

function visualHTML(kind, compact = false, alt = '') {
  const src = VISUAL_ASSETS[kind] || VISUAL_ASSETS.warmup;
  const cls = compact ? 'exercise-photo compact' : 'exercise-photo';
  const safeAlt = escapeHTML(alt || 'Übungsbild');
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
  const hasBands = Array.isArray(state.profile?.bands) && state.profile.bands.length > 0;
  const dipBeginner = maxStrength('dips') < 3;
  const pullAssistA = hasBands ? { id: 'bandPullA', sets: 4, min: 4, max: 6, unit: 'reps', rest: 180, loadType: 'band' } : { id:'negativePull', sets:4, min:3, max:5, unit:'reps', rest:150, suffix:'3–5 s absenken' };
  const pullAssistB = hasBands ? { id: 'bandPullB', sets: 4, min: 5, max: 8, unit: 'reps', rest: 150, loadType: 'band' } : { id:'negativePull', sets:4, min:3, max:5, unit:'reps', rest:150, suffix:'3–5 s absenken' };
  const dipA = dipBeginner ? {id:'assistedDips',sets:3,min:5,max:8,unit:'reps',rest:150} : {id:'dips',sets:3,min:6,max:9,unit:'reps',rest:150};
  const dipB = dipBeginner ? {id:'assistedDips',sets:3,min:5,max:8,unit:'reps',rest:150} : {id:'dips',sets:3,min:6,max:10,unit:'reps',rest:150};
  const common = {
    A: {
      label: 'Montag · Park A', short: 'Mo', duration: '45–60 Min.', focus: 'Pull + Push + Handstand',
      items: [
        { id: 'warmup', special: 'warmup' },
        { id: 'handstand', special: 'handstand', minutes: 8 },
        { id: 'pullup', sets: 1, min: 1, max: 2, unit: 'reps', rest: 180 },
        pullAssistA,
        dipA,
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
        pullAssistB,
        dipB,
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
  const custom = state.customPlans?.[key];
  if (custom?.items?.length) return clone(custom);
  const template=clone(common[key] || common.A);
  if (key==='C') template.items.unshift({id:'warmup',special:'warmup'});
  if (maxStrength('pullups')<1) template.items=template.items.filter(i=>i.id!=='pullup');
  if (maxStrength('pushups')<5) template.items=template.items.map(i=>i.id==='pushupHard'?{...i,id:'inclinePushup',min:6,max:10}:i);
  if (!hasBands && key==='C') template.items=template.items.filter(i=>!['bandRow','facePull'].includes(i.id));
  if(key==='C') template.items.push(planItemFromId('gluteBridge'));
  return template;
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

function activeSessionLooksComplete(a = state.activeSession) {
  if (!a?.key) return false;
  const wt = a.template || workoutTemplate(a.key, a.date || localDateKey());
  return wt.items.every(item => {
    const log = a.logs?.[item.id];
    if (item.special) return !!log?.done;
    return (log?.sets?.length || 0) >= (item.sets || 0);
  });
}

function clearStaleActiveSession() {
  const a = state.activeSession;
  if (!a) return false;
  const completedTwin = sessions().some(s =>
    s.key === a.key && s.date === a.date && a.startedAt && s.startedAt && s.startedAt === a.startedAt
  );
  // Alte Versionen konnten eine bereits gespeicherte Einheit zusätzlich als "offen" liegen lassen.
  if (completedTwin) {
    delete state.activeSession;
    if (guided && guided.key === a.key && guided.date === a.date) guided = null;
    persistState();
    return true;
  }
  return false;
}

function discardActiveSession({ ask = true } = {}) {
  const a = state.activeSession;
  if (!a) return true;
  const wt = a.template || workoutTemplate(a.key, a.date || localDateKey());
  if (ask && !confirm(`Offene Einheit „${escapeHTML(wt.label)}“ wirklich verwerfen? Bereits eingetragene, aber noch nicht abgeschlossene Sätze dieser offenen Einheit werden gelöscht.`)) return false;
  delete state.activeSession;
  if (guided && guided.key === a.key && guided.date === a.date) guided = null;
  persistState();
  return true;
}


function previousExerciseLog(exerciseId, workoutKey = null) {
  const all = sessions().slice().sort((a,b) => {
    const ak = `${a.date}-${a.finishedAt || ''}-${a.id || 0}`;
    const bk = `${b.date}-${b.finishedAt || ''}-${b.id || 0}`;
    return bk.localeCompare(ak);
  });
  const sameWorkout = workoutKey ? all.find(s => s.key === workoutKey && s.logs?.[exerciseId]?.sets?.length) : null;
  const found = sameWorkout || all.find(s => s.logs?.[exerciseId]?.sets?.length);
  return found ? { session: found, log: found.logs[exerciseId] } : null;
}

function setDisplay(set, item) {
  if (!set) return '–';
  let txt = `${set.value}${item?.unit === 's' ? ' s' : ' Wdh.'}`;
  if (set.load != null) {
    if (item?.loadType === 'band') txt += set.load === 0 ? ' · ohne Band' : ` · ${set.load} kg Hilfe`;
    else txt += ` · ${set.load} kg`;
  }
  if (set.rir != null) txt += ` · RIR ${set.rir}`;
  return txt;
}

function compareSet(current, previous, item) {
  if (!current || !previous) return { cls:'', text:'neu' };
  let score = (+current.value || 0) - (+previous.value || 0);
  let text = score > 0 ? `▲ +${fmt(score,0)}` : score < 0 ? `▼ ${fmt(score,0)}` : '= gleich';
  let cls = score > 0 ? 'better' : score < 0 ? 'worse' : 'same';
  if (item?.loadType === 'band' && current.load != null && previous.load != null) {
    if (+current.load < +previous.load) { cls='better'; text='▲ weniger Hilfe'; }
    else if (+current.load > +previous.load) { cls='worse'; text='▼ mehr Hilfe'; }
    else if (score === 0) { cls='same'; text='= gleich'; }
  } else if (item?.loadType === 'resistance' && current.load != null && previous.load != null) {
    if (+current.load > +previous.load && +current.value >= +previous.value) { cls='better'; text='▲ schwerer'; }
    else if (+current.load < +previous.load) { cls='worse'; text='▼ leichter'; }
  }
  return { cls, text };
}

function renderLastTimeBox(item) {
  if (item.special) return '';
  const prev = previousExerciseLog(item.id, guided?.key);
  if (!prev) return `<div class="last-time-box empty"><span>Letztes Mal</span><b>Noch kein Vergleich</b><small>Ab dem nächsten Training siehst du hier deine alten Werte.</small></div>`;
  const sets = prev.log.sets || [];
  return `<div class="last-time-box"><div class="last-time-head"><span>Letztes Mal · ${deDate(prev.session.date)}</span><b>${escapeHTML((prev.session.template || workoutTemplate(prev.session.key, prev.session.date)).label)}</b></div><div class="last-time-sets">${sets.map((s,i)=>`<span><small>S${i+1}</small><b>${setDisplay(s,item)}</b></span>`).join('')}</div></div>`;
}

function adaptiveExerciseGuidance(item, workoutKey = guided?.key) {
  if (!item || item.special) return '';
  const prev = previousExerciseLog(item.id, workoutKey);
  if (!prev?.log?.sets?.length) return `Startwert: ${targetText(item)} · sauber mit 1–2 RIR einordnen.`;
  const sets = prev.log.sets;
  const values = sets.map(x=>+x.value||0);
  const completed = sets.length >= (+item.sets||sets.length);
  const total = values.reduce((a,b)=>a+b,0);
  const upperHit = completed && values.slice(0,item.sets).every(v=>v>=(+item.max||0));
  const belowMin = values.filter(v=>v<(+item.min||0)).length;
  const avgRir = avg(sets.map(x=>x.rir).filter(x=>x!=null).map(Number));

  if (item.loadType === 'band') {
    const loads=sets.map(x=>+x.load||0), assist=loads.length?Math.round(avg(loads)):null;
    if (upperHit && (avgRir==null || avgRir>=1)) {
      const steps=[30,20,10,0], current=assist==null?bandRecommendation().band:assist;
      const next=steps.find(x=>x<current);
      if(next!=null) return `Heute: ${next===0?'ohne Band':next+' kg Hilfe'} testen und zunächst ${item.min}–${Math.min(item.max,item.min+1)} saubere Wdh. anpeilen.`;
    }
    return `Heute: gleiche Hilfe beibehalten und insgesamt etwa ${Math.min(item.sets*item.max,total+1)} Wdh. anpeilen – ohne Technikverlust.`;
  }
  if (item.loadType === 'resistance') {
    const loads=sets.map(x=>+x.load||0).filter(Boolean), load=loads.length?Math.round(avg(loads)):null;
    if (upperHit && (avgRir==null || avgRir>=1)) return `Obergrenze erreicht. Nächstes Mal etwas mehr Widerstand testen; heute sauber im oberen Bereich bleiben.`;
    return `Heute: ${load?load+' kg Band · ':''}insgesamt etwa ${Math.min(item.sets*item.max,total+1)} Wdh. anpeilen.`;
  }
  if (item.unit === 's') {
    if (upperHit) return `Obergrenze erreicht. Progression prüfen; bis dahin die Haltezeit sauber bestätigen.`;
    return `Heute: insgesamt etwa ${Math.min(item.sets*item.max,total+5)} s anpeilen, ohne Position zu verlieren.`;
  }
  if (upperHit && (avgRir==null || avgRir>=1)) return `Obergrenze erreicht. Diese Übung ist bereit für die nächste Progressionsstufe.`;
  if (belowMin>=Math.ceil(values.length/2)) return `Heute nicht erzwingen: ${item.min}–${Math.min(item.max,item.min+1)} Wdh. pro Satz sauber stabilisieren.`;
  return `Coach-Ziel: insgesamt etwa ${Math.min(item.sets*item.max,total+1)} Wdh. – zuerst den schwächsten Satz um 1 Wdh. verbessern.`;
}

function showPerformanceToast(item, entry, setIndex) {
  const prev=previousExerciseLog(item.id,guided?.key); const previous=prev?.log?.sets?.[setIndex];
  const cmp=compareSet(entry,previous,item);
  document.getElementById('performanceToast')?.remove();
  const el=document.createElement('div'); el.id='performanceToast'; el.className=`performance-toast ${cmp.cls}`;
  el.innerHTML=previous?`<b>${cmp.text}</b><span>vs. letztes Mal · Satz ${setIndex+1}</span>`:`<b>Erster Vergleichswert gespeichert</b><span>Beim nächsten Training wird er hier verglichen.</span>`;
  document.body.appendChild(el); setTimeout(()=>el.classList.add('show'),20); setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),220)},1800);
}

function openSetEditor(exerciseId, setIndex) {
  if (!guided) return;
  const item = guided.template.items.find(x => x.id === exerciseId);
  const set = guided.logs?.[exerciseId]?.sets?.[setIndex];
  if (!item || !set) return;
  document.getElementById('setEditOverlay')?.remove();
  const loadField = item.loadType === 'band'
    ? `<label>Band-Hilfe<select id="editSetLoad"><option value="30" ${+set.load===30?'selected':''}>30 kg Hilfe</option><option value="20" ${+set.load===20?'selected':''}>20 kg Hilfe</option><option value="10" ${+set.load===10?'selected':''}>10 kg Hilfe</option><option value="0" ${+set.load===0?'selected':''}>ohne Band</option></select></label>`
    : item.loadType === 'resistance'
      ? `<label>Widerstand<select id="editSetLoad"><option value="10" ${+set.load===10?'selected':''}>10 kg</option><option value="20" ${+set.load===20?'selected':''}>20 kg</option><option value="30" ${+set.load===30?'selected':''}>30 kg</option></select></label>` : '';
  const rirField = item.unit === 'reps' ? `<label>RIR<select id="editSetRir"><option value="3" ${+set.rir===3?'selected':''}>3</option><option value="2" ${+set.rir===2?'selected':''}>2</option><option value="1" ${+set.rir===1?'selected':''}>1</option><option value="0" ${+set.rir===0?'selected':''}>0</option></select></label>` : '';
  const overlay = document.createElement('div');
  overlay.id='setEditOverlay'; overlay.className='set-edit-overlay';
  overlay.innerHTML=`<div class="set-edit-card"><div class="card-head"><div><div class="eyebrow">Eintrag bearbeiten</div><h3>${EX[exerciseId]?.name || exerciseId} · Satz ${setIndex+1}</h3></div><button id="closeSetEditor" class="small-btn" type="button">×</button></div><div class="set-edit-grid"><label>${item.unit==='s'?'Sekunden':'Wiederholungen'}<input id="editSetValue" type="number" min="0" step="1" inputmode="numeric" value="${set.value}"></label>${loadField}${rirField}</div><div class="set-edit-actions"><button id="deleteSetEntry" class="danger-btn" type="button">Satz löschen</button><button id="saveSetEdit" class="primary" type="button">Änderung speichern</button></div></div>`;
  document.body.appendChild(overlay);
  document.getElementById('closeSetEditor').onclick=()=>overlay.remove();
  document.getElementById('saveSetEdit').onclick=()=>{
    const value=+document.getElementById('editSetValue').value; if(!Number.isFinite(value)||value<=0)return;
    set.value=value;
    if(['band','resistance'].includes(item.loadType)) set.load=+document.getElementById('editSetLoad').value;
    if(item.unit==='reps') set.rir=+document.getElementById('editSetRir').value;
    guided.setIndex=(guided.logs[exerciseId].sets||[]).length; persistActive(); overlay.remove(); renderGuided();
  };
  document.getElementById('deleteSetEntry').onclick=()=>{
    if(!confirm(`Satz ${setIndex+1} wirklich löschen?`))return;
    guided.logs[exerciseId].sets.splice(setIndex,1);
    guided.setIndex=guided.logs[exerciseId].sets.length; persistActive(); overlay.remove(); renderGuided();
  };
}

function renderTrainingHistory() {
  const root=document.getElementById('trainingHistory'); const count=document.getElementById('trainingHistoryCount');
  if(!root||!count)return;
  const list=sessions().slice().sort((a,b)=>`${b.date}-${b.finishedAt||''}-${b.id||0}`.localeCompare(`${a.date}-${a.finishedAt||''}-${a.id||0}`)).slice(0,20);
  count.textContent=String(list.length);
  if(!list.length){root.innerHTML='<p class="muted">Noch kein abgeschlossenes Training. Deine erste Einheit erscheint danach automatisch hier.</p>';return;}
  root.innerHTML=list.map(s=>{
    const wt=s.template || workoutTemplate(s.key,s.date), entries=wt.items.filter(item=>s.logs?.[item.id]);
    const ai=cachedWorkoutAI(s), aiDomId=`historyAi-${workoutAIKey(s).replace(/[^a-zA-Z0-9_-]/g,'-')}`;
    return `<details class="history-session"><summary><span><b>${deDateLong(s.date)}</b><small>${escapeHTML(wt.label)}${s.startedAt?` · ${s.startedAt}`:''}</small></span><span class="history-chevron">›</span></summary><div class="history-exercises">${entries.map(item=>{const log=s.logs[item.id]; if(item.special)return `<div class="history-exercise"><b>${EX[item.id].name}</b><span>erledigt ✓</span></div>`; return `<div class="history-exercise"><b>${EX[item.id].name}</b><div class="history-set-list">${(log.sets||[]).map((set,i)=>`<span>S${i+1}: ${setDisplay(set,item)}</span>`).join('')}</div></div>`}).join('')}</div>
      <div id="${aiDomId}" class="history-ai">${ai?aiTextHTML(ai):(hasGeminiKey()?'Noch keine KI-Auswertung für diese Einheit.':'Gemini-Key fehlt – Verlauf und Satzwerte bleiben trotzdem vollständig verfügbar.')}</div>
      <div class="history-ai-actions"><button class="small-btn" data-ai-workout="${s.id||''}" data-ai-date="${s.date}" data-ai-key="${s.key}" data-ai-target="${aiDomId}" type="button" ${hasGeminiKey()?'':'disabled'}>${ai?'KI-Auswertung aktualisieren':'KI-Auswertung'}</button></div>
      <div class="history-actions"><button class="small-btn danger" data-delete-workout="${s.id||''}" data-delete-date="${s.date}" data-delete-key="${s.key}" type="button">Training löschen</button></div></details>`;
  }).join('');
  root.querySelectorAll('[data-ai-workout]').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    const session=list.find(x=>String(x.id||'')===String(btn.dataset.aiWorkout)&&x.date===btn.dataset.aiDate&&x.key===btn.dataset.aiKey) || list.find(x=>x.date===btn.dataset.aiDate&&x.key===btn.dataset.aiKey);
    if(session)runWorkoutAI(session,btn.dataset.aiTarget,{force:true});
  });
  root.querySelectorAll('[data-delete-workout]').forEach(btn=>btn.onclick=e=>{
    e.preventDefault(); e.stopPropagation(); if(!confirm('Dieses absolvierte Training wirklich löschen?'))return;
    const date=btn.dataset.deleteDate,id=btn.dataset.deleteWorkout,key=btn.dataset.deleteKey; const val=state.workouts[date];
    if(Array.isArray(val)){const next=val.filter(x=>String(x.id||'')!==String(id)); if(next.length)state.workouts[date]=next;else delete state.workouts[date];}
    else if(!id||String(val?.id||'')===String(id)) delete state.workouts[date];
    const deletedSession=list.find(x=>String(x.id||'')===String(id)&&x.date===date&&x.key===key);
    if(deletedSession) delete state.ai?.workouts?.[workoutAIKey(deletedSession)];
    // Alte/offene Kopie derselben Einheit ebenfalls bereinigen. Andere Trainings werden grundsätzlich nicht mehr gesperrt.
    if(state.activeSession && state.activeSession.key===key && (state.activeSession.date===date || activeSessionLooksComplete(state.activeSession))){
      delete state.activeSession;
      if(guided && guided.key===key) guided=null;
    }
    saveState(); renderWorkoutTabs(); renderTrainingHistory(); renderTrainingOverview(); renderDashboard();
  });
}

function planForDate(key = localDateKey()) {
  const d = parseDateKey(key); const dow = d.getDay();
  if ((dow===0 || dow===6) && +state.profile.trainingDays===2) return {type:'recovery',title:'Regeneration',duration:'Zwei Krafttage pro Woche'};
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
  return [...state.strengthTests].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || {date:localDateKey(),pullups:0,dips:0,pushups:0,handstand:0,hang:0,hspu:0};
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
  if (!found) {
    const avail=[...(state.profile?.bands||[])].sort((a,b)=>a-b);
    const base=maxStrength('pullups');
    const band = !avail.length ? 0 : (base<=0 ? avail.at(-1) : base<=2 ? (avail.includes(10)?10:avail[0]) : avail[0]);
    return { band, text: !avail.length ? 'Keine Bänder hinterlegt → Negative Pull-ups als Assistenz nutzen.' : `Start: ${band}-kg-Band. Nimm nur so viel Hilfe wie nötig.` };
  }
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
  const ready = typeof progressionRecommendationsDetailed === 'function' ? progressionRecommendationsDetailed() : [];
  if (ready.length) {
    return ready.slice(0,3).map(r=>({
      title:`${EX[r.from]?.name||r.from} → ${EX[r.to]?.name||r.to}`,
      text:`Bereit: ${r.reason} Im Training kannst du den Vorschlag mit einem Tipp übernehmen.`
    }));
  }
  const band = bandRecommendation();
  const pikeHit = bestExerciseAchievement('pike', 4, 6);
  return [
    { title: 'Pull-ups', text: `${band.text} Nächstes Kraftziel: ${Math.max(4,maxStrength('pullups')+1)} saubere Wiederholungen.` },
    { title: 'HSPU-Pfad', text: pikeHit ? 'Pike-Ziel erreicht. Elevated Pike ist als nächste Stufe bereit.' : 'Pike Push-ups sauber auf 4×6 bringen; dann Füße erhöhen.' },
    { title: 'Core & Griff', text: `Knee Raises Richtung 3×10 ohne Schwung. Dead Hang aktuell bis ${Math.max(maxStrength('hang'),bestLoggedValue('deadHang')||0)} s; ab 60 s wird Towel Hang sinnvoll.` }
  ];
}

function targetText(item) {
  if (item.special === 'warmup') return 'ca. 5 Min.';
  if (item.special === 'handstand') return item.range || `${item.minutes} Min.`;
  const unit = item.unit === 's' ? 's' : 'Wdh.';
  return `${item.sets}×${item.min}–${item.max} ${unit}${item.suffix ? ` · ${item.suffix}` : ''}`;
}

function renderWarmupSteps() {
  const steps=WARMUP_STEPS.filter(([, ,kind])=>state.profile.bands?.length || !['pullapart','external'].includes(kind));
  return `<div class="warmup-list">${steps.map(([name, target, kind]) => `<div class="warmup-step">${visualHTML(kind, true, name)}<div><b>${name}</b><small>${target}</small></div></div>`).join('')}</div>`;
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
  const greeting = document.getElementById('todayGreeting');
  if (greeting) greeting.textContent = state.profile?.name ? `Hi, ${state.profile.name}` : 'Dein Tag';
  document.getElementById('heroWeight').textContent = fmt(currentW);
  document.getElementById('heroPullups').textContent = maxStrength('pullups');
  document.getElementById('heroHs').textContent = maxStrength('handstand');
  document.getElementById('heroWeek').textContent = weekSessions(today).filter(s => ['A','B','C'].includes(s.key)).length;
  document.getElementById('todayDateLabel').textContent = deDateLong(today);

  const mode = document.getElementById('coachMode');
  mode.textContent = rec.mode === 'CHECK' ? 'CHECK' : rec.mode;
  mode.className = `mode-badge ${['LIGHT','REDUCED'].includes(rec.mode) ? 'light' : rec.mode === 'STOP' ? 'stop' : ''}`;
  document.getElementById('dailyScore').textContent = rec.score == null ? '–' : rec.score;
  const dailyCard = document.querySelector('.daily-check-card');
  const checkDone = dailyCheckComplete(today);
  dailyCard?.classList.toggle('is-complete', checkDone);
  const checkBtn = document.getElementById('guidedCheckBtn');
  if (checkBtn) checkBtn.textContent = checkDone ? 'Check aktualisieren' : 'Check starten';

  let coachTitle = plan.title, coachText = rec.text, bullets = [], canTrain = true;
  if (plan.type === 'workout') {
    const wt = workoutTemplate(plan.workout, today);
    bullets.push(`<span class="coach-bullet"><b>1</b><span>${escapeHTML(wt.focus)} · ${escapeHTML(wt.duration)}</span></span>`);
    if (plan.workout === 'B' && EX[wt.legChoice]) bullets.push(`<span class="coach-bullet"><b>2</b><span>Beine diese Woche: ${EX[wt.legChoice].name}</span></span>`);
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
    coachTitle=`Offenes Training · ${escapeHTML(wt.label)}`;
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
      preview.innerHTML = `<div class="preview-item"><span class="num">▶</span><div><b>Fortsetzen: ${EX[nextItem.id].name}</b><small>${escapeHTML(activeWt.label)} · Satz ${(state.activeSession.setIndex || 0) + 1} · ${targetText(nextItem)}</small></div></div>`;
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
  if (root) root.innerHTML = '';
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
  const limits={dWeight:[20,400],dSleep:[0,24],dWater:[0,20],dSteps:[0,100000],dElbow:[0,10],dShoulder:[0,10],dEnergy:[1,5]};
  if(Object.entries(limits).some(([id,[min,max]])=>get(id)!==''&&(!Number.isFinite(+get(id))||+get(id)<min||+get(id)>max))){document.getElementById('dailyMsg').textContent='Bitte prüfe die eingegebenen Werte.';return;}
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
  clearStaleActiveSession();
  const root = document.getElementById('workoutTabs');
  const activeKey = state.activeSession?.key || null;
  root.innerHTML = allWorkoutKeys().map(k => {
    const isOpen = activeKey === k;
    return `<button type="button" data-workout-tab="${k}" class="${selectedWorkout === k ? 'active' : ''}">${escapeHTML(workoutTemplate(k).label)}${isOpen ? ' · offen' : ''}</button>`;
  }).join('');
  root.querySelectorAll('[data-workout-tab]').forEach(btn => btn.onclick = () => {
    selectedWorkout = btn.dataset.workoutTab;
    manualWorkoutMode = true;
    if (state.activeSession?.key === selectedWorkout) restoreActiveSession();
    else guided = null;
    renderWorkoutTabs();
    renderTrainingOverview();
  });
}

function renderTrainingOverview() {
  const root = document.getElementById('trainingOverview'); const coach = document.getElementById('guidedCoach');
  if (guided) {
    // Eine gespeicherte/offene Session darf die globale Navigation auf Heute nicht verstecken.
    // Fokusmodus gilt nur, wenn der Training-Tab tatsächlich sichtbar ist.
    const trainViewActive = document.getElementById('train')?.classList.contains('active');
    document.body.classList.toggle('workout-mode', !!trainViewActive);
    root.classList.add('hidden'); coach.classList.remove('hidden'); renderGuided(); return;
  }
  document.body.classList.remove('workout-mode');
  root.classList.remove('hidden'); coach.classList.add('hidden');
  const dayPlan = planForDate();
  if (dayPlan.type !== 'workout' && !manualWorkoutMode) {
    root.innerHTML = `<article class="card"><div class="workout-header"><div><div class="eyebrow">Heute</div><h2>${dayPlan.title}</h2></div><span class="mode-badge subtle">RECOVERY</span></div><p class="coach-tip">${dayPlan.type === 'skill' ? 'Heute ist nur ein kurzer Handstand-Block vorgesehen.' : 'Heute ist Regeneration eingeplant. Kein Pflicht-Workout.'}</p><button class="secondary full" type="button" data-open-other>Trainingsplan öffnen</button></article>`;
    root.querySelector('[data-open-other]')?.addEventListener('click',()=>document.getElementById('trainingPlanManager')?.scrollIntoView({behavior:'smooth',block:'start'}));
    return;
  }
  const wt = workoutTemplate(selectedWorkout, localDateKey()), rec = recoveryDecision();
  const activeForThisWorkout = state.activeSession && state.activeSession.key === selectedWorkout;
  const otherActive = state.activeSession && state.activeSession.key !== selectedWorkout;
  const alreadyDone = workoutDoneDate(localDateKey(), selectedWorkout) && !activeForThisWorkout;
  const blockStart = ((['CHECK','STOP'].includes(rec.mode) && !activeForThisWorkout) || alreadyDone);
  const btnText = alreadyDone ? 'Heute schon erledigt ✓' : (activeForThisWorkout ? 'Training fortsetzen' : (rec.mode === 'CHECK' ? 'Erst Tagescheck ausfüllen' : rec.mode === 'STOP' ? 'Heute nicht starten' : (otherActive ? `${escapeHTML(wt.label)} stattdessen starten` : 'Training starten')));
  const heroItem = wt.items.find(x=>!x.special) || wt.items[0];
  const heroEx = EX[heroItem.id];
  const openInfo = otherActive ? (() => {
    const openWt = workoutTemplate(state.activeSession.key, state.activeSession.date || localDateKey());
    const openItem = openWt.items[state.activeSession.itemIndex || 0] || openWt.items[0];
    return `<div class="open-session-card"><div><span>Offene Einheit</span><b>${escapeHTML(openWt.label)}</b><small>${EX[openItem.id]?.name || 'Training'} · Satz ${(state.activeSession.setIndex || 0) + 1}</small></div><div class="action-row"><button id="resumeOpenWorkout" class="secondary" type="button">Fortsetzen</button><button id="discardOpenWorkout" class="ghost-btn" type="button">Verwerfen</button></div></div>`;
  })() : '';
  const exerciseRows = wt.items.map((item,i)=>{
    const ex=EX[item.id];
    return `<div class="training-plan-row"><span class="training-plan-num">${i+1}</span>${visualHTML(ex.visual,true,ex.name)}<div><b>${ex.name}</b><small>${targetText(item)}</small></div></div>`;
  }).join('');
  root.innerHTML = `<article class="card training-start-card">
      <div class="training-cover">${visualHTML(heroEx.visual,false,heroEx.name)}<span class="training-cover-shade"></span><div class="training-cover-copy"><div class="eyebrow">${escapeHTML(wt.focus)}</div><h2>${escapeHTML(wt.label)}</h2><p>${escapeHTML(wt.duration)}</p></div><span class="mode-badge training-cover-badge ${['LIGHT','REDUCED'].includes(rec.mode)?'light':rec.mode==='STOP'?'stop':''}">${rec.mode}</span></div>
      ${openInfo}
      <p class="coach-tip">${alreadyDone ? 'Diese Einheit ist heute bereits gespeichert.' : (activeForThisWorkout ? `<b>Weiter bei:</b> ${EX[wt.items[state.activeSession.itemIndex]?.id || wt.items[0].id].name} · Satz ${(state.activeSession.setIndex || 0) + 1}.` : rec.text)}${selectedWorkout === 'B' && EX[wt.legChoice] ? ` Beine: <b>${EX[wt.legChoice].name}</b>.` : ''}</p>
      <button id="startWorkoutBtn" class="primary full" type="button" ${blockStart ? 'disabled' : ''}>${btnText}</button>
      ${activeForThisWorkout ? '<button id="discardCurrentWorkout" class="text-action danger-text full secondary-line" type="button">Offene Einheit verwerfen & neu starten</button>' : ''}
      <details class="workout-details"><summary>Übungen ansehen</summary><div class="training-plan-list">${exerciseRows}</div></details>
    </article>`;
  document.getElementById('resumeOpenWorkout')?.addEventListener('click', () => {
    selectedWorkout = state.activeSession.key; restoreActiveSession(); renderWorkoutTabs(); renderTrainingOverview();
  });
  document.getElementById('discardOpenWorkout')?.addEventListener('click', () => {
    if (!discardActiveSession()) return; renderWorkoutTabs(); renderTrainingOverview(); renderDashboard();
  });
  document.getElementById('discardCurrentWorkout')?.addEventListener('click', () => {
    if (!discardActiveSession()) return; startGuided(selectedWorkout); renderWorkoutTabs();
  });
  document.getElementById('startWorkoutBtn').onclick = () => {
    if (activeForThisWorkout) { restoreActiveSession(); renderTrainingOverview(); return; }
    if (alreadyDone) return;
    if (otherActive) {
      const openWt = workoutTemplate(state.activeSession.key, state.activeSession.date || localDateKey());
      if (!confirm(`Es ist noch „${escapeHTML(openWt.label)}“ offen. Diese offene Einheit verwerfen und „${escapeHTML(wt.label)}“ starten?`)) return;
      discardActiveSession({ ask:false });
    }
    startGuided(selectedWorkout);
    renderWorkoutTabs();
  };
}

function startGuided(key) {
  if (recoveryDecision().mode === 'STOP') { alert(recoveryDecision().text); return; }
  if (state.activeSession) {
    restoreActiveSession();
    renderTrainingOverview();
    return;
  }
  const rec = recoveryDecision();
  if (['CHECK','STOP'].includes(rec.mode)) return;
  const sessionPlan=workoutTemplate(key,localDateKey());
  if(['LIGHT','REDUCED'].includes(rec.mode))sessionPlan.items=sessionPlan.items.map(i=>i.special?i:{...i,sets:Math.max(1,i.sets-(rec.mode==='REDUCED'?2:1))});
  guided = {
    key, date: localDateKey(), template: sessionPlan, itemIndex: 0, setIndex: 0,
    logs: {}, aiFeedback: {}, startedAt: new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }), completed: false
  };
  state.activeSession = { template: clone(guided.template), key, date: guided.date, itemIndex: 0, setIndex: 0, logs: {}, aiFeedback: {}, startedAt: guided.startedAt };
  saveState(false);
  renderTrainingOverview();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderGuided() {
  const root = document.getElementById('guidedCoach');
  const wt = guided.template;
  if (guided.completed) {
    const completedSession = guided.completedSession || sessions().find(x=>String(x.id)===String(guided.completedSessionId));
    const cachedSummary = cachedWorkoutAI(completedSession);
    root.innerHTML = `<div class="guided-shell"><article class="card done-screen"><div class="big-check">✓</div><div class="eyebrow">Training gespeichert</div><h2>${escapeHTML(wt.label)} erledigt</h2><p class="muted">Die komplette Einheit findest du jetzt unter „Vergangene Trainings“.</p>
      <div class="context-ai-inline"><div class="ai-mini-head"><span>Gemini · Trainingsauswertung</span><small>${hasGeminiKey()?'bereit':'optional'}</small></div><p id="completedAiSummaryText">${cachedSummary?aiTextHTML(cachedSummary):(hasGeminiKey()?'Gemini kann die Einheit jetzt mit deinem letzten gleichen Training vergleichen.':'Unter Mehr → Einstellungen einen Gemini-Key hinterlegen, um die Einheit hier auswerten zu lassen.')}</p><button id="completedAiSummaryBtn" class="secondary full" type="button" ${hasGeminiKey()?'':'disabled'}>${cachedSummary?'KI-Auswertung aktualisieren':'KI-Auswertung erstellen'}</button></div>
      <div class="action-row"><button id="viewCompletedWorkout" class="secondary" type="button">Training ansehen</button><button id="finishCoachBtn" class="primary" type="button">Zur Startseite</button></div></article></div>`;
    document.getElementById('completedAiSummaryBtn')?.addEventListener('click',()=>runWorkoutAI(completedSession,'completedAiSummaryText',{force:true}));
    if(completedSession && hasGeminiKey() && state.settings.aiAutoTraining!==false && !cachedSummary) setTimeout(()=>runWorkoutAI(completedSession,'completedAiSummaryText'),0);
    document.getElementById('finishCoachBtn').onclick = () => { document.body.classList.remove('workout-mode'); guided = null; selectedWorkout = wt.short === 'Mo' ? 'A' : selectedWorkout; switchView('today'); renderTrainingOverview(); };
    document.getElementById('viewCompletedWorkout').onclick = () => { document.body.classList.remove('workout-mode'); guided=null; renderTrainingOverview(); renderTrainingHistory(); setTimeout(()=>document.getElementById('trainingHistoryCard')?.scrollIntoView({behavior:'smooth'}),80); };
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
    const prev = previousExerciseLog(item.id, guided.key);
    const completedSets=currentLog.sets.length;
    const exerciseComplete=completedSets>=item.sets;
    const setNo=Math.min(completedSets+1,item.sets);
    const bandRec = bandRecommendation().band;
    const loadField = item.loadType === 'band'
      ? `<label>Band-Hilfe<select id="setLoad"><option value="30" ${bandRec===30?'selected':''}>30 kg Hilfe</option><option value="20" ${bandRec===20?'selected':''}>20 kg Hilfe</option><option value="10" ${bandRec===10?'selected':''}>10 kg Hilfe</option><option value="0" ${bandRec===0?'selected':''}>ohne Band</option></select></label>`
      : item.loadType === 'resistance'
        ? `<label>Band-Widerstand<select id="setLoad"><option value="10" selected>10 kg</option><option value="20">20 kg</option><option value="30">30 kg</option></select></label>` : '';
    const rirField = item.unit === 'reps'
      ? `<label>RIR<select id="setRir"><option value="3">3</option><option value="2" selected>2</option><option value="1">1</option><option value="0">0</option></select></label>` : '';
    const history = currentLog.sets.map((s,i)=>{const cmp=compareSet(s,prev?.log?.sets?.[i],item);return `<button type="button" class="set-chip editable" data-edit-set="${i}"><span>S${i+1}: ${setDisplay(s,item)}</span><small class="compare ${cmp.cls}">${cmp.text}</small><i>Bearbeiten</i></button>`}).join('');
    body = `${renderLastTimeBox(item)}
      <div class="target-box"><span>${exerciseComplete?'Übung abgeschlossen':`Satz ${setNo} von ${item.sets}`}</span><strong>${item.min}–${item.max} ${item.unit === 's' ? 's' : 'Wdh.'}</strong><small class="adaptive-target-copy">${escapeHTML(adaptiveExerciseGuidance(item,guided.key))}</small></div>
      ${item.progressGoal ? `<p class="coach-tip">${item.progressGoal}</p>` : ''}
      ${history?`<div class="eyebrow set-label">Heute · tippen zum Ändern</div><div class="set-history">${history}</div>`:''}
      ${exerciseComplete
        ? `<div class="coach-tip success-tip">Alle ${item.sets} Sätze sind gespeichert. Du kannst oben jeden Satz antippen und ändern oder löschen.</div><button id="nextExerciseBtn" class="primary full" type="button">Weiter zur nächsten Übung</button>`
        : `<div class="set-entry"><label>${unitLabel}<input id="setValue" type="number" min="0" step="1" inputmode="numeric" autofocus placeholder="Ergebnis"></label>${loadField}${rirField}</div>
          ${prev?.log?.sets?.[completedSets] ? `<div class="next-compare"><span>Dieser Satz letztes Mal</span><b>${setDisplay(prev.log.sets[completedSets],item)}</b></div>` : ''}
          ${item.unit === 'reps' ? '<div class="rir-help"><b>RIR = Reps in Reserve.</b> RIR 2 bedeutet: Du hättest noch ungefähr 2 saubere Wiederholungen geschafft.</div>' : ''}
          <button id="saveSetBtn" class="primary full" type="button">Satz speichern${completedSets + 1 < item.sets ? ' · dann Pause' : ' · Übung abschließen'}</button>`}`;
  }

  root.innerHTML = `<div class="guided-shell">
    <div class="guided-top"><div class="guided-progress"><span style="width:${progress}%"></span></div><div class="guided-count"><span>${escapeHTML(wt.label)}</span><span>Übung ${guided.itemIndex+1}/${wt.items.length}</span></div></div>
    <article class="card coach-exercise">
      <div class="card-head"><div><div class="eyebrow">${ex.cat}</div><h2>${ex.name}</h2></div><span class="pill">${targetText(item)}</span></div>
      <div class="coach-visual">${visualHTML(ex.visual, false, ex.name)}</div>
      <details class="exercise-technique"><summary>Technik & Hinweise</summary><ul class="cue-list">${ex.cues.map(x => `<li>${x}</li>`).join('')}</ul></details>
      ${body}
      ${renderGuidedAIBox(item)}
      <div class="coach-nav">${guided.itemIndex > 0 ? '<button id="prevExercise" class="secondary" type="button">← Zurück</button>' : ''}<button id="cancelCoach" class="ghost-btn" type="button">Training verlassen</button></div><details class="danger-zone"><summary>Weitere Optionen</summary><button id="discardCoach" class="text-action danger-text full" type="button">Offene Einheit verwerfen</button></details>
    </article>
  </div>`;

  document.getElementById('cancelCoach').onclick = () => {
    if (confirm('Training verlassen? Deine bisher eingetragenen Sätze bleiben gespeichert und du kannst später genau hier weitermachen.')) {
      persistActive(); document.body.classList.remove('workout-mode'); guided = null; renderTrainingOverview();
    }
  };
  document.getElementById('discardCoach')?.addEventListener('click',()=>{
    if(!discardActiveSession())return; guided=null; renderWorkoutTabs(); renderTrainingOverview(); renderDashboard();
  });
  document.getElementById('manualSetAiBtn')?.addEventListener('click',()=>{
    const sets=guided.logs?.[item.id]?.sets||[]; if(!sets.length)return; const idx=sets.length-1; runSetAI(item,sets[idx],idx,{force:true});
  });
  document.getElementById('prevExercise')?.addEventListener('click', () => {
    guided.itemIndex = Math.max(0, guided.itemIndex - 1);
    const prevItem=guided.template.items[guided.itemIndex];
    guided.setIndex=(guided.logs?.[prevItem.id]?.sets||[]).length;
    persistActive(); renderGuided();
  });
  document.getElementById('nextExerciseBtn')?.addEventListener('click',()=>{guided.itemIndex++;guided.setIndex=0;persistActive();renderGuided();});
  root.querySelectorAll('[data-edit-set]').forEach(btn=>btn.onclick=()=>openSetEditor(item.id,+btn.dataset.editSet));
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
  if(recoveryDecision().mode==='STOP'){alert(recoveryDecision().text);return;}
  if (!guided || guided.completed || timer.id || guided.template.items[guided.itemIndex]?.id !== item.id || (guided.logs[item.id]?.sets?.length || 0) >= item.sets) return;
  const valueEl = document.getElementById('setValue'); const value = +valueEl.value;
  if (!Number.isFinite(value) || value <= 0 || value > 3600 || !Number.isInteger(value)) { valueEl?.focus(); return; }
  guided.logs[item.id] ||= { sets: [] };
  const entry = { value };
  if (['band','resistance'].includes(item.loadType)) entry.load = +document.getElementById('setLoad').value;
  if (item.unit === 'reps') entry.rir = +document.getElementById('setRir').value;
  guided.logs[item.id].sets.push(entry);
  const count=guided.logs[item.id].sets.length;
  showPerformanceToast(item,entry,count-1);
  guided.setIndex=count;
  persistActive();
  if (count < item.sets) {
    openTimer(item.rest || 90, `${EX[item.id].name} · Pause`, () => renderGuided(), true);
  } else {
    guided.itemIndex++; guided.setIndex = 0; persistActive(); renderGuided();
  }
  if (hasGeminiKey() && state.settings.aiAutoTraining !== false && !guided.completed) setTimeout(()=>runSetAI(item,entry,count-1),0);
}

function persistActive() {
  state.activeSession = { template: clone(guided.template), key: guided.key, date: guided.date, itemIndex: guided.itemIndex, setIndex: guided.setIndex, logs: guided.logs, aiFeedback: guided.aiFeedback || {}, startedAt: guided.startedAt };
  persistState();
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
  if (!guided || guided.completed) return;
  const session = {
    date: guided.date, key: guided.key, completed: true, logs: guided.logs, startedAt: guided.startedAt,
    finishedAt: new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    legChoice: guided.template.legChoice || null,
    template: clone(guided.template),
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
  guided.completedSessionId = session.id;
  guided.completedSession = session;
  saveState();
  renderGuided();
}

const timer = { deadline: 0, id: null, remaining: 0, onDone: null, allowSkipDone: true };
function openTimer(seconds, label, onDone, allowSkipDone = true) {
  clearInterval(timer.id); timer.remaining = Math.max(0, Math.round(seconds)); timer.onDone = onDone; timer.allowSkipDone = allowSkipDone;
  timer.deadline = Date.now() + timer.remaining * 1000;
  document.getElementById('timerLabel').textContent = label;
  setTimerCoachLine('');
  document.getElementById('timerOverlay').classList.remove('hidden');
  updateTimerDisplay();
  timer.id = setInterval(() => {
    timer.remaining = Math.max(0, Math.ceil((timer.deadline - Date.now()) / 1000));
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
document.getElementById('timerMinus').onclick = () => { timer.remaining = Math.max(0, timer.remaining - 15); timer.deadline = Date.now()+timer.remaining*1000; updateTimerDisplay(); if(!timer.remaining)closeTimer(timer.allowSkipDone); };
document.getElementById('timerPlus').onclick = () => { timer.remaining += 15; timer.deadline = Date.now()+timer.remaining*1000; updateTimerDisplay(); };
document.getElementById('timerSkip').onclick = () => closeTimer(timer.allowSkipDone);

function startHandstandSession() {
  if (!dailyCheckComplete()) { startDailyCheck(); return; }
  if (recoveryDecision().mode === 'STOP') { alert(recoveryDecision().text); return; }
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
  const clean = String(query || '').trim();
  if (!clean) { root.innerHTML = ''; return; }
  const results = foodSearch(clean);
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
  const foods=(recents.length?recents:foodSearch('')).slice(0,6);
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
  document.getElementById('mealList').innerHTML = list.length ? list.map(m => `<div class="meal-log-item"><div><b>${escapeHTML(m.name)}${m.source==='gemini'?'<em class="ai-estimate-tag">KI-Schätzung</em>':''}</b><small>${m.amount?`${m.amount} ${escapeHTML(m.unit||'g')} · `:''}${Math.round(+m.cal||0)} kcal · ${round1(m.protein)} g P · ${round1(m.carbs)} g KH · ${round1(m.fat)} g F${(+m.fiber||0)>0?` · ${round1(m.fiber)} g Ballastst.`:''}</small>${m.assumption?`<small class="meal-assumption">Annahme: ${escapeHTML(m.assumption)}</small>`:''}</div><button type="button" data-delmeal="${m.id}">×</button></div>`).join('') : '<p class="muted">Noch nichts geloggt.</p>';
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
  if(hasGeminiKey()&&state.settings.aiAutoFood!==false)setTimeout(()=>runFoodAI('foodAiAnswer'),0);
});

document.getElementById('mealForm').onsubmit = e => {
  e.preventDefault(); const name = document.getElementById('mealName').value.trim(); const cal = +document.getElementById('mealCalories').value;
  if (!name || !cal) return;
  addMeal({ name, cal, protein:+document.getElementById('mealProtein').value||0, carbs:+document.getElementById('mealCarbs').value||0, fat:+document.getElementById('mealFat').value||0, fiber:+document.getElementById('mealFiber').value||0 });
  e.target.reset();
  if(hasGeminiKey()&&state.settings.aiAutoFood!==false)setTimeout(()=>runFoodAI('foodAiAnswer'),0);
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
  if (!Number.isFinite(waist)||waist<30||waist>250||date>localDateKey()) return; state.measurements = state.measurements.filter(m => m.date !== date); state.measurements.push({ date, waist }); state.measurements.sort((a,b)=>a.date.localeCompare(b.date)); saveState(); e.target.reset(); document.getElementById('wDate').value = localDateKey();
};
document.getElementById('strengthForm').onsubmit = e => {
  e.preventDefault(); const date = document.getElementById('sDate').value || localDateKey();
  const test = { date, pullups:+document.getElementById('sPullups').value||0, dips:+document.getElementById('sDips').value||0, handstand:+document.getElementById('sHs').value||0, hang:+document.getElementById('sHang').value||0, hspu:+document.getElementById('sHspu').value||0 };
  if(date>localDateKey()||Object.entries(test).some(([k,v])=>k!=='date'&&(!Number.isFinite(v)||v<0||v>3600)))return;
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
 const canvas=document.getElementById(canvasId);if(!canvas)return;
 const rect=canvas.getBoundingClientRect();if(!rect.width)return;
 const clean=series.map(s=>({...s,data:s.data.filter(p=>Number.isFinite(p.value)&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)).sort((a,b)=>a.date.localeCompare(b.date))}));
 cancelAnimationFrame(canvas._frame);
 const W=rect.width,H=240,dpr=Math.min(window.devicePixelRatio||1,3),ctx=canvas.getContext('2d');
 canvas.width=Math.round(W*dpr);canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
 const values=clean.flatMap(s=>s.data.map(p=>p.value)),dates=[...new Set(clean.flatMap(s=>s.data.map(p=>p.date)))].sort();
 let summary=canvas.nextElementSibling;
 if(!summary?.classList.contains('chart-accessible')){summary=document.createElement('p');summary.className='chart-accessible micro-copy';canvas.after(summary);}
 if(!values.length){ctx.clearRect(0,0,W,H);ctx.fillStyle='#9caebc';ctx.font='14px system-ui';ctx.fillText('Deine ersten Einträge erscheinen hier.',16,64);summary.textContent='Noch keine Werte protokolliert.';canvas.setAttribute('aria-label',summary.textContent);return;}
 const last=clean.filter(s=>s.data.length).map(s=>`${s.name||'Wert'}: ${fmt(s.data.at(-1).value)} (${deDate(s.data.at(-1).date)})`).join(' · ');
 summary.textContent=last;canvas.setAttribute('aria-label',last);
 let min=Math.min(...values),max=Math.max(...values);const gap=(max-min)*.15||1;min-=gap;max+=gap;
 const left=48,top=36,cw=W-left-20,ch=H-top-36,colors=['#78e7ba','#8abcf5','#f5c775'];
 const first=+parseDateKey(dates[0]),end=+parseDateKey(dates.at(-1));
 const x=date=>left+(end===first?.5:(+parseDateKey(date)-first)/(end-first))*cw;
 const y=value=>top+(max-value)/(max-min)*ch;
 function paint(progress){
  ctx.clearRect(0,0,W,H);ctx.font='12px system-ui';
  for(let i=0;i<4;i++){const yy=top+i/3*ch;ctx.strokeStyle='#263641';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(W-20,yy);ctx.stroke();ctx.fillStyle='#a4b3bf';ctx.fillText(fmt(max-(max-min)*i/3),2,yy+4);}
  ctx.save();ctx.beginPath();ctx.rect(left-5,top-5,(cw+10)*progress,ch+10);ctx.clip();
  clean.forEach((s,si)=>{if(!s.data.length)return;const color=colors[si%colors.length];
   if(si===0&&s.data.length>1){const fill=ctx.createLinearGradient(0,top,0,top+ch);fill.addColorStop(0,'rgba(120,231,186,.22)');fill.addColorStop(1,'rgba(120,231,186,0)');ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x(s.data[0].date),top+ch);s.data.forEach(p=>ctx.lineTo(x(p.date),y(p.value)));ctx.lineTo(x(s.data.at(-1).date),top+ch);ctx.closePath();ctx.fill();}
   ctx.strokeStyle=color;ctx.lineWidth=2.5;ctx.lineJoin='round';ctx.beginPath();s.data.forEach((p,i)=>i?ctx.lineTo(x(p.date),y(p.value)):ctx.moveTo(x(p.date),y(p.value)));ctx.stroke();
   s.data.forEach(p=>{ctx.beginPath();ctx.arc(x(p.date),y(p.value),3.5,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();});
  });ctx.restore();ctx.fillStyle='#a4b3bf';ctx.font='12px system-ui';
  [...new Set([dates[0],dates[Math.floor((dates.length-1)/2)],dates.at(-1)])].forEach(d=>{ctx.textAlign='center';ctx.fillText(d.slice(8)+'.'+d.slice(5,7),x(d),H-10);});ctx.textAlign='left';
  if(opts.legend)clean.forEach((s,i)=>{ctx.fillStyle=colors[i%colors.length];ctx.fillText(s.name||'',left+i*Math.min(115,cw/clean.length),16);});
 }
 const reduced=state.settings.animations===false||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const start=performance.now();function frame(now){const t=reduced?1:Math.min(1,(now-start)/650);paint(1-Math.pow(1-t,3));if(t<1)canvas._frame=requestAnimationFrame(frame);}canvas._frame=requestAnimationFrame(frame);
 canvas.onpointermove=event=>{const r=canvas.getBoundingClientRect(),px=event.clientX-r.left;const nearest=dates.reduce((a,b)=>Math.abs(x(a)-px)<Math.abs(x(b)-px)?a:b);summary.textContent=deDate(nearest)+' · '+clean.flatMap(s=>s.data.filter(p=>p.date===nearest).map(p=>`${s.name||'Wert'}: ${fmt(p.value)}`)).join(' · ');};
 canvas.onpointerleave=()=>summary.textContent=last;
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
  renderExerciseProgress();
}
window.addEventListener('resize', () => { if (document.getElementById('stats').classList.contains('active')) drawCharts(); if(document.getElementById('food').classList.contains('active'))renderFoodTrend(); });

const HSPU_STAGES = [
  { name:'Pike Push-up', need:'4×6 sauber', desc:'Schulterkraft und Vorverlagerung.' },
  { name:'Elevated Pike Push-up', need:'3–4×6 sauber', desc:'Füße erhöht, Hüfte noch stärker über die Schultern.' },
  { name:'Wall HSPU Negative', need:'3–5 kontrollierte Negative', desc:'Langsam und stabil absenken.' },
  { name:'Teil-ROM Wall HSPU', need:'mehrere saubere Reps', desc:'Bewegungsumfang schrittweise vergrößern.' },
  { name:'Full Wall HSPU', need:'3+ saubere Reps', desc:'Volle Kontrolle und volle ROM.' },
  { name:'Freier HSPU', need:'langfristig', desc:'Balance und Kraft zusammenführen.' }
];

function inferredHspuStage() {
  let stage=0;
  if(sessionsMeeting('pike',4,6)>=1)stage=1;
  if(sessionsMeeting('elevatedPike',4,6)>=1)stage=2;
  if(sessionsMeeting('wallHspuNegative',3,3)>=2)stage=3;
  if(sessionsMeeting('wallHspuPartial',3,5)>=2)stage=4;
  if(sessionsMeeting('wallHspu',3,3)>=2 || maxStrength('hspu')>=3)stage=5;
  return stage;
}

function renderSkills() {
  const root = document.getElementById('skillTree'), pull = maxStrength('pullups');
  const detected=inferredHspuStage(); const manual=clamp(+state.skillStages.hspu || 0,0,HSPU_STAGES.length-1); const stage=Math.max(manual,detected); if(stage>manual){state.skillStages.hspu=stage;persistState();}
  const current = HSPU_STAGES[stage];
  const rows = HSPU_STAGES.map((item,i) => {
    const status = i < stage ? 'done' : i === stage ? 'current' : 'upcoming';
    const marker = i < stage ? '✓' : i + 1;
    return `<div class="skill-stage-row ${status}"><span class="skill-stage-marker">${marker}</span><div><b>${item.name}</b><small>${item.need}</small></div>${i === stage ? '<em>Aktuell</em>' : ''}</div>`;
  }).join('');
  root.innerHTML = `<article class="surface current-skill-card">
      <div class="skill-current-head"><span class="skill-num">${stage + 1}</span><div><p class="section-label accent">Aktuelle HSPU-Stufe</p><h2>${current.name}</h2></div></div>
      <p class="support-copy">${current.desc}</p>
      <div class="skill-goal-line"><span>Nächstes Ziel</span><b>${current.need}</b></div>
      ${stage < HSPU_STAGES.length - 1 ? '<button class="primary full" type="button" data-hspu-next>Stufe geschafft markieren</button>' : '<div class="success-line">HSPU-Pfad vollständig ✓</div>'}
    </article>
    <details class="surface accordion-card skill-path-details">
      <summary><span class="summary-icon">↗</span><span><b>Kompletter HSPU-Pfad</b><small>${stage + 1} von ${HSPU_STAGES.length} · nur bei Bedarf öffnen</small></span></summary>
      <div class="accordion-body"><div class="skill-stage-list">${rows}</div></div>
    </details>`;
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
  const current = ROADMAP.find(p=>p.phase===phase) || ROADMAP[0];
  const rows = ROADMAP.map(p=>`<div class="roadmap-phase-row ${p.phase===phase?'current':''} ${p.phase<phase?'done':''}"><span>${p.phase<phase?'✓':p.phase}</span><div><b>${p.title}</b><small>${p.months}</small></div>${p.phase===phase?'<em>Jetzt</em>':''}</div>`).join('');
  document.getElementById('roadmapCards').innerHTML = `<article class="surface roadmap-current-card"><p class="section-label accent">Phase ${current.phase} · ${current.months}</p><h2>${current.title}</h2><div class="phase-criteria">${current.actions.map(a=>`<div><span>•</span><span>${a}</span></div>`).join('')}</div></article>
    <details class="surface accordion-card roadmap-all-details"><summary><span class="summary-icon">↗</span><span><b>Alle Phasen</b><small>Langfristigen Weg anzeigen</small></span></summary><div class="accordion-body"><div class="roadmap-phase-list">${rows}</div></div></details>`;
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


// ---------- V5.2 Adaptive Pro · plan management, nutrition trends, exercise analytics ----------
const BUILTIN_WORKOUT_KEYS = ['A','B','C'];
let activeFoodStat = 'calories';
let activeExerciseStat = null;
let planEditorState = null;
let pendingAiCalories = null;

function allWorkoutKeys() {
  const extras = Object.keys(state.customPlans || {}).filter(k => !BUILTIN_WORKOUT_KEYS.includes(k));
  return [...BUILTIN_WORKOUT_KEYS, ...extras];
}

function sessionTemplate(session) {
  return session?.template || workoutTemplate(session?.key || 'A', session?.date || localDateKey());
}

function exercisePrescription(id) {
  const map = {
    inclinePushup:{sets:3,min:6,max:12,unit:'reps',rest:90}, gluteBridge:{sets:3,min:10,max:15,unit:'reps',rest:60}, squat:{sets:3,min:8,max:15,unit:'reps',rest:90},
    elevatedPike:{sets:4,min:4,max:6,unit:'reps',rest:150},
    wallHspuNegative:{sets:3,min:3,max:5,unit:'reps',rest:180},
    wallHspuPartial:{sets:3,min:3,max:5,unit:'reps',rest:180},
    wallHspu:{sets:3,min:2,max:5,unit:'reps',rest:180},
    tempoPullup:{sets:4,min:3,max:5,unit:'reps',rest:180},
    strictPullVolume:{sets:4,min:3,max:6,unit:'reps',rest:150},
    tempoDips:{sets:3,min:6,max:8,unit:'reps',rest:150},
    hangingLegRaise:{sets:3,min:5,max:8,unit:'reps',rest:90},
    towelHang:{sets:2,min:20,max:40,unit:'s',rest:90},
    declinePushup:{sets:3,min:8,max:12,unit:'reps',rest:90},
    feetElevatedRow:{sets:3,min:6,max:10,unit:'reps',rest:120},
    pistolSquat:{sets:3,min:4,max:8,unit:'reps',rest:120,suffix:'je Bein'},
    toesToBar:{sets:3,min:4,max:8,unit:'reps',rest:105},
    pseudoPlanchePushup:{sets:3,min:5,max:8,unit:'reps',rest:120},
    hollow:{sets:3,min:20,max:40,unit:'s',rest:60}, sidePlank:{sets:3,min:30,max:45,unit:'s',rest:60}, deadHang:{sets:2,min:30,max:45,unit:'s',rest:90},
    bandPullA:{sets:4,min:4,max:6,unit:'reps',rest:180,loadType:'band'}, bandPullB:{sets:4,min:5,max:8,unit:'reps',rest:150,loadType:'band'},
    bandRow:{sets:3,min:12,max:20,unit:'reps',rest:75,loadType:'resistance'}, facePull:{sets:3,min:15,max:25,unit:'reps',rest:60,loadType:'resistance'}
  };
  return clone(map[id] || {sets:3,min:6,max:10,unit:'reps',rest:90});
}

function logsForExercise(id) {
  return sessions().filter(s => s.logs?.[id]?.sets?.length).sort((a,b)=>`${a.date}-${a.finishedAt||''}`.localeCompare(`${b.date}-${b.finishedAt||''}`));
}
function sessionsMeeting(id, setsNeeded, valueNeeded) {
  return logsForExercise(id).filter(s => {
    const sets=s.logs[id].sets || [];
    return sets.length>=setsNeeded && sets.slice(0,setsNeeded).every(x=>(+x.value||0)>=valueNeeded);
  }).length;
}
function bestLoggedValue(id) {
  return Math.max(0,...logsForExercise(id).flatMap(s=>(s.logs[id].sets||[]).map(x=>+x.value||0)));
}

function progressionRecommendationsDetailed() {
  const rec=[];
  const push=(from,to,reason)=>{
    const keys=allWorkoutKeys().filter(k=>workoutTemplate(k).items?.some(i=>i.id===from));
    if(keys.length) rec.push({from,to,reason,keys});
  };
  if(sessionsMeeting('pike',4,6)>=1) push('pike','elevatedPike','4×6 Pike sauber erreicht.');
  if(sessionsMeeting('elevatedPike',4,6)>=1) push('elevatedPike','wallHspuNegative','Elevated Pike stabil am oberen Ende.');
  if(sessionsMeeting('wallHspuNegative',3,3)>=2) push('wallHspuNegative','wallHspuPartial','Negative über mehrere Einheiten kontrolliert.');
  if(sessionsMeeting('wallHspuPartial',3,5)>=2) push('wallHspuPartial','wallHspu','Teil-ROM mehrfach 3×5 sauber.');
  if(sessionsMeeting('kneeRaises',3,10)>=2) push('kneeRaises','hangingLegRaise','Knee Raises mehrfach 3×10 ohne Einbruch.');
  if(bestLoggedValue('deadHang')>=60 || maxStrength('hang')>=60) push('deadHang','towelHang','60+ Sekunden Dead Hang erreicht.');
  if(sessionsMeeting('pushupHard',3,15)>=2) push('pushupHard','declinePushup','3×15 schwere Push-ups mehrfach erreicht.');
  if(sessionsMeeting('declinePushup',3,12)>=2) push('declinePushup','pseudoPlanchePushup','Decline Push-ups sind stabil; mehr Schultervorverlagerung ist der nächste sinnvolle Reiz.');
  if(sessionsMeeting('rows',3,12)>=2) push('rows','feetElevatedRow','Rows mehrfach am oberen Ende: Hebel jetzt gezielt erschweren.');
  if(sessionsMeeting('pistol',3,10)>=2) push('pistol','pistolSquat','Assisted Pistols sind stabil; freie Pistols können kontrolliert aufgebaut werden.');
  if(sessionsMeeting('hangingLegRaise',3,8)>=2) push('hangingLegRaise','toesToBar','Leg Raises mehrfach sauber: Toes-to-Bar ist als nächste Core-Stufe sinnvoll.');
  if(sessionsMeeting('dips',3,10)>=2 || maxStrength('dips')>=12) push('dips','tempoDips','Dips sind stabil genug für eine schwerere Tempovariation.');
  if(maxStrength('pullups')>=5) push('pullup','tempoPullup','5+ strikte Pull-ups: Kraftarbeit kann spezifischer werden.');
  if(maxStrength('pullups')>=5 && bandRecommendation().band===0) {
    if(allWorkoutKeys().some(k=>workoutTemplate(k).items?.some(i=>['bandPullA','bandPullB'].includes(i.id)))) {
      rec.push({from:'bandPullB',to:'strictPullVolume',reason:'Bandhilfe ist nicht mehr nötig; sauberes Volumen ohne Band ist sinnvoll.',keys:allWorkoutKeys().filter(k=>workoutTemplate(k).items?.some(i=>i.id==='bandPullB'))});
    }
  }
  return rec.filter((r,i,a)=>a.findIndex(x=>x.from===r.from&&x.to===r.to)===i).slice(0,5);
}

function applyProgressionSuggestion(index) {
  const rec=progressionRecommendationsDetailed()[index]; if(!rec)return;
  const targets=rec.keys || [];
  if(!targets.length)return;
  const key=targets[0], plan=clone(workoutTemplate(key));
  const idx=plan.items.findIndex(i=>i.id===rec.from); if(idx<0)return;
  if(plan.items.some(i=>i.id===rec.to)){alert('Die Zielübung ist schon im Plan. Bitte im Planeditor zusammenführen.');return;}
  plan.items[idx]={id:rec.to,...exercisePrescription(rec.to)};
  state.customPlans ||= {}; state.customPlans[key]=plan;
  saveState(false); renderWorkoutTabs(); renderTrainingOverview(); renderTrainingPlanManager(); renderDashboard();
}

function renderTrainingPlanManager() {
  const root=document.getElementById('trainingPlanList'); if(!root)return;
  const keys=allWorkoutKeys();
  root.innerHTML=keys.map(k=>{
    const wt=workoutTemplate(k), custom=!!state.customPlans?.[k];
    const names=(wt.items||[]).filter(i=>i.id!=='warmup').slice(0,3).map(i=>EX[i.id]?.name||i.id);
    const extra=Math.max(0,(wt.items||[]).filter(i=>i.id!=='warmup').length-names.length);
    return `<article class="managed-plan-row ${selectedWorkout===k?'selected':''}">
      <button class="managed-plan-main" data-plan-open="${k}" type="button"><span class="managed-day">${escapeHTML(wt.short||'Extra')}</span><span><b>${escapeHTML(wt.label)}</b><small>${escapeHTML(wt.focus||'Individuelles Training')}</small><em>${escapeHTML(names.join(' · '))}${extra?` · +${extra}`:''}</em></span></button>
      <button class="managed-plan-edit" data-plan-edit="${k}" type="button" aria-label="${escapeHTML(wt.label)} anpassen">${custom?'Angepasst':'Anpassen'}</button>
    </article>`;
  }).join('');
  const recs=progressionRecommendationsDetailed();
  const box=document.getElementById('planCoachBox');
  if(box){
    const base=box.querySelector('div');
    if(base){base.innerHTML=recs.length?`<b>✦ ${recs.length} Coach-Vorschlag${recs.length===1?'':'e'}</b><small>${escapeHTML(EX[recs[0].from]?.name||recs[0].from)} → ${escapeHTML(EX[recs[0].to]?.name||recs[0].to)}</small>`:'<b>✦ KI Plan-Check</b><small>Dein aktueller Plan hat noch keine zwingende Progression.</small>';}
  }
  root.querySelectorAll('[data-plan-open]').forEach(btn=>btn.onclick=()=>{
    selectedWorkout=btn.dataset.planOpen; manualWorkoutMode=true;
    if(state.activeSession?.key===selectedWorkout)restoreActiveSession(); else guided=null;
    renderWorkoutTabs();renderTrainingOverview();renderTrainingPlanManager();
    document.getElementById('trainingOverview')?.scrollIntoView({behavior:'smooth',block:'start'});
  });
  root.querySelectorAll('[data-plan-edit]').forEach(btn=>btn.onclick=()=>openPlanEditor(btn.dataset.planEdit));
  const reviewBtn=document.getElementById('aiPlanReviewBtn');
  if(reviewBtn){reviewBtn.textContent=recs.length?'Vorschläge ansehen':'KI prüfen'; reviewBtn.onclick=()=>recs.length?openProgressionSuggestions():runPlanReviewAI();}
  const reviewBox=document.getElementById('aiPlanReviewAnswer');
  if(reviewBox && state.ai?.planReview?.text){reviewBox.classList.remove('hidden','error');reviewBox.innerHTML=aiTextHTML(state.ai.planReview.text);}
}

function coachExerciseOptions() {
  const hidden=new Set(['warmup']);
  return Object.entries(EX).filter(([id])=>!hidden.has(id)).sort((a,b)=>a[1].cat.localeCompare(b[1].cat)||a[1].name.localeCompare(b[1].name));
}
function planItemFromId(id) {
  if(id==='warmup')return {id:'warmup',special:'warmup'};
  if(id==='handstand')return {id:'handstand',special:'handstand',minutes:8};
  return {id,...exercisePrescription(id)};
}
function planEditorRow(item,index) {
  const opts=[['warmup',EX.warmup],...coachExerciseOptions()].map(([id,ex])=>`<option value="${id}" ${id===item.id?'selected':''}>${escapeHTML(ex.cat)} · ${escapeHTML(ex.name)}</option>`).join('');
  const special=!!item.special;
  return `<div class="plan-exercise-row" data-plan-row="${index}">
    <div class="plan-exercise-top"><span class="plan-order">${index+1}</span><select data-plan-exercise>${opts}</select><div class="plan-row-actions"><button type="button" data-plan-up="${index}">↑</button><button type="button" data-plan-down="${index}">↓</button><button type="button" data-plan-remove="${index}">×</button></div></div>
    <div class="plan-prescription ${special?'special':''}">
      ${special?`<span>${item.id==='handstand'?'Skill-Block · ca. '+(item.minutes||8)+' Min.':'Geführtes Warm-up'}</span>`:`<label>Sätze<input data-plan-sets type="number" min="1" max="6" value="${item.sets||3}"></label><label>Min<input data-plan-min type="number" min="1" max="120" value="${item.min||6}"></label><label>Max<input data-plan-max type="number" min="1" max="180" value="${item.max||10}"></label><label>Pause<input data-plan-rest type="number" min="30" max="360" step="15" value="${item.rest||90}"></label>`}
    </div>
  </div>`;
}
function openPlanEditor(key) {
  const wt=clone(workoutTemplate(key));
  planEditorState={mode:'edit',key,draft:wt,isExtra:!BUILTIN_WORKOUT_KEYS.includes(key)};
  renderPlanEditor();
}
function openPlanEditorOverlay(title) {
  document.getElementById('planEditorTitle').textContent=title;
  document.getElementById('planEditorOverlay').classList.remove('hidden');
  document.body.classList.add('sheet-open');
}
function closePlanEditor() {
  document.getElementById('planEditorOverlay')?.classList.add('hidden'); document.body.classList.remove('sheet-open'); planEditorState=null;
}
function renderPlanEditor() {
  const st=planEditorState; if(!st)return;
  openPlanEditorOverlay(st.draft?.label || 'Training anpassen');
  const body=document.getElementById('planEditorBody');
  const p=st.draft;
  body.innerHTML=`<div class="plan-meta-grid"><label class="field-label">Name<input id="planName" value="${escapeHTML(p.label||'Extra · Training')}"></label><label class="field-label">Fokus<input id="planFocus" value="${escapeHTML(p.focus||'Individuell')}"></label><label class="field-label span-2">Dauer<input id="planDuration" value="${escapeHTML(p.duration||'35–45 Min.')}"></label></div>
    <div class="plan-editor-section-head"><div><p class="section-label">Übungen</p><h3>${p.items.length} Bausteine</h3></div><button id="addPlanExercise" class="text-action" type="button">＋ Übung</button></div>
    <div id="planExerciseRows" class="plan-exercise-editor">${p.items.map(planEditorRow).join('')}</div>
    <div class="plan-editor-footer"><button id="savePlanEditor" class="primary full" type="button">Plan speichern</button>${BUILTIN_WORKOUT_KEYS.includes(st.key)?'<button id="resetPlanEditor" class="text-action full" type="button">Auf Standard zurücksetzen</button>':'<button id="deletePlanEditor" class="text-action danger-text full" type="button">Trainingstag löschen</button>'}</div>`;
  bindPlanEditorRows();
  document.getElementById('addPlanExercise').onclick=()=>{syncPlanRowsFromDOM();p.items.push(planItemFromId('rows'));renderPlanEditor();};
  document.getElementById('savePlanEditor').onclick=savePlanEditor;
  document.getElementById('resetPlanEditor')?.addEventListener('click',()=>{if(confirm('Deine Anpassungen für diesen Trainingstag zurücksetzen?')){delete state.customPlans[st.key];saveState(false);closePlanEditor();renderWorkoutTabs();renderTrainingOverview();renderTrainingPlanManager();}});
  document.getElementById('deletePlanEditor')?.addEventListener('click',()=>{if(confirm('Diesen zusätzlichen Trainingstag löschen? Vergangene absolvierte Einheiten bleiben im Verlauf.')){delete state.customPlans[st.key];if(selectedWorkout===st.key)selectedWorkout='A';saveState(false);closePlanEditor();renderWorkoutTabs();renderTrainingOverview();renderTrainingPlanManager();}});
}
function syncPlanRowsFromDOM() {
  if(!planEditorState?.draft)return;
  const name=document.getElementById('planName'),focus=document.getElementById('planFocus'),duration=document.getElementById('planDuration');
  if(name)planEditorState.draft.label=name.value; if(focus)planEditorState.draft.focus=focus.value; if(duration)planEditorState.draft.duration=duration.value;
  const rows=[...document.querySelectorAll('#planExerciseRows [data-plan-row]')];
  planEditorState.draft.items=rows.map(row=>{
    const id=row.querySelector('[data-plan-exercise]')?.value||'rows';
    if(id==='warmup'||id==='handstand')return planItemFromId(id);
    const base=planItemFromId(id);
    base.sets=clamp(+row.querySelector('[data-plan-sets]')?.value||base.sets,1,6);
    base.min=clamp(+row.querySelector('[data-plan-min]')?.value||base.min,1,120);
    base.max=clamp(+row.querySelector('[data-plan-max]')?.value||base.max,base.min,180);
    base.rest=clamp(+row.querySelector('[data-plan-rest]')?.value||base.rest,30,360);
    return base;
  });
}
function bindPlanEditorRows() {
  document.querySelectorAll('#planExerciseRows [data-plan-exercise]').forEach(sel=>sel.onchange=()=>{syncPlanRowsFromDOM();renderPlanEditor();});
  document.querySelectorAll('#planExerciseRows [data-plan-up]').forEach(b=>b.onclick=()=>{syncPlanRowsFromDOM();const i=+b.dataset.planUp;if(i>0){const a=planEditorState.draft.items;[a[i-1],a[i]]=[a[i],a[i-1]];renderPlanEditor();}});
  document.querySelectorAll('#planExerciseRows [data-plan-down]').forEach(b=>b.onclick=()=>{syncPlanRowsFromDOM();const i=+b.dataset.planDown,a=planEditorState.draft.items;if(i<a.length-1){[a[i+1],a[i]]=[a[i],a[i+1]];renderPlanEditor();}});
  document.querySelectorAll('#planExerciseRows [data-plan-remove]').forEach(b=>b.onclick=()=>{syncPlanRowsFromDOM();planEditorState.draft.items.splice(+b.dataset.planRemove,1);renderPlanEditor();});
}
function savePlanEditor() {
  syncPlanRowsFromDOM(); const st=planEditorState, p=st.draft;
  p.label=(document.getElementById('planName')?.value||p.label||'Training').trim();
  p.focus=(document.getElementById('planFocus')?.value||p.focus||'Individuell').trim();
  p.duration=(document.getElementById('planDuration')?.value||p.duration||'35–45 Min.').trim();
  p.short=p.short || (BUILTIN_WORKOUT_KEYS.includes(st.key)?({A:'Mo',B:'Do',C:'WE'}[st.key]):'Extra');
  if(!p.items.some(i=>!i.special)){alert('Füge mindestens eine Kraftübung hinzu.');return;}
  if(new Set(p.items.map(i=>i.id)).size!==p.items.length){alert('Jede Übung darf einmal vorkommen. Erhöhe stattdessen ihre Satzanzahl.');return;}
  state.customPlans ||= {};state.customPlans[st.key]=clone(p);saveState(false);closePlanEditor();selectedWorkout=st.key;manualWorkoutMode=true;renderWorkoutTabs();renderTrainingOverview();renderTrainingPlanManager();renderDashboard();
}

function openProgressionSuggestions() {
  const recs=progressionRecommendationsDetailed();
  planEditorState={mode:'suggestions',draft:{label:'Coach-Vorschläge'}};
  openPlanEditorOverlay('Coach-Vorschläge');
  const body=document.getElementById('planEditorBody');
  if(!recs.length){body.innerHTML='<div class="empty-state">Noch keine eindeutige Progression. Trainiere weiter sauber im vorgegebenen Bereich.</div>';return;}
  body.innerHTML=`<div class="coach-suggestion-list">${recs.map((r,i)=>`<article><div><p class="section-label">${escapeHTML((r.keys||[]).map(k=>workoutTemplate(k).short||k).join(' · '))}</p><h3>${escapeHTML(EX[r.from]?.name||r.from)} → ${escapeHTML(EX[r.to]?.name||r.to)}</h3><p>${escapeHTML(r.reason)}</p></div><button data-apply-progression="${i}" class="secondary" type="button">Übernehmen</button></article>`).join('')}</div><button id="askAiPlanReviewFromSuggestions" class="text-action full" type="button">✦ Zusätzlich Gemini fragen</button>`;
  body.querySelectorAll('[data-apply-progression]').forEach(b=>b.onclick=()=>{applyProgressionSuggestion(+b.dataset.applyProgression);closePlanEditor();});
  document.getElementById('askAiPlanReviewFromSuggestions').onclick=()=>{closePlanEditor();runPlanReviewAI();};
}

function openNewTrainingDayChooser() {
  planEditorState={mode:'new',key:`X${Date.now().toString(36)}`,draft:{label:'Extra · Training',short:'Extra',duration:'35–45 Min.',focus:'Ergänzend',items:[planItemFromId('warmup')]}};
  openPlanEditorOverlay('Neuen Trainingstag planen');
  const body=document.getElementById('planEditorBody');
  body.innerHTML=`<div class="planner-intro"><div class="planner-orb">✦</div><h3>Was soll der neue Tag leisten?</h3><p>Gemini kennt deine vorhandenen Trainingstage, bisherigen Leistungen und aktuelle Progressionen. Es soll Lücken schließen statt Belastung zu duplizieren.</p></div>
    <label class="field-label">Wunsch / Rahmen<textarea id="newPlanRequest" class="plan-request" rows="4" placeholder="z. B. 35 Minuten zuhause am Samstag, Fokus Handstand und Oberkörper, Beine nur leicht"></textarea></label>
    <div class="chip-row compact-chips"><button type="button" data-plan-prompt="30–40 Minuten zuhause, möglichst wenig Equipment, ergänzend zu meinen anderen Trainingstagen.">Home · 30–40 Min.</button><button type="button" data-plan-prompt="Zusätzlicher Park-Tag mit Skill-Fokus, ohne die Hauptübungen unnötig zu doppeln.">Park · Skill</button><button type="button" data-plan-prompt="Kurzer Recovery-Tag mit Technik, Core und Schultergesundheit.">Leicht · Technik</button></div>
    <button id="generateAiPlanBtn" class="primary full" type="button">✦ Mit KI zusammenstellen</button><button id="buildManualPlanBtn" class="secondary full" type="button">Manuell zusammenstellen</button><div id="newPlanAiStatus" class="ai-answer hidden"></div>`;
  body.querySelectorAll('[data-plan-prompt]').forEach(b=>b.onclick=()=>document.getElementById('newPlanRequest').value=b.dataset.planPrompt);
  document.getElementById('buildManualPlanBtn').onclick=()=>renderPlanEditor();
  document.getElementById('generateAiPlanBtn').onclick=generateAiTrainingPlan;
}

function currentPlansForAI() {
  return allWorkoutKeys().map(k=>{const wt=workoutTemplate(k);return {key:k,label:wt.label,duration:wt.duration,focus:wt.focus,items:(wt.items||[]).map(i=>({id:i.id,name:EX[i.id]?.name,target:targetText(i)}))};});
}
function recentPerformanceForAI() {
  return sessions().slice().sort((a,b)=>`${b.date}-${b.finishedAt||''}`.localeCompare(`${a.date}-${a.finishedAt||''}`)).slice(0,8).map(s=>compactWorkoutForAI(s));
}
async function generateAiTrainingPlan() {
  const editorToken=planEditorState; if(!editorToken||editorToken.busy)return;editorToken.busy=true;
  const status=document.getElementById('newPlanAiStatus'), request=(document.getElementById('newPlanRequest')?.value||'Ergänzender Trainingstag, sinnvoll zu meinem bestehenden Plan.').trim();
  if(!hasGeminiKey()){status.classList.remove('hidden');status.textContent='Unter Mehr → Einstellungen → KI Coach zuerst deinen Gemini-Key hinterlegen. Manuell kannst du den Tag sofort zusammenstellen.';editorToken.busy=false;return;}
  const allowed=coachExerciseOptions().map(([id,e])=>({id,name:e.name,cat:e.cat}));
  const prompt=`Du planst EINEN zusätzlichen Calisthenics-Trainingstag. Antworte ausschließlich als gültiges JSON ohne Markdown. Berücksichtige vorhandene Trainingstage, Leistungsstand, Recovery und Progressionen. Vermeide unnötige Doppelbelastung und plane normalerweise 5–8 Bausteine. Nutze nur exerciseId aus ALLOWED. Warm-up kann exerciseId "warmup" sein. Handstand kann "handstand" sein. Für normale Übungen: sets 1–5, min/max realistische Wiederholungen oder Sekunden, restSeconds 45–240. Keine medizinischen Aussagen.\n\nJSON: {"label":"Extra · ...","focus":"...","duration":"35–45 Min.","items":[{"exerciseId":"warmup","sets":0,"min":0,"max":0,"unit":"special","restSeconds":0},{"exerciseId":"rows","sets":3,"min":8,"max":12,"unit":"reps","restSeconds":90}],"reason":"max. 2 kurze Sätze"}\n\nWUNSCH:${request}\nPROFIL:${JSON.stringify({age:state.profile.age,height:state.profile.height,weight:latestWeight(),goal:state.profile.goal,trainingDays:state.profile.trainingDays,bands:state.profile.bands,activity:state.profile.activity,sleep:state.profile.sleepBaseline})}\nSTÄRKE:${JSON.stringify({pullups:maxStrength('pullups'),dips:maxStrength('dips'),pushups:maxStrength('pushups'),handstand:maxStrength('handstand'),hang:maxStrength('hang'),hspu:maxStrength('hspu')})}\nPROGRESSIONEN:${JSON.stringify(progressionRecommendationsDetailed().map(r=>({from:r.from,to:r.to,reason:r.reason})))}\nBESTEHENDE_PLÄNE:${JSON.stringify(currentPlansForAI())}\nLETZTE_EINHEITEN:${JSON.stringify(recentPerformanceForAI())}\nALLOWED:${JSON.stringify(allowed)}`;
  status.classList.remove('hidden');status.textContent='Gemini gleicht Belastung, Progressionen und deine bestehenden Tage ab …';
  try{
    const raw=await geminiGenerate(prompt,{maxTokens:900,timeoutMs:25000}); const data=extractGeminiJSON(raw);
    const allowedIds=new Set(['warmup',...allowed.map(x=>x.id)]); const items=(Array.isArray(data.items)?data.items:[]).filter((x,i,a)=>x && allowedIds.has(x.exerciseId) && a.findIndex(y=>y?.exerciseId===x.exerciseId)===i).slice(0,9).map(x=>{
      const id=x.exerciseId;if(id==='warmup'||id==='handstand')return planItemFromId(id);
      const it=planItemFromId(id);it.sets=Math.round(clamp(+x.sets||it.sets,1,5));it.min=clamp(+x.min||it.min,1,120);it.max=clamp(+x.max||it.max,it.min,180);it.rest=clamp(+x.restSeconds||it.rest,30,300);return it;
    });
    if(!items.some(i=>!i.special))throw new Error('Keine gültigen Kraftübungen im KI-Vorschlag.');
    if (planEditorState!==editorToken) return;
    if(items[0].id!=='warmup')items.unshift(planItemFromId('warmup'));
    planEditorState.draft={label:String(data.label||'Extra · KI Plan').slice(0,60),short:'Extra',duration:String(data.duration||'35–45 Min.').slice(0,30),focus:String(data.focus||'Ergänzend').slice(0,80),items,aiReason:String(data.reason||'')};
    renderPlanEditor();
    const body=document.getElementById('planEditorBody'); if(planEditorState.draft.aiReason){const note=document.createElement('div');note.className='ai-plan-note';note.textContent=`KI-Begründung: ${planEditorState.draft.aiReason}`;body.prepend(note);}
  }catch(e){status.textContent=e.message||'KI-Plan konnte nicht erstellt werden.';status.classList.add('error');}finally{editorToken.busy=false;}
}

async function runPlanReviewAI() {
  const box=document.getElementById('aiPlanReviewAnswer'); if(!box)return;
  if(!hasGeminiKey()){box.classList.remove('hidden');box.textContent='Gemini-Key fehlt. Unter Mehr → Einstellungen → KI Coach kannst du deinen eigenen Key hinterlegen.';return;}
  box.classList.remove('hidden');box.textContent='Gemini prüft Überschneidungen, Volumen und aktuelle Progressionen …';
  const prompt=`Du bist ein evidenzorientierter Calisthenics-Programmierer. Prüfe die folgenden Trainingstage zusammen mit dem Leistungsstand. Antworte auf Deutsch sehr knapp: maximal 4 Punkte. Nenne nur Änderungen, die wirklich sinnvoll sind. Gib konkrete Übung + Sätze/Wiederholungen an. Berücksichtige: maximal ${state.profile.trainingDays||3} reguläre Trainingstage pro Woche, Kraft hat Priorität, Skills danach, 1–2 RIR, Gelenkbeschwerden nicht provozieren.\nPLÄNE:${JSON.stringify(currentPlansForAI())}\nFORTSCHRITT:${JSON.stringify({prs:{pullups:maxStrength('pullups'),dips:maxStrength('dips'),handstand:maxStrength('handstand'),hang:maxStrength('hang'),hspu:maxStrength('hspu')},recommendations:progressionRecommendationsDetailed(),recent:recentPerformanceForAI()})}`;
  try{const text=await geminiGenerate(prompt,{maxTokens:420});state.ai.planReview={text,at:Date.now()};saveState(false);box.innerHTML=aiTextHTML(text);}catch(e){box.textContent=e.message||'Plan-Check fehlgeschlagen.';box.classList.add('error');}
}

function foodTrendSeries(metric=activeFoodStat) {
  const days=Array.from({length:14},(_,i)=>addDaysKey(localDateKey(),i-13));
  return days.filter(d=>(state.meals[d]||[]).length).map(date=>({date,value:+mealTotals(date)[metric]||0}));
}
function renderFoodTrend() {
  const canvas=document.getElementById('foodTrendChart'); if(!canvas)return;
  document.querySelectorAll('[data-food-stat]').forEach(btn=>btn.classList.toggle('active',btn.dataset.foodStat===activeFoodStat));
  const cfg={calories:{label:'kcal',target:+state.settings.calories||0},protein:{label:'g Eiweiß',target:+state.settings.protein||0},carbs:{label:'g KH',target:+state.settings.carbs||0},fat:{label:'g Fett',target:+state.settings.fat||0}}[activeFoodStat];
  const data=foodTrendSeries(activeFoodStat), vals=data.map(x=>x.value), av=avg(vals);
  const badge=document.getElementById('foodTrendAverage'); if(badge)badge.textContent=av==null?'–':`Ø ${Math.round(av)} ${cfg.label}`;
  const targetData=data.map(p=>({date:p.date,value:cfg.target}));
  drawChart('foodTrendChart',[{name:cfg.label,data},{name:'Ziel',data:targetData}],{legend:true});
  const hint=document.getElementById('foodTrendHint');if(hint)hint.textContent=data.length?`${data.length} geloggte Tage · Ziel aktuell ${Math.round(cfg.target)} ${cfg.label}.`:'Noch keine geloggten Tage im 14-Tage-Fenster.';
}

function exerciseItemMeta(id,session=null) {
  const wt=session?sessionTemplate(session):null; const found=wt?.items?.find(i=>i.id===id); if(found)return found;
  for(const k of allWorkoutKeys()){const x=workoutTemplate(k).items?.find(i=>i.id===id);if(x)return x;}
  return exercisePrescription(id);
}
function exerciseSessionScore(id,session) {
  const log=session.logs?.[id], sets=log?.sets||[];if(!sets.length)return null;
  const item=exerciseItemMeta(id,session);const total=sets.reduce((a,x)=>a+(+x.value||0),0);
  if(item.loadType==='band'){
    const weighted=sets.reduce((a,x)=>a+(+x.load||0)*(+x.value||0),0), reps=Math.max(1,total);
    const assist=weighted/reps;return total*(1+clamp((30-assist)/30,0,1)*.5);
  }
  if(item.loadType==='resistance'){
    const loads=sets.map(x=>+x.load||0).filter(Boolean), load=avg(loads)||0;return total*(1+clamp(load/30,0,2)*.25);
  }
  return total;
}
function exerciseChartMetric(id,session) {
  const item=exerciseItemMeta(id,session),sets=session?.logs?.[id]?.sets||[];if(!sets.length)return null;
  const score=exerciseSessionScore(id,session), best=Math.max(...sets.map(x=>+x.value||0));
  const loaded=['band','resistance'].includes(item.loadType);
  // Bei Eigengewichtsübungen ist der beste saubere Satz stabiler vergleichbar als das
  // Gesamtvolumen, weil sich die Satzanzahl zwischen Planversionen ändern kann.
  const comparable=loaded?score/sets.length:best;
  return {value:comparable,score:comparable,label:loaded?'Trendindex / Satz':(item.unit==='s'?'Beste Haltezeit':'Bester Satz')};
}
function exerciseProgressData(id) {
  return logsForExercise(id).map(session=>{const metric=exerciseChartMetric(id,session);return metric?{date:session.date,...metric,session}:null;}).filter(Boolean);
}
function exerciseSummaryText(id,session) {
  const item=exerciseItemMeta(id,session),sets=session?.logs?.[id]?.sets||[];if(!sets.length)return'–';
  const total=sets.reduce((a,x)=>a+(+x.value||0),0),best=Math.max(...sets.map(x=>+x.value||0));
  if(item.loadType==='band'){
    const loads=sets.map(x=>+x.load||0),bestAssist=Math.min(...loads),avgAssist=Math.round(avg(loads));
    return `${total} Wdh · Ø ${avgAssist===0?'ohne Band':avgAssist+' kg Hilfe'}`;
  }
  if(item.loadType==='resistance'){
    const loads=sets.map(x=>+x.load||0).filter(Boolean),load=loads.length?Math.round(avg(loads)):0;
    return `${total} Wdh · Ø ${load} kg`;
  }
  return item.unit==='s'?`${total} s gesamt · ${best} s best`:`${total} Wdh gesamt · ${best} best`;
}
function renderExerciseProgress() {
  const sel=document.getElementById('exerciseStatSelect');if(!sel)return;
  const ids=[...new Set(allWorkoutKeys().flatMap(k=>(workoutTemplate(k).items||[]).filter(i=>!i.special).map(i=>i.id)).concat(sessions().flatMap(s=>Object.keys(s.logs||{}).filter(id=>s.logs[id]?.sets?.length))))];
  if(!ids.length){sel.innerHTML='<option>Keine Übungen</option>';drawChart('exerciseChart',[]);return;}
  if(!activeExerciseStat||!ids.includes(activeExerciseStat))activeExerciseStat=ids.find(id=>logsForExercise(id).length)||ids[0];
  sel.innerHTML=ids.map(id=>`<option value="${id}" ${id===activeExerciseStat?'selected':''}>${escapeHTML(EX[id]?.name||id)}</option>`).join('');
  const data=exerciseProgressData(activeExerciseStat), logs=logsForExercise(activeExerciseStat), last=logs.at(-1), first=data[0], latest=data.at(-1);
  const bestRow=data.length?data.reduce((a,b)=>b.score>a.score?b:a,data[0]):null;
  const pct=first&&latest&&first.score>0?Math.round((latest.score/first.score-1)*100):null;
  document.getElementById('exerciseStatLast').textContent=last?exerciseSummaryText(activeExerciseStat,last):'Noch kein Log';
  document.getElementById('exerciseStatChange').textContent=pct==null?'–':`${pct>=0?'+':''}${pct}%`;
  document.getElementById('exerciseStatBest').textContent=bestRow?exerciseSummaryText(activeExerciseStat,bestRow.session):'–';
  const badge=document.getElementById('exerciseTrendBadge');if(badge)badge.textContent=pct==null?'SAMMELN':pct>5?'AUFWÄRTS':pct<-5?'RÜCKGANG':'STABIL';
  const label=data.at(-1)?.label||'Leistung';
  drawChart('exerciseChart',data.length?[{name:label,data:data.map(x=>({date:x.date,value:x.value}))}]:[] ,{legend:data.length>0});
  const hint=document.getElementById('exerciseChartHint');if(hint){
    const item=last?exerciseItemMeta(activeExerciseStat,last):exerciseItemMeta(activeExerciseStat);
    hint.textContent=['band','resistance'].includes(item?.loadType)
      ? 'Trendindex berücksichtigt Wiederholungen und Hilfe/Widerstand. Höher bedeutet eine stärkere Einheit; Rohwerte stehen direkt darüber.'
      : item?.unit==='s'?'Diagramm zeigt deine beste saubere Haltezeit je Einheit.':'Diagramm zeigt deinen besten sauberen Satz je Einheit – dadurch bleibt der Vergleich auch bei geänderter Satzanzahl fair.';
  }
}

function localMaintenanceEstimate() {
  const p=state.profile||{},w=Math.max(40,+latestWeight()||+p.startWeight||75),h=Math.max(140,+p.height||175),age=Math.max(16,+p.age||30);
  const bmr=10*w+6.25*h-5*age+(p.sex==='f'?-161:5);const mult={low:1.35,sedentary:1.35,mixed:1.5,active:1.65}[p.activity]||1.5;return Math.round(bmr*mult/10)*10;
}
function calorieDataContext() {
  const days=Array.from({length:14},(_,i)=>addDaysKey(localDateKey(),-i));const logged=days.filter(d=>(state.meals[d]||[]).length);const cals=logged.map(d=>mealTotals(d).calories);const wNow=movingAverageWeight(),wPrev=movingAverageWeight(addDaysKey(localDateKey(),-7));
  return {localMaintenanceEstimate:localMaintenanceEstimate(),loggedDays:logged.length,averageCalories:avg(cals),weight7d:wNow,weightPrev7d:wPrev,weeklyChange:wNow!=null&&wPrev!=null?wNow-wPrev:null};
}
function renderCalorieSettings() {
  const src=state.settings.calorieSource||'onboarding', badge=document.getElementById('calorieSourceBadge');if(badge){badge.textContent=src==='ai'?'KI':src==='manual'?'MANUELL':'STARTWERT';}
  const calories=Math.round(+state.settings.calories||0), maintenance=state.settings.maintenanceCalories?Math.round(state.settings.maintenanceCalories):null;
  const val=document.getElementById('calorieReferenceValue');if(val)val.textContent=`${calories} kcal`;
  const title=document.getElementById('calorieReferenceTitle');if(title)title.textContent=maintenance?`Tagesziel · Erhalt ca. ${maintenance} kcal`:'Aktuelles Tagesziel';
  const text=document.getElementById('calorieReferenceText');if(text)text.textContent=src==='ai'?(maintenance?`Gemini hat Erhalt und Ziel anhand deiner verfügbaren Profil- und Verlaufsdaten geschätzt. ${calories} kcal werden appweit als Tagesreferenz verwendet.`:`Gemini-Schätzung: ${calories} kcal werden appweit als Tagesreferenz verwendet.`):src==='manual'?`Manuell festgelegt: ${calories} kcal werden appweit als Tagesreferenz genutzt.${maintenance?` Erhaltungsbedarf: ca. ${maintenance} kcal.`:''}`:`Startwert aus deinem Onboarding. Du kannst ihn manuell ersetzen oder mit Gemini anhand echter Verlaufsdaten neu schätzen lassen.`;
  const input=document.getElementById('manualCaloriesInput');if(input&&document.activeElement!==input)input.value=calories;
  const maintenanceInput=document.getElementById('manualMaintenanceInput');if(maintenanceInput&&document.activeElement!==maintenanceInput)maintenanceInput.value=maintenance||'';
}
function applyCalorieReference(calories,source='manual',maintenance=null) {
  const cal=clamp(Math.round(+calories||0),1000,6000);if(!cal)return;
  state.settings.calories=cal;state.settings.calorieSource=source;state.settings.maintenanceCalories=maintenance?Math.round(maintenance):state.settings.maintenanceCalories||null;
  const p=+state.settings.protein||150,f=+state.settings.fat||65;state.settings.carbs=Math.max(50,Math.round((cal-p*4-f*9)/4));saveState();renderCalorieSettings();renderFoodTrend();
}
async function runAiCalorieEstimate() {
  const panel=document.getElementById('aiCaloriePanel'),answer=document.getElementById('aiCalorieAnswer'),actions=document.getElementById('aiCalorieActions');panel.classList.remove('hidden');actions.classList.add('hidden');
  if(!hasGeminiKey()){answer.textContent='Gemini-Key fehlt. Unter KI Coach eintragen – oder den Wert direkt manuell setzen.';return;}
  const ctx=calorieDataContext(), p=state.profile;
  answer.textContent='Gemini prüft Profil, Aktivität, Gewichtstrend und geloggte Kalorien …';
  const prompt=`Schätze für eine Fitness-App den täglichen Erhaltungsbedarf und ein sinnvolles Kalorienziel. Antworte ausschließlich als JSON: {"maintenanceCalories":2600,"targetCalories":2300,"reason":"maximal 2 kurze Sätze"}. Verwende die lokale Mifflin-Schätzung als Plausibilitätsanker, aber berücksichtige echte 14-Tage-Daten, falls ausreichend vorhanden. Keine aggressive Diät: bei goalMode cut typischerweise moderates Defizit, recomp nahe Erhaltung/kleines Defizit, gain kleiner Überschuss. Erfinde keine Aktivitätsdaten.\nPROFIL:${JSON.stringify({age:p.age,sex:p.sex,height:p.height,weight:latestWeight(),activity:p.activity,goalMode:p.goalMode,trainingDays:p.trainingDays,sleep:p.sleepBaseline})}\nVERLAUF:${JSON.stringify(ctx)}`;
  try{const raw=await geminiGenerate(prompt,{maxTokens:260});const d=extractGeminiJSON(raw);const maintenance=clamp(+d.maintenanceCalories||ctx.localMaintenanceEstimate,1200,6000),target=clamp(+d.targetCalories||maintenance,1000,6000);pendingAiCalories={maintenance,target,reason:String(d.reason||'')};answer.innerHTML=`<b>Erhalt geschätzt: ${Math.round(maintenance)} kcal</b><br><b>Empfohlenes App-Ziel: ${Math.round(target)} kcal</b><br><span>${escapeHTML(pendingAiCalories.reason)}</span>`;actions.classList.remove('hidden');state.ai.calories={...pendingAiCalories,at:Date.now()};saveState(false);}catch(e){answer.textContent=e.message||'Kalorien-Schätzung fehlgeschlagen.';}
}

function initV52Controls() {
  document.getElementById('newTrainingDayBtn')?.addEventListener('click',openNewTrainingDayChooser);
  document.getElementById('closePlanEditor')?.addEventListener('click',closePlanEditor);
  document.getElementById('planEditorOverlay')?.addEventListener('click',e=>{if(e.target.id==='planEditorOverlay')closePlanEditor();});
  document.querySelectorAll('[data-food-stat]').forEach(btn=>btn.addEventListener('click',()=>{activeFoodStat=btn.dataset.foodStat;document.querySelectorAll('[data-food-stat]').forEach(x=>x.classList.toggle('active',x===btn));renderFoodTrend();}));
  document.getElementById('exerciseStatSelect')?.addEventListener('change',e=>{activeExerciseStat=e.target.value;renderExerciseProgress();});
  document.getElementById('manualCaloriesBtn')?.addEventListener('click',()=>{document.getElementById('manualCaloriesPanel').classList.toggle('hidden');document.getElementById('aiCaloriePanel').classList.add('hidden');});
  document.getElementById('aiCalorieEstimateBtn')?.addEventListener('click',()=>{document.getElementById('manualCaloriesPanel').classList.add('hidden');runAiCalorieEstimate();});
  document.getElementById('saveManualCalories')?.addEventListener('click',()=>applyCalorieReference(document.getElementById('manualCaloriesInput').value,'manual',document.getElementById('manualMaintenanceInput')?.value||null));
  document.getElementById('acceptAiCalories')?.addEventListener('click',()=>{if(pendingAiCalories)applyCalorieReference(pendingAiCalories.target,'ai',pendingAiCalories.maintenance);});
}

function renderAllDerived() {
  renderDashboard(); renderMeals(); renderVacation(); renderStats(); renderActivity(); applyPreferences(); renderSkills(); renderRoadmap(); renderPhotos(); renderProfileSettings(); renderTrainingHistory(); renderTrainingPlanManager(); renderFoodTrend(); renderExerciseProgress(); renderCalorieSettings(); renderGeminiUI(); renderAiMealEntryUI();
}
function restoreActiveSession() {
  if (!state.activeSession) return false;
  const a = state.activeSession;
  guided = {
    key: a.key,
    date: a.date || localDateKey(),
    template: clone(a.template || workoutTemplate(a.key, a.date || localDateKey())),
    itemIndex: a.itemIndex || 0,
    setIndex: a.setIndex || 0,
    logs: a.logs || {},
    aiFeedback: a.aiFeedback || {},
    startedAt: a.startedAt || new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
    completed: false
  };
  selectedWorkout = a.key || selectedWorkout;
  return true;
}

function renderAll() {
  migrateLegacyPhotos().then(()=>renderPhotos()).catch(()=>{});
  clearStaleActiveSession();
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

function switchView(id, skipGuard=false, record=true) {
  if (!document.getElementById(id)?.matches('[data-view]')) return;
  if(record && location.hash!=='#'+id)history.pushState({view:id},'', '#'+id);
  if (id !== 'train') document.body.classList.remove('workout-mode');
  if (id === 'train' && !state.activeSession && planForDate().type !== 'workout') manualWorkoutMode = false;
  document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.target===id || (b.dataset.target==='settings' && ['preferences','skills','roadmap','exercises'].includes(id))));
  if(id==='stats') setTimeout(()=>{renderStats();drawCharts();renderExerciseProgress();},30);
  if(id==='food') setTimeout(renderFoodTrend,30);
  if(id==='train'){renderWorkoutTabs();renderTrainingOverview();renderTrainingHistory();renderTrainingPlanManager();}
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.nav-btn').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.target));
document.querySelectorAll('[data-nav]').forEach(btn=>btn.onclick=()=>switchView(btn.dataset.nav));

function initStatsTabs(){
  document.querySelectorAll('[data-stat-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.statTab;
    document.querySelectorAll('[data-stat-tab]').forEach(x=>x.classList.toggle('active',x===btn));
    document.querySelectorAll('[data-stat-panel]').forEach(p=>p.classList.toggle('active',p.dataset.statPanel===key));
    setTimeout(drawCharts,30);
  }));
}
initStatsTabs();

document.getElementById('openTodayWorkout').onclick=()=>{if(!dailyCheckComplete()){startDailyCheck({action:'todayWorkout'});return;}startTodayWorkoutAfterCheck();};
document.getElementById('quickHandstandBtn').onclick=startHandstandSession;
document.getElementById('startSkillTimer').onclick=startHandstandSession;
document.getElementById('measureWaistNow').onclick=()=>{switchView('stats');setTimeout(()=>document.getElementById('wWaist').focus(),350);};

async function exportBackup() {
  let photoBlobs=[];
  try{photoBlobs=await photoGetAll();}catch(e){console.warn('Fotos konnten nicht ins Backup aufgenommen werden',e);}
  const backup={...state,photoBlobs};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`calisthenics-coach-v5-native-minimal-${localDateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
document.getElementById('exportBtn').onclick=exportBackup;
document.getElementById('importFile').onchange=importBackupFile;
document.getElementById('resetBtn').onclick=async()=>{if(confirm('Wirklich ALLE lokalen App-Daten inklusive Fotos löschen?')){try{await photoClear();}catch(e){}localStorage.removeItem(STORE_KEY);localStorage.removeItem(GEMINI_KEY_STORE);state=clone(defaultState);saveState(false);location.reload();}};

let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.getElementById('installBtn').classList.remove('hidden');});
document.getElementById('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').classList.add('hidden');};
if('serviceWorker'in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn));
function updateOnline(){const b=document.getElementById('onlineBadge');b.textContent=navigator.onLine?'online':'offline';b.classList.toggle('offline',!navigator.onLine)}
window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);


// ---------- V4 Guided Experience ----------
let guidedFlow = { type:null, step:0, data:{}, pending:null, editing:false };

function dailyCheckComplete(key = localDateKey()) {
  const d = state.daily[key] || {};
  return d.sleep != null && d.energy != null && d.elbow != null && d.shoulder != null;
}

function calculateNutritionTargets(profile) {
  const w = Math.max(40, +profile.startWeight || 75);
  const h = Math.max(140, +profile.height || 175);
  const age = Math.max(16, +profile.age || 30);
  const sexConst = profile.sex === 'f' ? -161 : 5;
  const bmr = 10*w + 6.25*h - 5*age + sexConst;
  const activityFactor = profile.activity === 'active' ? 1.65 : profile.activity === 'low' ? 1.35 : 1.5;
  const tdee = bmr * activityFactor;
  const adjustment = profile.goalMode === 'cut' ? -350 : profile.goalMode === 'gain' ? 200 : -150;
  const calories = Math.max(1500, Math.round((tdee + adjustment) / 50) * 50);
  const protein = Math.round((w * (profile.goalMode === 'gain' ? 1.8 : 2.0)) / 5) * 5;
  const fat = Math.round(Math.max(55, w * 0.8) / 5) * 5;
  const carbs = Math.max(100, Math.round(((calories - protein*4 - fat*9) / 4) / 5) * 5);
  return { calories, protein, fat, carbs, fiber:30, creatine:5 };
}

function guidedProgress(percent) {
  const bar=document.getElementById('guidedProgressBar');
  if(bar) bar.style.width=`${clamp(percent,0,100)}%`;
}
function showGuidedOverlay() { document.getElementById('guidedOverlay').classList.remove('hidden'); document.body.classList.add('flow-open'); }
function hideGuidedOverlay() { document.getElementById('guidedOverlay').classList.add('hidden'); document.body.classList.remove('flow-open'); }
function flowBody(html) { document.getElementById('guidedFlowBody').innerHTML=html; }
function setFlowChrome({back=false,close=false,progress=0}={}) {
  document.getElementById('guidedBack').classList.toggle('hidden',!back);
  document.getElementById('guidedClose').classList.toggle('hidden',!close);
  guidedProgress(progress);
}
function optionButton(value,label,sub='') { return `<button class="flow-option" type="button" data-flow-value="${value}"><b>${label}</b>${sub?`<small>${sub}</small>`:''}</button>`; }
function flowHeader(kicker,title,text='') { return `<div class="flow-kicker">${kicker}</div><h2 id="guidedTitle">${title}</h2>${text?`<p class="flow-copy">${text}</p>`:''}`; }

function onboardingSeed(editing=false) {
  const s=latestStrength();
  if(editing) return {
    name:state.profile.name||'', age:state.profile.age||30, sex:state.profile.sex||'m', height:state.profile.height||175,
    weight:latestWeight()||state.profile.startWeight||75, priority:state.profile.priority||'strength', goalMode:state.profile.goalMode||'recomp',
    pullups:+s.pullups||0,dips:+s.dips||0,pushups:+s.pushups||0,handstand:+s.handstand||0,
    trainingDays:+state.profile.trainingDays||3,bands:[...(state.profile.bands||[])],activity:state.profile.activity||'mixed',
    sleep:+parseFloat(state.profile.sleepBaseline)||7, halal:!!state.profile.diet?.halal,lactoseFree:!!state.profile.diet?.lactoseFree,vegetarian:!!state.profile.diet?.vegetarian
  };
  return {name:'',age:30,sex:'m',height:175,weight:75,priority:'strength',goalMode:'recomp',pullups:0,dips:0,pushups:0,handstand:0,trainingDays:3,bands:[10,20,30],activity:'mixed',sleep:7,halal:false,lactoseFree:false,vegetarian:false};
}

function startOnboarding(editing=false) {
  guidedFlow={type:'onboarding',step:0,data:onboardingSeed(editing),pending:null,editing};
  showGuidedOverlay(); renderOnboarding();
}

function renderOnboarding() {
  const d=guidedFlow.data, step=guidedFlow.step, total=9;
  setFlowChrome({back:step>0,close:guidedFlow.editing,progress:(step/total)*100});
  if(step===0){
    flowBody(`<div class="flow-center">${flowHeader('Willkommen','Dein Coach startet bei null','Einmal kurz einrichten. Danach führt dich die App jeden Tag Schritt für Schritt durch Check, Training und Essen.')}<div class="flow-feature-list"><span>✓ persönlicher Trainingsstart</span><span>✓ eigene Kalorien- & Proteinziele</span><span>✓ Daten bleiben nur auf diesem Gerät</span></div><button id="flowNext" class="primary full" type="button">Los geht’s</button></div>`);
    document.getElementById('flowNext').onclick=()=>{guidedFlow.step++;renderOnboarding();}; return;
  }
  if(step===1){
    flowBody(`${flowHeader('1 von 8','Wie soll ich dich nennen?','Nur für die Ansprache in deiner App.')}<label class="flow-label">Name<input id="flowName" class="flow-input" value="${escapeHTML(d.name||'')}" placeholder="z. B. Ali"></label><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.getElementById('flowNext').onclick=()=>{d.name=document.getElementById('flowName').value.trim()||'Athlet';guidedFlow.step++;renderOnboarding();}; return;
  }
  if(step===2){
    flowBody(`${flowHeader('2 von 8','Deine Basisdaten','Damit Ernährung und Belastung nicht pauschal für alle gleich sind.')}<div class="flow-grid"><label class="flow-label">Alter<input id="flowAge" class="flow-input" type="number" min="18" max="90" value="${d.age}"></label><label class="flow-label">Größe cm<input id="flowHeight" class="flow-input" type="number" min="140" max="220" value="${d.height}"></label><label class="flow-label">Gewicht kg<input id="flowWeight" class="flow-input" type="number" min="40" max="250" step="0.1" value="${d.weight}"></label></div><div class="flow-question">Geschlecht für die Kalorien-Schätzung</div><div class="flow-options two">${optionButton('m','Männlich')}${optionButton('f','Weiblich')}</div><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.querySelectorAll('[data-flow-value]').forEach(b=>{if(b.dataset.flowValue===d.sex)b.classList.add('selected');b.onclick=()=>{d.sex=b.dataset.flowValue;document.querySelectorAll('[data-flow-value]').forEach(x=>x.classList.toggle('selected',x===b));};});
    document.getElementById('flowNext').onclick=()=>{d.age=+document.getElementById('flowAge').value||30;d.height=+document.getElementById('flowHeight').value||175;d.weight=+document.getElementById('flowWeight').value||75;guidedFlow.step++;renderOnboarding();};return;
  }
  if(step===3){
    flowBody(`${flowHeader('3 von 8','Was ist gerade dein Hauptziel?','Du kannst später alles ändern. Der Startpunkt bestimmt vor allem Kalorien und Prioritäten.')}<div class="flow-options">${optionButton('cut','Leaner / shredded','Fett runter, Kraft halten/steigern')}${optionButton('recomp','Stärker + gleichzeitig leaner','langsamer, sehr alltagstauglich')}${optionButton('gain','Muskeln & Kraft aufbauen','kleiner kontrollierter Überschuss')}</div><div class="flow-question">Was ist dir am wichtigsten?</div><div class="flow-options two compact">${optionButton('strength','Kraft')}${optionButton('muscle','Muskeln')}${optionButton('skills','Skills')}${optionButton('look','Optik')}</div><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.querySelectorAll('[data-flow-value]').forEach(b=>{const v=b.dataset.flowValue;if(v===d.goalMode||v===d.priority)b.classList.add('selected');b.onclick=()=>{if(['cut','recomp','gain'].includes(v)){d.goalMode=v;document.querySelectorAll('[data-flow-value="cut"],[data-flow-value="recomp"],[data-flow-value="gain"]').forEach(x=>x.classList.toggle('selected',x===b));}else{d.priority=v;document.querySelectorAll('[data-flow-value="strength"],[data-flow-value="muscle"],[data-flow-value="skills"],[data-flow-value="look"]').forEach(x=>x.classList.toggle('selected',x===b));}};});
    document.getElementById('flowNext').onclick=()=>{guidedFlow.step++;renderOnboarding();};return;
  }
  if(step===4){
    flowBody(`${flowHeader('4 von 8','Wo stehst du heute?','Nur saubere Wiederholungen zählen. Wenn du etwas noch nie probiert hast: 0.')}<div class="flow-grid"><label class="flow-label">Pull-ups<input id="flowPull" class="flow-input" type="number" min="0" value="${d.pullups}"></label><label class="flow-label">Dips<input id="flowDips" class="flow-input" type="number" min="0" value="${d.dips}"></label><label class="flow-label">Push-ups<input id="flowPush" class="flow-input" type="number" min="0" value="${d.pushups}"></label><label class="flow-label">Freier Handstand s<input id="flowHs" class="flow-input" type="number" min="0" value="${d.handstand}"></label></div><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.getElementById('flowNext').onclick=()=>{d.pullups=+document.getElementById('flowPull').value||0;d.dips=+document.getElementById('flowDips').value||0;d.pushups=+document.getElementById('flowPush').value||0;d.handstand=+document.getElementById('flowHs').value||0;guidedFlow.step++;renderOnboarding();};return;
  }
  if(step===5){
    flowBody(`${flowHeader('5 von 8','Wie kannst du trainieren?','Der Plan bleibt simpel: zwei Haupttage, ein optionaler dritter Tag.')}<div class="flow-question">Realistische Krafttage pro Woche</div><div class="flow-options two">${optionButton('2','2 Tage','Haupttage')}${optionButton('3','3 Tage','+ optionaler Volumentag')}</div><div class="flow-question">Welche Pull-up-Bänder hast du?</div><div class="flow-checks"><label><input type="checkbox" value="10" ${d.bands.includes(10)?'checked':''}>10 kg</label><label><input type="checkbox" value="20" ${d.bands.includes(20)?'checked':''}>20 kg</label><label><input type="checkbox" value="30" ${d.bands.includes(30)?'checked':''}>30 kg</label></div><p class="flow-note">Keine Bänder? Kein Problem: Dann startet die App mit kontrollierten negativen Pull-ups.</p><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.querySelectorAll('[data-flow-value]').forEach(b=>{if(+b.dataset.flowValue===d.trainingDays)b.classList.add('selected');b.onclick=()=>{d.trainingDays=+b.dataset.flowValue;document.querySelectorAll('[data-flow-value]').forEach(x=>x.classList.toggle('selected',x===b));};});
    document.getElementById('flowNext').onclick=()=>{d.bands=[...document.querySelectorAll('.flow-checks input:checked')].map(x=>+x.value);guidedFlow.step++;renderOnboarding();};return;
  }
  if(step===6){
    flowBody(`${flowHeader('6 von 8','Dein Alltag & Schlaf','Das beeinflusst, wie aggressiv Training und Ernährung sein dürfen.')}<div class="flow-options">${optionButton('low','Eher sitzend','wenig Bewegung außerhalb Training')}${optionButton('mixed','Gemischt','Sitzen + Gehen / normal aktiv')}${optionButton('active','Sehr aktiv','körperliche Arbeit / viel Bewegung')}</div><label class="flow-label">Typischer Schlaf pro Nacht<input id="flowSleep" class="flow-input" type="number" min="3" max="10" step="0.5" value="${d.sleep}"></label><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.querySelectorAll('[data-flow-value]').forEach(b=>{if(b.dataset.flowValue===d.activity)b.classList.add('selected');b.onclick=()=>{d.activity=b.dataset.flowValue;document.querySelectorAll('[data-flow-value]').forEach(x=>x.classList.toggle('selected',x===b));};});
    document.getElementById('flowNext').onclick=()=>{d.sleep=+document.getElementById('flowSleep').value||7;guidedFlow.step++;renderOnboarding();};return;
  }
  if(step===7){
    flowBody(`${flowHeader('7 von 8','Ernährung','Damit Vorschläge zu deinem Alltag passen.')}<div class="flow-checks vertical"><label><input id="flowHalal" type="checkbox" ${d.halal?'checked':''}>Halal</label><label><input id="flowLactose" type="checkbox" ${d.lactoseFree?'checked':''}>Laktosefrei / Laktoseintoleranz</label><label><input id="flowVeg" type="checkbox" ${d.vegetarian?'checked':''}>Vegetarisch</label></div><button id="flowNext" class="primary full" type="button">Weiter</button>`);
    document.getElementById('flowNext').onclick=()=>{d.halal=document.getElementById('flowHalal').checked;d.lactoseFree=document.getElementById('flowLactose').checked;d.vegetarian=document.getElementById('flowVeg').checked;guidedFlow.step++;renderOnboarding();};return;
  }
  const targets=calculateNutritionTargets({age:d.age,sex:d.sex,height:d.height,startWeight:d.weight,activity:d.activity,goalMode:d.goalMode});
  flowBody(`${flowHeader('8 von 8','Dein Start ist bereit',`${escapeHTML(d.name||'Athlet')}, daraus baut die App deinen persönlichen Startpunkt.`)}<div class="flow-summary"><div><span>Kalorien</span><b>${targets.calories} kcal</b></div><div><span>Protein</span><b>${targets.protein} g</b></div><div><span>Pull-ups</span><b>${d.pullups}</b></div><div><span>Training</span><b>${d.trainingDays} Tage</b></div></div><p class="flow-note">Das sind Startwerte, keine ewigen Regeln. Gewichtstrend, Leistung und Recovery entscheiden später über Anpassungen.</p><button id="flowSaveProfile" class="primary full" type="button">Profil speichern & Tagescheck starten</button>`);
  document.getElementById('flowSaveProfile').onclick=()=>saveOnboardingProfile(targets);
}

function saveOnboardingProfile(targets) {
  const d=guidedFlow.data;
  const priorityLabel={strength:'Kraft',muscle:'Muskeln',skills:'Skills',look:'Optik'}[d.priority]||'Kraft';
  state.profile={...state.profile,onboardingComplete:true,name:d.name||'Athlet',age:d.age,sex:d.sex,height:d.height,startWeight:d.weight,bands:d.bands,sleepBaseline:String(d.sleep),activity:d.activity,goalMode:d.goalMode,trainingDays:d.trainingDays,priority:d.priority,diet:{halal:d.halal,lactoseFree:d.lactoseFree,vegetarian:d.vegetarian},goal:`${priorityLabel} → Skills → langfristig athletisch`};
  state.settings={...state.settings,...targets,vacation:false};
  const test={date:localDateKey(),pullups:d.pullups,dips:d.dips,pushups:d.pushups,handstand:d.handstand,hang:0,hspu:0};
  state.strengthTests=state.strengthTests.filter(x=>x.date!==test.date); state.strengthTests.push(test);
  state.daily[localDateKey()]={...(state.daily[localDateKey()]||{}),weight:d.weight};
  saveState(false); renderAll();
  guidedFlow={type:null,step:0,data:{},pending:null,editing:false};
  startDailyCheck();
}

function startDailyCheck(pending=null) {
  const old=state.daily[localDateKey()]||{};
  guidedFlow={type:'daily',step:0,data:{sleep:old.sleep??'',energy:old.energy??3,elbow:old.elbow??0,shoulder:old.shoulder??0,weight:old.weight??latestWeight()??'',creatine:!!old.creatine},pending,editing:false};
  showGuidedOverlay(); renderDailyFlow();
}

function renderDailyFlow() {
  const d=guidedFlow.data, step=guidedFlow.step, total=6;
  setFlowChrome({back:step>0&&step<5,close:dailyCheckComplete()&&step<5,progress:(step/5)*100});
  if(step===0){flowBody(`${flowHeader('Tagescheck 1/5','Wie viel hast du geschlafen?','Das entscheidet heute über Normal, Light oder Reduced.')}<label class="flow-label">Stunden<input id="dailySleepFlow" class="flow-input flow-big-input" type="number" min="2" max="12" step="0.1" inputmode="decimal" value="${d.sleep}"></label><button id="flowNext" class="primary full" type="button">Weiter</button>`);document.getElementById('flowNext').onclick=()=>{const v=+document.getElementById('dailySleepFlow').value;if(!v)return;d.sleep=v;guidedFlow.step++;renderDailyFlow();};return;}
  if(step===1){flowBody(`${flowHeader('Tagescheck 2/5','Wie ist deine Energie?','Nicht Motivation – wie leistungsfähig fühlst du dich körperlich?')}<div class="flow-energy">${[1,2,3,4,5].map(v=>optionButton(v,String(v),v===1?'leer':v===3?'normal':v===5?'sehr fit':'')).join('')}</div>`);document.querySelectorAll('[data-flow-value]').forEach(b=>{if(+b.dataset.flowValue===+d.energy)b.classList.add('selected');b.onclick=()=>{d.energy=+b.dataset.flowValue;guidedFlow.step++;renderDailyFlow();};});return;}
  if(step===2){flowBody(`${flowHeader('Tagescheck 3/5','Ellenbogen heute?','0 = nichts. 10 = sehr starker Schmerz.')}<input id="dailyElbowFlow" class="flow-range" type="range" min="0" max="10" step="1" value="${d.elbow}"><div class="flow-range-value"><b id="dailyElbowValue">${d.elbow}</b><span>/ 10</span></div><button id="flowNext" class="primary full" type="button">Weiter</button>`);const r=document.getElementById('dailyElbowFlow');r.oninput=()=>document.getElementById('dailyElbowValue').textContent=r.value;document.getElementById('flowNext').onclick=()=>{d.elbow=+r.value;guidedFlow.step++;renderDailyFlow();};return;}
  if(step===3){flowBody(`${flowHeader('Tagescheck 4/5','Schulter heute?','0 = nichts. Bei deutlicherem Schmerz reduziert die App automatisch.')}<input id="dailyShoulderFlow" class="flow-range" type="range" min="0" max="10" step="1" value="${d.shoulder}"><div class="flow-range-value"><b id="dailyShoulderValue">${d.shoulder}</b><span>/ 10</span></div><button id="flowNext" class="primary full" type="button">Weiter</button>`);const r=document.getElementById('dailyShoulderFlow');r.oninput=()=>document.getElementById('dailyShoulderValue').textContent=r.value;document.getElementById('flowNext').onclick=()=>{d.shoulder=+r.value;guidedFlow.step++;renderDailyFlow();};return;}
  if(step===4){flowBody(`${flowHeader('Tagescheck 5/5','Noch zwei schnelle Dinge','Gewicht ist fürs Trendtracking. Wenn du heute nicht wiegen kannst, lass es leer.')}<label class="flow-label">Gewicht kg<input id="dailyWeightFlow" class="flow-input" type="number" step="0.1" inputmode="decimal" value="${d.weight||''}" placeholder="optional"></label><label class="flow-check-single"><input id="dailyCreatineFlow" type="checkbox" ${d.creatine?'checked':''}>5 g Creatin heute genommen</label><button id="flowNext" class="primary full" type="button">Check auswerten</button>`);document.getElementById('flowNext').onclick=()=>{const w=document.getElementById('dailyWeightFlow').value;d.weight=w===''?null:+w;d.creatine=document.getElementById('dailyCreatineFlow').checked;const key=localDateKey();state.daily[key]={...(state.daily[key]||{}),sleep:d.sleep,energy:d.energy,elbow:d.elbow,shoulder:d.shoulder,weight:d.weight,creatine:d.creatine};saveState(false);renderAllDerived();guidedFlow.step++;renderDailyFlow();};return;}
  const rec=recoveryDecision(); const plan=planForDate();
  const modeTitle=rec.mode==='NORMAL'?'Du kannst normal trainieren':rec.mode==='LIGHT'?'Heute etwas leichter':rec.mode==='REDUCED'?'Heute deutlich reduzieren':rec.mode==='STOP'?'Heute kein schmerzhaftes Oberkörpertraining':'Check erledigt';
  const dailyAiCached=cachedDailyAI();
  flowBody(`<div class="flow-center">${flowHeader('Check fertig',modeTitle,rec.text)}<div class="flow-recovery-badge ${rec.mode.toLowerCase()}">${rec.mode}<b>${rec.score??'–'}</b></div><div class="flow-next-card"><span>Heute geplant</span><b>${plan.title}</b><small>${plan.duration}</small></div>
    <div class="flow-ai-box"><div class="flow-ai-head"><span>Gemini · Tagescoach</span><small>${hasGeminiKey()?'bereit':'optional'}</small></div><p id="dailyFlowAiText">${dailyAiCached?aiTextHTML(dailyAiCached):(hasGeminiKey()?'Gemini kann Schlaf, Energie und Gelenkstatus jetzt direkt einordnen.':'Unter Mehr → Einstellungen einen Gemini-Key hinterlegen. Der normale Recovery-Check funktioniert auch ohne KI.')}</p><button id="dailyFlowAiBtn" class="secondary full" type="button" ${hasGeminiKey()?'':'disabled'}>${dailyAiCached?'KI-Tagesanalyse aktualisieren':'KI-Tagesanalyse'}</button></div>
    <button id="flowFinishDaily" class="primary full" type="button">Weiter</button></div>`);
  document.getElementById('dailyFlowAiBtn')?.addEventListener('click',()=>runDailyAI('dailyFlowAiText',{force:true}));
  if(hasGeminiKey()&&state.settings.aiAutoDaily!==false&&!dailyAiCached)setTimeout(()=>runDailyAI('dailyFlowAiText'),0);
  document.getElementById('flowFinishDaily').onclick=finishDailyFlow;
}

function finishDailyFlow() {
  const pending=guidedFlow.pending; guidedFlow={type:null,step:0,data:{},pending:null,editing:false}; hideGuidedOverlay(); renderAll();
  if(pending?.action==='todayWorkout'){startTodayWorkoutAfterCheck();return;}
  if(pending?.action==='food'){startFoodFlow();return;}
  if(pending?.view){switchView(pending.view,true);return;}
  switchView('today',true);
}

function startTodayWorkoutAfterCheck() {
  if(state.activeSession){selectedWorkout=state.activeSession.key;switchView('train',true);restoreActiveSession();renderTrainingOverview();return;}
  const plan=planForDate(); if(plan.type!=='workout') return; if(workoutDoneDate(localDateKey(),plan.workout)) return;
  selectedWorkout=plan.workout; switchView('train',true); startGuided(plan.workout);
}

function startFoodFlow() {
  guidedFlow={type:'food',step:0,data:{foodId:null,amount:100,query:''},pending:null,editing:false};
  showGuidedOverlay(); renderFoodFlow();
}
function renderFoodFlow() {
  const d=guidedFlow.data;
  setFlowChrome({back:guidedFlow.step===1,close:true,progress:guidedFlow.step===0?15:guidedFlow.step===1?55:100});
  if(guidedFlow.step===0){
    const totals=mealTotals();
    flowBody(`${flowHeader('Essen eintragen','Was hast du gegessen?','Suche ein Lebensmittel. Danach frage ich nur noch die Menge.')}<div class="flow-today-macros"><span><b>${Math.round(totals.calories)}</b> / ${state.settings.calories} kcal</span><span><b>${Math.round(totals.protein)}</b> / ${state.settings.protein} g Protein</span></div><input id="guidedFoodSearch" class="flow-input" type="search" autocomplete="off" placeholder="z. B. Hähnchen, Reis, Ei …"><div id="guidedFoodResults" class="flow-food-results"></div>`);
    const input=document.getElementById('guidedFoodSearch'); const results=document.getElementById('guidedFoodResults');
    const draw=(q='')=>{results.innerHTML=foodSearch(q).slice(0,8).map(f=>`<button type="button" class="flow-food-result" data-food-id="${f.id}"><span><b>${f.name}</b><small>${f.kcal} kcal · ${f.p} g P / 100 ${f.unit||'g'}</small></span><i>+</i></button>`).join('');results.querySelectorAll('[data-food-id]').forEach(b=>b.onclick=()=>{d.foodId=b.dataset.foodId;const food=FOOD_DB.find(x=>x.id===d.foodId);d.amount=food?.portion||100;guidedFlow.step=1;renderFoodFlow();});};
    input.oninput=()=>draw(input.value);draw('');return;
  }
  if(guidedFlow.step===1){
    const food=FOOD_DB.find(x=>x.id===d.foodId); if(!food){guidedFlow.step=0;renderFoodFlow();return;}
    const macros=foodMacros(food,d.amount);
    const quick=[50,100,food.portion||100,200,250].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4);
    flowBody(`${flowHeader('Menge','Wie viel davon?',food.name)}<div class="flow-food-picked"><b>${food.name}</b><small>100 ${food.unit||'g'} = ${food.kcal} kcal · ${food.p} g Protein</small></div><label class="flow-label">Menge<div class="flow-amount"><input id="guidedFoodAmount" class="flow-input flow-big-input" type="number" min="1" value="${d.amount}"><span>${food.unit||'g'}</span></div></label><div class="chip-row">${quick.map(v=>`<button type="button" data-guided-amount="${v}">${v} ${food.unit||'g'}</button>`).join('')}</div><div class="flow-macro-preview"><b id="guidedMacroKcal">${macros.cal} kcal</b><span id="guidedMacroText">${macros.protein} g P · ${macros.carbs} g KH · ${macros.fat} g Fett</span></div><button id="guidedAddFood" class="primary full" type="button">Hinzufügen</button>`);
    const amount=document.getElementById('guidedFoodAmount'); const update=()=>{d.amount=+amount.value||0;const m=foodMacros(food,d.amount);document.getElementById('guidedMacroKcal').textContent=`${m.cal} kcal`;document.getElementById('guidedMacroText').textContent=`${m.protein} g P · ${m.carbs} g KH · ${m.fat} g Fett`;}; amount.oninput=update;document.querySelectorAll('[data-guided-amount]').forEach(b=>b.onclick=()=>{amount.value=b.dataset.guidedAmount;update();});
    document.getElementById('guidedAddFood').onclick=()=>{if(d.amount<=0)return;addFoodEntry(food,d.amount);guidedFlow.step=2;renderFoodFlow();};return;
  }
  const totals=mealTotals(); const analysis=foodCoachAnalysis(totals); const foodAiCached=cachedFoodAI();
  flowBody(`<div class="flow-center">${flowHeader('Gespeichert',analysis.title,analysis.text)}<div class="flow-summary"><div><span>Heute kcal</span><b>${Math.round(totals.calories)} / ${state.settings.calories}</b></div><div><span>Protein</span><b>${Math.round(totals.protein)} / ${state.settings.protein} g</b></div><div><span>KH</span><b>${Math.round(totals.carbs)} g</b></div><div><span>Fett</span><b>${Math.round(totals.fat)} g</b></div></div>
    <div class="flow-ai-box"><div class="flow-ai-head"><span>Gemini · Ernährung</span><small>${hasGeminiKey()?'bereit':'optional'}</small></div><p id="foodFlowAiText">${foodAiCached?aiTextHTML(foodAiCached):(hasGeminiKey()?'Gemini kann dir jetzt sagen, was heute noch sinnvoll fehlt.':'Unter Mehr → Einstellungen einen Gemini-Key hinterlegen. Die normalen Makro-Empfehlungen bleiben immer verfügbar.')}</p><button id="foodFlowAiBtn" class="secondary full" type="button" ${hasGeminiKey()?'':'disabled'}>${foodAiCached?'KI-Tipp aktualisieren':'KI-Tipp zu heute'}</button></div>
    <div class="flow-actions"><button id="flowFoodMore" class="secondary" type="button">Noch etwas</button><button id="flowFoodDone" class="primary" type="button">Fertig</button></div></div>`);
  document.getElementById('foodFlowAiBtn')?.addEventListener('click',()=>runFoodAI('foodFlowAiText',{force:true}));
  if(hasGeminiKey()&&state.settings.aiAutoFood!==false&&!foodAiCached)setTimeout(()=>runFoodAI('foodFlowAiText'),0);
  document.getElementById('flowFoodMore').onclick=()=>{guidedFlow.step=0;guidedFlow.data={foodId:null,amount:100,query:''};renderFoodFlow();};
  document.getElementById('flowFoodDone').onclick=()=>{hideGuidedOverlay();guidedFlow={type:null,step:0,data:{},pending:null,editing:false};switchView('food',true);};
}

function renderProfileSettings() {
  const p=state.profile||{}, diet=[];
  if(p.diet?.halal) diet.push('halal'); if(p.diet?.lactoseFree) diet.push('laktosefrei'); if(p.diet?.vegetarian) diet.push('vegetarisch');
  const goalMode={cut:'Cut / leaner',recomp:'Recomp',gain:'Aufbau'}[p.goalMode]||'Recomp';
  const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val;};
  set('settingCalories',`${state.settings.calories} kcal`);set('settingProtein',`${state.settings.protein}+ g`);set('settingCreatine',`${state.settings.creatine||5} g täglich`);
  set('settingBands',(p.bands||[]).length?(p.bands||[]).join(' · ')+' kg':'keine · Negative Pull-ups');set('settingTrainingDays',`${p.trainingDays||3} Tage / Woche`);set('settingSleep',`${p.sleepBaseline||'–'} h`);
  set('profileSummary',`${p.age||'–'} · ${p.sex==='f'?'weiblich':'männlich'} · ${p.height||'–'} cm`);set('profileStart',`${fmt(latestWeight())} kg`);set('profileGoal',p.goal||'Kraft & Skills');set('profileDiet',diet.join(' · ')||'keine Vorgaben');set('profilePhase',goalMode);
  set('roadmapSleepText',`Typischer Schlaf ${p.sleepBaseline||'–'} h: Volumen und Intensität werden über den täglichen Check angepasst.`);
  set('todayCaloriesGoal',`/ ${state.settings.calories} kcal`);set('todayProteinGoal',`/ ${state.settings.protein} g Protein`);
}

function initGuidedExperience() {
  document.getElementById('guidedBack').onclick=()=>{
    if(guidedFlow.type==='onboarding'&&guidedFlow.step>0){guidedFlow.step--;renderOnboarding();}
    else if(guidedFlow.type==='daily'&&guidedFlow.step>0&&guidedFlow.step<5){guidedFlow.step--;renderDailyFlow();}
    else if(guidedFlow.type==='food'&&guidedFlow.step===1){guidedFlow.step=0;renderFoodFlow();}
  };
  document.getElementById('guidedClose').onclick=()=>{if(guidedFlow.type==='onboarding'&&!guidedFlow.editing)return;hideGuidedOverlay();guidedFlow={type:null,step:0,data:{},pending:null,editing:false};};
  document.getElementById('guidedCheckBtn').onclick=()=>startDailyCheck();
  document.getElementById('guidedFoodBtn').onclick=()=>{if(!dailyCheckComplete())startDailyCheck({action:'food'});else startFoodFlow();};
  document.getElementById('editProfileBtn').onclick=()=>startOnboarding(true);
  document.getElementById('newProfileBtn').onclick=async()=>{if(confirm('Neues Profil starten? Alle Daten auf diesem Gerät werden gelöscht.')){try{await photoClear();}catch(e){}localStorage.removeItem(STORE_KEY);localStorage.removeItem(GEMINI_KEY_STORE);state=clone(defaultState);location.reload();}};
  if(!state.profile?.onboardingComplete){startOnboarding(false);return;}
  if(!dailyCheckComplete()) startDailyCheck();
}

renderAll();
initGuidedExperience();


// ---------- V5 Native Minimal · contextual Bring-your-own Gemini AI + natural language food logging ----------
const aiBusy = new Set();
let aiMealDraft = { original:'', answers:[], lastBatchId:null };
function geminiKey() { return (localStorage.getItem(GEMINI_KEY_STORE) || '').trim(); }
function hasGeminiKey() { return state.settings.aiEnabled !== false && geminiKey().length >= 20; }
function escapeHTML(value='') { return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function aiTextHTML(text='') { return escapeHTML(text).replace(/\n/g,'<br>'); }
function setAIElement(id, text, type='answer') {
  const el=document.getElementById(id); if(!el)return;
  el.classList.remove('loading','error','hidden');
  if(type==='loading'){el.classList.add('loading');el.textContent=text;return;}
  if(type==='error'){el.classList.add('error');el.textContent=text;return;}
  el.innerHTML=aiTextHTML(text);
}
function setTimerCoachLine(text='',type='answer'){
  const el=document.getElementById('timerCoachLine'); if(!el)return;
  if(!text){el.className='timer-coach-line hidden';el.textContent='';return;}
  el.className=`timer-coach-line ${type==='loading'?'loading':type==='error'?'error':''}`;el.innerHTML=type==='answer'?aiTextHTML(text):escapeHTML(text);
}

function renderGeminiUI() {
  const connected = hasGeminiKey();
  const input = document.getElementById('geminiApiKey');
  if (input && document.activeElement !== input) input.value = connected ? geminiKey() : '';
  const badge = document.getElementById('geminiConnectionBadge');
  if (badge) { badge.textContent = connected ? 'BEREIT' : 'NICHT VERBUNDEN'; badge.className = `mode-badge ${connected ? '' : 'light'}`; }
  const coachBadge = document.getElementById('aiCoachStatus');
  if (coachBadge) { coachBadge.textContent = connected ? 'BEREIT' : 'AUS'; coachBadge.className = `mode-badge ${connected ? '' : 'light'}`; }
  const hint = document.getElementById('aiCoachHint');
  if (hint) hint.textContent = connected
    ? 'Gemini ist nicht nur Chat: Tagescheck, Training und Essen können direkt im jeweiligen Ablauf analysiert werden.'
    : 'Optional: Hinterlege unter Mehr deinen eigenen Gemini-Key. Ohne Key funktioniert die App vollständig weiter.';
  const toggles={aiAutoDaily:'aiAutoDaily',aiAutoTraining:'aiAutoTraining',aiAutoFood:'aiAutoFood'};
  Object.entries(toggles).forEach(([id,key])=>{const e=document.getElementById(id);if(e)e.checked=state.settings[key]!==false;});
  renderFoodAIUI();
  renderAiMealEntryUI();
}

function lastCompletedWorkout() {
  return sessions().slice().sort((a,b)=>`${b.date}-${b.finishedAt||''}-${b.id||0}`.localeCompare(`${a.date}-${a.finishedAt||''}-${a.id||0}`))[0] || null;
}

function compactWorkoutForAI(session) {
  if (!session) return null;
  const wt = session.template || workoutTemplate(session.key, session.date);
  return {
    id: session.id || null,
    date: session.date,
    workout: wt.label,
    exercises: wt.items.filter(i=>session.logs?.[i.id]?.sets?.length).map(i=>({
      exerciseId:i.id,
      exercise: EX[i.id]?.name || i.id,
      target: targetText(i),
      sets: session.logs[i.id].sets.map(s=>({repsOrSeconds:s.value, load:s.load ?? null, rir:s.rir ?? null}))
    }))
  };
}

function aiContext(kind='custom', question='') {
  const today = localDateKey();
  const d = state.daily[today] || {};
  const meals = mealTotals(today);
  const plan = planForDate(today);
  const recentWorkouts = sessions().slice().sort((a,b)=>`${b.date}-${b.finishedAt||''}`.localeCompare(`${a.date}-${a.finishedAt||''}`)).slice(0,4).map(compactWorkoutForAI);
  const profile = state.profile || {};
  return {
    requestType: kind,
    question,
    date: today,
    profile: {
      age: profile.age, sex: profile.sex, heightCm: profile.height, currentWeightKg: latestWeight(),
      goal: profile.goal, goalMode: profile.goalMode, activity: profile.activity, typicalSleep: profile.sleepBaseline,
      dietary: { halal: !!profile.diet?.halal, lactoseFree: !!profile.diet?.lactoseFree, vegetarian: !!profile.diet?.vegetarian }
    },
    todayCheck: { sleepHours:d.sleep ?? null, energy:d.energy ?? null, elbowPain:d.elbow ?? null, shoulderPain:d.shoulder ?? null, weightKg:d.weight ?? null },
    recovery: recoveryDecision(today),
    todayPlan: plan,
    nutrition: { eaten:meals, targets:state.settings },
    strengthPRs: { pullups:maxStrength('pullups'), dips:maxStrength('dips'), pushups:maxStrength('pushups'), handstandSeconds:maxStrength('handstand'), deadHangSeconds:maxStrength('hang') },
    recentWorkouts
  };
}

function aiPrompt(kind, question='') {
  const labels = {
    today:'Bewerte den heutigen Tagescheck und sag mir konkret, was ich heute beim Training oder bei der Regeneration beachten soll.',
    training:'Bewerte mein letztes Training im Vergleich zu meinen bisherigen Werten. Nenne konkret 1–3 Dinge, die ich beim nächsten Training verbessern soll.',
    food:'Sag mir anhand meiner heutigen Makros, was ich heute noch sinnvoll essen sollte. Priorisiere Protein und Kalorienziel und beachte meine Ernährungsangaben.',
    custom: question || 'Gib mir eine kurze Coaching-Empfehlung.'
  };
  const ctx = aiContext(kind, question);
  return `Du bist ein knapper, evidenzorientierter Calisthenics-Coach in einer Fitness-App. Antworte auf Deutsch.\n\nRegeln:\n- Maximal 5 kurze Punkte, keine langen Einleitungen.\n- Nutze ausschließlich die gelieferten Nutzerdaten; erfinde keine Messwerte.\n- Bei Schmerzen >=4/10 keine belastende Übung empfehlen; bei anhaltenden oder zunehmenden Beschwerden zur medizinischen Abklärung raten.\n- Keine Diagnose stellen.\n- Bei Ernährung konkrete einfache Vorschläge machen, aber keine exakten Nährwerte erfinden, wenn sie nicht in den Daten stehen.\n- Das Trainingsprogramm der App ist die Basis; ändere es nur, wenn Recovery/Schmerz eine Anpassung verlangt.\n\nAufgabe: ${labels[kind] || labels.custom}\n\nAPP-DATEN:\n${JSON.stringify(ctx)}`;
}

async function geminiGenerate(prompt, {timeoutMs=20000,maxTokens=500,responseFormat=null}={}) {
  const key = geminiKey();
  if (state.settings.aiEnabled === false) throw new Error('KI ist unter Einstellungen ausgeschaltet.');
  if (!navigator.onLine) throw new Error('Offline: KI benötigt eine Internetverbindung. Deine Einträge bleiben lokal verfügbar.');
  if (!key) throw new Error('Kein Gemini API-Key gespeichert.');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const payload={model:GEMINI_MODEL,input:prompt,store:false,generation_config:{max_output_tokens:maxTokens}};
    if(responseFormat)payload.response_format=[responseFormat];
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':key},
      signal:controller.signal,
      body:JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.errors?.[0]?.message || `Gemini Fehler ${res.status}`;
      if (res.status === 429) throw new Error('Gemini-Anfragelimit gerade erreicht. Später erneut versuchen.');
      if ([401,403].includes(res.status) || /api[- ]?key/i.test(msg)) throw new Error('API-Key wurde abgelehnt. Prüfe den Key in Google AI Studio.');
      throw new Error(msg);
    }
    const answer = (data.steps || []).filter(step=>step?.type==='model_output').flatMap(step=>step.content || []).filter(part=>part?.type==='text' && part.text).map(part=>part.text).join('\n').trim();
    if(data.status && data.status !== 'completed') throw new Error('KI-Antwort wurde nicht vollständig abgeschlossen. Bitte erneut versuchen.');
    if (!answer) throw new Error(data?.errors?.[0]?.message || 'Gemini hat keine Textantwort geliefert.');
    return answer;
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Gemini antwortet gerade zu langsam. Bitte erneut versuchen.');
    if(err instanceof TypeError) throw new Error('KI-Verbindung fehlgeschlagen. Prüfe Internetverbindung und API-Zugriff.');
    throw err;
  } finally { clearTimeout(timeout); }
}

function showAIAnswer(message, type='answer') {
  const box = document.getElementById('aiCoachAnswer');
  if (!box) return;
  box.classList.remove('hidden','error','loading');
  if (type === 'loading') { box.classList.add('loading'); box.textContent = message; return; }
  if (type === 'error') box.classList.add('error');
  box.innerHTML = aiTextHTML(message);
}

async function runCoachAI(kind='custom', question='') {
  if(aiBusy.has('chat'))return;
  if (!hasGeminiKey()) { showAIAnswer('Noch kein Gemini-Key gespeichert. Öffne Mehr → Einstellungen → KI Coach und hinterlege deinen eigenen Key.', 'error'); return; }
  aiBusy.add('chat');showAIAnswer('Coach denkt kurz nach …','loading');
  try { showAIAnswer(await geminiGenerate(aiPrompt(kind, question))); }
  catch (e) { showAIAnswer(e.message || 'KI-Anfrage fehlgeschlagen.', 'error'); }
  finally{aiBusy.delete('chat');}
}

function dailyAISignature(date=localDateKey()) {
  const d=state.daily[date]||{}; return [d.sleep??'',d.energy??'',d.elbow??'',d.shoulder??'',d.weight??'',d.creatine?1:0,recoveryDecision(date).mode].join('|');
}
function cachedDailyAI(date=localDateKey()) { const x=state.ai?.daily?.[date]; return x&&x.signature===dailyAISignature(date)?x.text:null; }
async function runDailyAI(targetId='dailyFlowAiText',{force=false}={}) {
  const date=localDateKey(), busyKey=`daily:${date}`, requestSignature=dailyAISignature(date);
  if(!hasGeminiKey()){setAIElement(targetId,'Kein Gemini-Key gespeichert. Unter Mehr → Einstellungen → KI Coach eintragen.','error');return;}
  const cached=cachedDailyAI(date); if(cached&&!force){setAIElement(targetId,cached);return;}
  if(aiBusy.has(busyKey))return; aiBusy.add(busyKey); setAIElement(targetId,'Gemini bewertet Schlaf, Energie und Gelenke …','loading');
  try{
    const text=await geminiGenerate(aiPrompt('today'),{maxTokens:280}); state.ai.daily[date]={signature:requestSignature,text,at:Date.now()}; saveState(false); setAIElement(targetId,text);
  }catch(e){setAIElement(targetId,e.message||'KI-Tagesanalyse fehlgeschlagen.','error');}
  finally{aiBusy.delete(busyKey);}
}

function foodAISignature(date=localDateKey()) {
  const t=mealTotals(date), count=(state.meals[date]||[]).length; return [count,t.calories,t.protein,t.carbs,t.fat,t.fiber,state.settings.calories,state.settings.protein].join('|');
}
function cachedFoodAI(date=localDateKey()) { const x=state.ai?.food?.[date]; return x&&x.signature===foodAISignature(date)?x.text:null; }
async function runFoodAI(targetId='foodAiAnswer',{force=false}={}) {
  const date=localDateKey(), busyKey=`food:${date}`, requestSignature=foodAISignature(date);
  if(!hasGeminiKey()){setAIElement(targetId,'Kein Gemini-Key gespeichert. Unter Mehr → Einstellungen → KI Coach eintragen.','error');return;}
  const cached=cachedFoodAI(date); if(cached&&!force){setAIElement(targetId,cached);return;}
  if(aiBusy.has(busyKey))return; aiBusy.add(busyKey); setAIElement(targetId,'Gemini prüft deine heutigen Makros …','loading');
  try{
    const text=await geminiGenerate(aiPrompt('food'),{maxTokens:320}); state.ai.food[date]={signature:requestSignature,text,at:Date.now()}; saveState(false); setAIElement(targetId,text); renderFoodAIUI();
  }catch(e){setAIElement(targetId,e.message||'KI-Ernährungsanalyse fehlgeschlagen.','error');}
  finally{aiBusy.delete(busyKey);}
}
function renderFoodAIUI(){
  const badge=document.getElementById('foodAiBadge'),answer=document.getElementById('foodAiAnswer'),button=document.getElementById('foodAiAsk'); if(!badge||!answer||!button)return;
  const connected=hasGeminiKey(), cached=cachedFoodAI(); badge.textContent=connected?'BEREIT':'AUS'; badge.className=`mode-badge ${connected?'':'light'}`;
  if(cached){answer.innerHTML=aiTextHTML(cached);button.textContent='KI-Tipp aktualisieren';}
  else{answer.textContent=connected?'Gemini kann deine bisherigen Mahlzeiten und Restziele direkt hier bewerten.':'Unter Mehr → Einstellungen einen Gemini-Key hinterlegen – danach erscheint der KI-Tipp direkt hier.';button.textContent='KI-Ernährungstipp holen';}
  button.disabled=!connected;
}

function workoutAIKey(session){return String(session?.id || `${session?.date||''}-${session?.key||''}-${session?.startedAt||''}`);}
function cachedWorkoutAI(session){return session?state.ai?.workouts?.[workoutAIKey(session)]?.text||null:null;}
function previousComparableWorkout(session){
  if(!session)return null; return sessions().filter(s=>s.key===session.key&&workoutAIKey(s)!==workoutAIKey(session)).sort((a,b)=>`${b.date}-${b.finishedAt||''}`.localeCompare(`${a.date}-${a.finishedAt||''}`))[0]||null;
}
function workoutSummaryPrompt(session){
  const previous=previousComparableWorkout(session); const rec=recoveryDecision(session.date);
  return `Du bist ein knapper Calisthenics-Coach. Antworte auf Deutsch. Analysiere die gerade absolvierte Einheit im Vergleich zur vorherigen gleichen Einheit. Maximal 5 kurze Punkte. Nenne: 1) was besser/gleich/schlechter war, 2) konkrete nächste Ziele für die wichtigsten Übungen, 3) nur falls nötig einen Recovery-Hinweis. Erfinde nichts. Bei Schmerzen >=4/10 keine belastende Empfehlung.\n\nAKTUELL:\n${JSON.stringify(compactWorkoutForAI(session))}\n\nVORHERIGE GLEICHE EINHEIT:\n${JSON.stringify(compactWorkoutForAI(previous))}\n\nRECOVERY AM TAG:\n${JSON.stringify(rec)}`;
}
async function runWorkoutAI(session,targetId,{force=false}={}){
  if(!session)return; const key=workoutAIKey(session),busyKey=`workout:${key}`;
  if(!hasGeminiKey()){setAIElement(targetId,'Kein Gemini-Key gespeichert. Unter Mehr → Einstellungen → KI Coach eintragen.','error');return;}
  const cached=cachedWorkoutAI(session); if(cached&&!force){setAIElement(targetId,cached);return;}
  if(aiBusy.has(busyKey))return; aiBusy.add(busyKey); setAIElement(targetId,'Gemini vergleicht die Einheit mit deinem letzten Training …','loading');
  try{const text=await geminiGenerate(workoutSummaryPrompt(session),{maxTokens:360});state.ai.workouts[key]={text,at:Date.now()};saveState(false);setAIElement(targetId,text);}
  catch(e){setAIElement(targetId,e.message||'KI-Trainingsanalyse fehlgeschlagen.','error');}
  finally{aiBusy.delete(busyKey);}
}

function setFeedbackPrompt(item,entry,setIndex){
  const prev=previousExerciseLog(item.id,guided?.key), previous=prev?.log?.sets?.[setIndex]||null, todaySets=guided?.logs?.[item.id]?.sets||[];
  return `Du bist ein Calisthenics-Coach während eines laufenden Trainings. Antworte auf Deutsch in maximal 2 kurzen Sätzen. Satz 1: bewerte den gerade gespeicherten Satz im Vergleich zum gleichen Satz des letzten Trainings. Satz 2: gib ein konkretes Ziel für den nächsten Satz oder, falls die Übung fertig ist, für das nächste Training. Beachte RIR und Bandhilfe. Weniger Bandhilfe bei gleicher Leistung ist besser. Keine Motivationstexte. Erfinde keine Werte.\n\nÜbung: ${EX[item.id]?.name||item.id}\nZiel: ${targetText(item)}\nSatznummer: ${setIndex+1}\nGerade: ${JSON.stringify(entry)}\nLetztes Mal gleicher Satz: ${JSON.stringify(previous)}\nHeutige Sätze: ${JSON.stringify(todaySets)}\nRecovery: ${JSON.stringify(recoveryDecision(guided?.date||localDateKey()))}`;
}
function guidedFeedbackKey(itemId,setIndex){return `${itemId}:${setIndex}`;}
function latestGuidedFeedback(itemId){
  if(!guided?.aiFeedback)return null; const entries=Object.entries(guided.aiFeedback).filter(([k])=>k.startsWith(`${itemId}:`)).sort((a,b)=>+b[0].split(':')[1]-+a[0].split(':')[1]); return entries[0]?.[1]||null;
}
function renderGuidedAIBox(item){
  if(item.special)return''; const sets=guided?.logs?.[item.id]?.sets||[], latest=latestGuidedFeedback(item.id), connected=hasGeminiKey();
  const text=latest||(!connected?'Gemini-Key fehlt. Die normalen Satzvergleiche funktionieren trotzdem.':sets.length?'Gemini kann den letzten Satz kurz bewerten.':'Nach dem ersten gespeicherten Satz bekommst du hier den KI-Vergleich.');
  return `<div class="context-ai-inline"><div class="ai-mini-head"><span>Gemini · Satz-Coach</span><small>${connected?'bereit':'optional'}</small></div><p id="guidedAiFeedbackText">${aiTextHTML(text)}</p>${sets.length?`<button id="manualSetAiBtn" class="secondary full" type="button" ${connected?'':'disabled'}>${latest?'KI-Tipp aktualisieren':'KI-Tipp zu letztem Satz'}</button>`:''}</div>`;
}
async function runSetAI(item,entry,setIndex,{force=false}={}){
  if(!guided||!hasGeminiKey())return; const feedbackKey=guidedFeedbackKey(item.id,setIndex),sessionToken=`${guided.date}|${guided.key}|${guided.startedAt}`,busyKey=`set:${sessionToken}:${feedbackKey}`;
  const sameExerciseOnScreen=()=>guided && `${guided.date}|${guided.key}|${guided.startedAt}`===sessionToken && guided?.template?.items?.[guided.itemIndex]?.id===item.id;
  if(guided.aiFeedback?.[feedbackKey]&&!force){if(sameExerciseOnScreen())setAIElement('guidedAiFeedbackText',guided.aiFeedback[feedbackKey]);setTimerCoachLine(guided.aiFeedback[feedbackKey]);return;}
  if(aiBusy.has(busyKey))return; aiBusy.add(busyKey); guided.aiFeedback||={}; if(!guided.completed)persistActive(); if(sameExerciseOnScreen())setAIElement('guidedAiFeedbackText','Coach denkt kurz nach …','loading'); setTimerCoachLine('Gemini bewertet den Satz …','loading');
  try{
    const text=await geminiGenerate(setFeedbackPrompt(item,entry,setIndex),{maxTokens:180});
    if(guided&&!guided.completed&&`${guided.date}|${guided.key}|${guided.startedAt}`===sessionToken){guided.aiFeedback[feedbackKey]=text;persistActive();}
    else if(state.activeSession&&`${state.activeSession.date}|${state.activeSession.key}|${state.activeSession.startedAt}`===sessionToken){state.activeSession.aiFeedback||={};state.activeSession.aiFeedback[feedbackKey]=text;persistState();}
    if(sameExerciseOnScreen())setAIElement('guidedAiFeedbackText',text); setTimerCoachLine(text);
  }catch(e){const msg=e.message||'KI-Satzfeedback fehlgeschlagen.';if(sameExerciseOnScreen())setAIElement('guidedAiFeedbackText',msg,'error');setTimerCoachLine(msg,'error');}
  finally{aiBusy.delete(busyKey);}
}


function extractGeminiJSON(text) {
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  const start=raw.indexOf('{'), end=raw.lastIndexOf('}');
  if(start<0||end<=start) throw new Error('Die KI-Antwort konnte nicht als Nährwertdaten gelesen werden. Bitte erneut versuchen.');
  try{return JSON.parse(raw.slice(start,end+1));}catch(e){throw new Error('Die KI hat unvollständige Nährwertdaten geliefert. Bitte erneut versuchen.');}
}
function safeNutritionNumber(v,max=5000){const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=max?n:0;}
function sanitizeAiMealItem(item,index){
  if(!item || ['calories','protein','carbs','fat','fiber'].some(k=>typeof item[k]!=='number'||!Number.isFinite(item[k])||item[k]<0))throw new Error('KI lieferte ungültige Nährwerte. Bitte erneut versuchen.');
  const name=String(item?.name||`Lebensmittel ${index+1}`).trim().slice(0,90);
  const amountRaw=Number(item?.amount); const amount=Number.isFinite(amountRaw)&&amountRaw>0?Math.round(amountRaw*10)/10:null;
  const unit=String(item?.unit||'Portion').trim().slice(0,18) || 'Portion';
  let cal=safeNutritionNumber(item?.calories,5000), protein=safeNutritionNumber(item?.protein,500), carbs=safeNutritionNumber(item?.carbs,1000), fat=safeNutritionNumber(item?.fat,500), fiber=safeNutritionNumber(item?.fiber,200);
  if(cal<=0&&(protein+carbs+fat)>0) cal=Math.round(protein*4+carbs*4+fat*9);
  return {name,amount,unit,cal:Math.round(cal),protein:round1(protein),carbs:round1(carbs),fat:round1(fat),fiber:round1(fiber),assumption:String(item?.assumption||'').trim().slice(0,180)};
}
const AI_MEAL_RESPONSE_FORMAT={
  type:'text',mime_type:'application/json',schema:{
    type:'object',
    properties:{
      status:{type:'string',enum:['ready','clarify']},
      question:{type:'string'},
      note:{type:'string'},
      items:{type:'array',items:{type:'object',properties:{
        name:{type:'string'}, amount:{type:'number'}, unit:{type:'string'}, calories:{type:'number'}, protein:{type:'number'}, carbs:{type:'number'}, fat:{type:'number'}, fiber:{type:'number'}, assumption:{type:'string'}
      },required:['name','amount','unit','calories','protein','carbs','fat','fiber','assumption']}}
    },
    required:['status','question','note','items']
  }
};
function aiMealPrompt(original,answers=[]){
  const dialog=answers.length?answers.map((a,i)=>`Rückfrage ${i+1}: ${a.question}\nAntwort: ${a.answer}`).join('\n'):'keine';
  return `Du bist ein präziser Ernährungstracker für eine Fitness-App. Der Nutzer beschreibt frei eine Mahlzeit. Schätze realistische Nährwerte aus üblichen Lebensmitteldaten und gib AUSSCHLIESSLICH gültiges JSON zurück, ohne Markdown und ohne zusätzlichen Text.\n\nWICHTIG:\n- Wenn eine Unklarheit die Mahlzeit grob um >=150 kcal oder >=15 g Protein verändern kann, frage nach. Typische Beispiele: Nudeln/Reis trocken vs. gekocht, sehr unklare Fleischmenge, stark schwankende Sauce/Öl-Menge.\n- Frage nur nach wirklich wichtigen Dingen. Maximal EINE kurze Rückfrage pro Antwort; sie darf mehrere eng zusammenhängende Details enthalten.\n- Wenn die fehlende Information nicht wichtig genug ist, schätze selbst und schreibe die Annahme beim jeweiligen Item.\n- Bei Mengen wie \"3 Eier\" verwende amount=3 und unit=\"Stk\". Bei Grammangaben amount als Zahl und unit=\"g\". Bei ungenauen Portionen darf amount=1 und unit=\"kleine Portion\" o. ä. sein.\n- Nutze verzehrfertige/gekochte Werte, wenn der Nutzer das klar sagt. Ist bei Nudeln/Reis eine Grammzahl ohne Zustand angegeben, ist trocken vs. gekocht eine wichtige Rückfrage.\n- Für Gemüse mit Sahnesoße oder Mischgerichte schätze die gesamte Portion realistisch; berücksichtige die Sauce.\n- Alle Werte beziehen sich auf die tatsächlich beschriebene Menge, NICHT pro 100 g.\n- Gib für jedes Item calories, protein, carbs, fat und fiber als Zahlen an.\n- Keine medizinische Beratung, keine Motivation, nur Tracking.\n\nWenn Rückfrage nötig:\n{"status":"clarify","question":"...","items":[]}\n\nWenn ausreichend klar:\n{"status":"ready","question":"","items":[{"name":"...","amount":250,"unit":"g","calories":350,"protein":12.5,"carbs":70,"fat":2.5,"fiber":4,"assumption":"gekocht gewogen"}],"note":"kurze optionale Gesamtannahme"}\n\nURSPRÜNGLICHE EINGABE:\n${original}\n\nBISHERIGE RÜCKFRAGEN UND ANTWORTEN:\n${dialog}`;
}
function renderAiMealStatus(html,type='normal'){
  const root=document.getElementById('aiMealFlow'); if(!root)return;
  root.classList.remove('hidden','error','loading','success'); if(type!=='normal')root.classList.add(type); root.innerHTML=html;
}
function renderAiMealEntryUI(){
  const badge=document.getElementById('aiMealEntryBadge'),btn=document.getElementById('aiMealAnalyzeBtn'),root=document.getElementById('aiMealFlow'); if(!badge||!btn)return;
  const on=hasGeminiKey(); badge.textContent=on?'BEREIT':'AUS'; badge.className=`mode-badge ${on?'':'light'}`; btn.disabled=!on;
  if(!on&&root&&root.classList.contains('hidden')){root.dataset.keyHint='1';renderAiMealStatus('<p>Unter <b>Mehr → Einstellungen → KI Coach</b> zuerst deinen Gemini-Key hinterlegen. Der normale Food-Tracker funktioniert weiter.</p>');}
  if(on&&root?.dataset.keyHint==='1'){delete root.dataset.keyHint;root.innerHTML='';root.className='ai-meal-flow hidden';}
}
function aiMealTotals(items){return items.reduce((t,m)=>({cal:t.cal+m.cal,protein:round1(t.protein+m.protein),carbs:round1(t.carbs+m.carbs),fat:round1(t.fat+m.fat),fiber:round1(t.fiber+m.fiber)}),{cal:0,protein:0,carbs:0,fat:0,fiber:0});}
function commitAiMealItems(items,note=''){
  const key=aiMealDraft.date || localDateKey(); state.meals[key] ||= []; const batchId=`ai-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  const ids=[];
  items.forEach((m,i)=>{const id=crypto.randomUUID();ids.push(id);state.meals[key].push({...m,id,batchId,source:'gemini',note:String(note||'').slice(0,180)});});
  aiMealDraft.lastBatchId=batchId; saveState();
  return batchId;
}
function undoAiMealBatch(batchId){
  if(!batchId)return; for(const key of Object.keys(state.meals))state.meals[key]=(state.meals[key]||[]).filter(m=>m.batchId!==batchId); saveState();
  aiMealDraft.lastBatchId=null; renderAiMealStatus('<p>KI-Eintrag wurde rückgängig gemacht.</p>','normal');
}
async function analyzeAiMeal({answer=null}={}){
  if(aiBusy.has('meal-parse'))return;
  if(!hasGeminiKey()){renderAiMealStatus('<p>Kein Gemini-Key gespeichert. Öffne <b>Mehr → Einstellungen → KI Coach</b>.</p>','error');return;}
  const input=document.getElementById('aiMealText');
  if(answer!==null){
    const answerText=String(answer).trim(); if(!answerText)return;
    const pending=aiMealDraft.answers[aiMealDraft.answers.length-1]; if(pending&&!pending.answer)pending.answer=answerText;
  } else {
    const original=input?.value.trim()||''; if(!original){input?.focus();return;}
    aiMealDraft={original,answers:[],lastBatchId:null,date:localDateKey()};
  }
  const busyKey='meal-parse'; if(aiBusy.has(busyKey))return; aiBusy.add(busyKey);
  const btn=document.getElementById('aiMealAnalyzeBtn'); if(btn)btn.disabled=true;
  renderAiMealStatus('<p>Gemini zerlegt die Mahlzeit und berechnet kcal, Protein, Kohlenhydrate, Fett und Ballaststoffe …</p>','loading');
  try{
    const raw=await geminiGenerate(aiMealPrompt(aiMealDraft.original,aiMealDraft.answers),{timeoutMs:25000,maxTokens:900,responseFormat:AI_MEAL_RESPONSE_FORMAT});
    const data=extractGeminiJSON(raw), status=String(data?.status||'').toLowerCase();
    if(status==='clarify'){
      const question=String(data?.question||'').trim(); if(!question)throw new Error('Gemini wollte nachfragen, hat aber keine Frage geliefert.');
      if(aiMealDraft.answers.length>=3)throw new Error('Die Mahlzeit bleibt zu unklar. Bitte Mengen etwas genauer beschreiben.');
      aiMealDraft.answers.push({question,answer:''});
      renderAiMealStatus(`<div class="ai-meal-question"><div class="eyebrow">Kurze Rückfrage</div><b>${escapeHTML(question)}</b><div class="ai-meal-answer-row"><input id="aiMealClarifyAnswer" type="text" autocomplete="off" placeholder="Antwort eingeben …"><button id="aiMealClarifyBtn" class="primary" type="button">Weiter</button></div><button id="aiMealCancelBtn" class="small-btn" type="button">Abbrechen</button></div>`);
      const ans=document.getElementById('aiMealClarifyAnswer'); const go=()=>analyzeAiMeal({answer:ans?.value||''}); document.getElementById('aiMealClarifyBtn').onclick=go; ans?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}}); document.getElementById('aiMealCancelBtn').onclick=()=>{aiMealDraft={original:'',answers:[],lastBatchId:null};renderAiMealStatus('<p>Eintrag abgebrochen.</p>');}; ans?.focus();
      return;
    }
    if(status!=='ready'||!Array.isArray(data?.items)||!data.items.length)throw new Error('Gemini konnte daraus keine Lebensmittel ableiten. Beschreibe Menge und Gericht etwas genauer.');
    const items=data.items.slice(0,30).map(sanitizeAiMealItem).filter(m=>m.name&&m.cal>=0);
    if(!items.length)throw new Error('Es wurden keine verwertbaren Nährwerte erkannt.');
    const batchId=commitAiMealItems(items,data?.note||''); const totals=aiMealTotals(items);
    const itemHtml=items.map(m=>`<li><span><b>${escapeHTML(m.name)}</b><small>${m.amount?`${m.amount} ${escapeHTML(m.unit)} · `:''}${m.cal} kcal · ${m.protein} P · ${m.carbs} KH · ${m.fat} F${m.fiber?` · ${m.fiber} Ballastst.`:''}</small>${m.assumption?`<em>${escapeHTML(m.assumption)}</em>`:''}</span></li>`).join('');
    renderAiMealStatus(`<div class="ai-meal-success"><div class="eyebrow">Automatisch eingetragen ✓</div><h4>${totals.cal} kcal · ${totals.protein} g Protein</h4><p>${totals.carbs} g KH · ${totals.fat} g Fett · ${totals.fiber} g Ballaststoffe</p><ul>${itemHtml}</ul>${data?.note?`<small class="ai-meal-note">${escapeHTML(String(data.note))}</small>`:''}<button id="undoAiMealBtn" class="secondary full" type="button">Diesen KI-Eintrag rückgängig machen</button></div>`,'success');
    document.getElementById('undoAiMealBtn').onclick=()=>undoAiMealBatch(batchId);
    if(input)input.value=''; aiMealDraft.original=''; aiMealDraft.answers=[];
    if(hasGeminiKey()&&state.settings.aiAutoFood!==false)setTimeout(()=>runFoodAI('foodAiAnswer',{force:true}),100);
  }catch(e){renderAiMealStatus(`<p>${escapeHTML(e.message||'KI-Auswertung fehlgeschlagen.')}</p>`,'error');}
  finally{aiBusy.delete(busyKey);renderAiMealEntryUI();}
}

function initGeminiControls() {
  document.getElementById('aiMealAnalyzeBtn')?.addEventListener('click',()=>analyzeAiMeal());
  document.getElementById('aiMealText')?.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();analyzeAiMeal();}});
  document.querySelectorAll('[data-ai-prompt]').forEach(btn=>btn.onclick=()=>runCoachAI(btn.dataset.aiPrompt));
  document.getElementById('aiCoachAsk')?.addEventListener('click',()=>{const q=document.getElementById('aiCoachQuestion')?.value.trim();if(!q){document.getElementById('aiCoachQuestion')?.focus();return;}runCoachAI('custom',q);});
  document.getElementById('foodAiAsk')?.addEventListener('click',()=>runFoodAI('foodAiAnswer',{force:true}));
  document.getElementById('toggleGeminiKey')?.addEventListener('click',()=>{const input=document.getElementById('geminiApiKey');if(!input)return;input.type=input.type==='password'?'text':'password';document.getElementById('toggleGeminiKey').textContent=input.type==='password'?'Anzeigen':'Verbergen';});
  document.getElementById('saveGeminiKey')?.addEventListener('click',()=>{const input=document.getElementById('geminiApiKey');const key=input?.value.trim()||'';const msg=document.getElementById('geminiKeyMessage');if(key.length<20){if(msg)msg.textContent='Der Key sieht zu kurz aus.';return;}localStorage.setItem(GEMINI_KEY_STORE,key);if(msg)msg.textContent='Key nur auf diesem Gerät gespeichert ✓';renderGeminiUI();});
  document.getElementById('deleteGeminiKey')?.addEventListener('click',()=>{localStorage.removeItem(GEMINI_KEY_STORE);const input=document.getElementById('geminiApiKey');if(input)input.value='';const msg=document.getElementById('geminiKeyMessage');if(msg)msg.textContent='Key gelöscht ✓';renderGeminiUI();});
  document.getElementById('testGeminiKey')?.addEventListener('click',async()=>{const input=document.getElementById('geminiApiKey');const typed=input?.value.trim()||'';const msg=document.getElementById('geminiKeyMessage');if(typed&&typed!==geminiKey())localStorage.setItem(GEMINI_KEY_STORE,typed);if(!hasGeminiKey()){if(msg)msg.textContent='Bitte zuerst einen API-Key eintragen.';return;}if(msg)msg.textContent='Verbindung wird getestet …';try{await geminiGenerate('Antworte exakt mit: OK',{timeoutMs:15000,maxTokens:30});if(msg)msg.textContent=`Verbunden ✓ · ${GEMINI_MODEL}`;renderGeminiUI();}catch(e){if(msg)msg.textContent=e.message||'Verbindung fehlgeschlagen.';}});
  ['aiAutoDaily','aiAutoTraining','aiAutoFood'].forEach(id=>document.getElementById(id)?.addEventListener('change',e=>{state.settings[id]=e.target.checked;saveState(false);renderGeminiUI();}));
}

initGeminiControls();
renderGeminiUI();
renderAiMealEntryUI();

// V5.2 static control bindings
initV52Controls();
renderTrainingPlanManager(); renderFoodTrend(); renderExerciseProgress(); renderCalorieSettings();

// ---------- V5.3: persistence, personal display and library ----------
function persistState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); return true; }
  catch(e) {
    const notice=document.getElementById('appNotice');
    if(notice){notice.textContent='Speichern fehlgeschlagen. Bitte jetzt ein Backup exportieren und freien Browserspeicher prüfen.';notice.classList.remove('hidden');}
    throw new Error('Änderungen konnten nicht dauerhaft gespeichert werden.');
  }
}
function validateBackup(raw) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw) || !raw.profile || !raw.settings) throw new Error('Kein Cal-Coach-Backup.');
  const walk=(v,depth=0)=>{
    if(depth>30)throw new Error('Backup ist zu tief verschachtelt.');
    if(typeof v==='string' && /[<>]/.test(v))throw new Error('Backup enthält ungültige HTML-Zeichen.');
    if(v && typeof v==='object')for(const [k,x]of Object.entries(v)){
      if(['__proto__','constructor','prototype'].includes(k))throw new Error('Ungültiger Backup-Schlüssel.');
      walk(x,depth+1);
    }
  };walk(raw);
  for(const k of ['daily','meals','workouts','runs','customPlans'])if(raw[k] && (typeof raw[k]!=='object'||Array.isArray(raw[k])))throw new Error('Ungültiger Datenbereich: '+k);
  for(const list of Object.values(raw.meals||{}))if(!Array.isArray(list)||list.some(m=>!m || ['cal','protein','carbs','fat'].some(k=>!Number.isFinite(+m[k])||+m[k]<0)))throw new Error('Ungültige Mahlzeiten.');
  const checkPlan=p=>{
    if(!p || !Array.isArray(p.items) || !p.items.length || p.items.some(i=>!i || !EX[i.id] || (!i.special && (!Number.isInteger(i.sets)||i.sets<1||i.sets>6||!Number.isFinite(i.min)||!Number.isFinite(i.max)||i.min<1||i.max<i.min))))throw new Error('Ungültiger Trainingsplan.');
    if(new Set(p.items.map(i=>i.id)).size!==p.items.length)throw new Error('Doppelte Übungen im Trainingsplan.');
  };
  Object.values(raw.customPlans||{}).forEach(checkPlan);
  if(raw.activeSession?.template)checkPlan(raw.activeSession.template);
  for(const value of Object.values(raw.workouts||{}))for(const session of Array.isArray(value)?value:[value]){
    if(!session || typeof session!=='object')throw new Error('Ungültige Einheit.');
    if(session.template)checkPlan(session.template);
    for(const log of Object.values(session.logs||{}))if(log.sets && (!Array.isArray(log.sets)||log.sets.some(s=>!Number.isFinite(+s.value)||+s.value<0)))throw new Error('Ungültige Sätze.');
  }
  return migrate(raw);
}
async function importBackupFile(event) {
  const file=event.target.files?.[0];if(!file)return;
  try {
    if(file.size>100*1024*1024)throw new Error('Backup ist größer als 100 MB.');
    const raw=JSON.parse(await file.text()), next=validateBackup(raw);
    if(!confirm('Dieses Backup ersetzt die aktuellen App-Daten. Fortfahren?'))return;
    const photos=Array.isArray(raw.photoBlobs)?raw.photoBlobs:[];
    for(const p of photos)if(!p || !p.id || ['front','side','back'].some(k=>p[k] && !/^data:image\/(jpeg|png|webp);base64,/.test(p[k])))throw new Error('Ungültiges Foto.');
    // Validate and commit imported photos atomically before publishing the new state.
    if(photos.length){const db=await photoDBOpen();await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');photos.forEach(p=>tx.objectStore(PHOTO_STORE).put(p));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();}
    delete next.photoBlobs;
    const previous=state;state=next;
    try{saveState(false);}catch(e){state=previous;throw e;}
    closeTimer(false);guided=null;renderAll();applyPreferences();alert('Backup importiert ✓');
  }catch(e){alert('Import abgebrochen: '+e.message);}
  finally{event.target.value='';}
}
function featureDefinitions(){return [
 ['showNutrition','Ernährung auf der Startseite','Kalorien und Protein im Tagesüberblick',true],
 ['showProgressions','Progressionsvorschläge','Nächste Trainingsstufen unter Mehr',true],
 ['showSkills','Skills & Roadmap','Zusätzliche Ziele und Handstand-Praxis',true],
 ['showPhotos','Fortschrittsfotos','Fotovergleich unter Fortschritt',true],
 ['showImages','Übungsbilder','Bilder bei Training und Übungen',true],
 ['aiEnabled','KI-Funktionen','Eigener API-Key erforderlich; manuelle Nutzung',true],
 ['animations','Animationen','Weiche Übergänge und animierte Statistiken',true]
];}
function applyPreferences(){
 const show=(selector,on)=>document.querySelectorAll(selector).forEach(el=>el.classList.toggle('feature-off',!on));
 const on=k=>state.settings[k]!==false;
 show('.nutrition-glance',on('showNutrition'));
 show('.progression-focus-card',on('showProgressions'));
 show('[data-nav="skills"],[data-nav="roadmap"]',on('showSkills'));
 show('.photo-card',on('showPhotos'));
 show('#aiCoachCard,#aiMealEntryCard,.context-ai-inline,.guided-ai-feedback,.ai-plan-review,.food-ai-card',on('aiEnabled'));
 document.body.classList.toggle('without-ai',!on('aiEnabled'));
 document.body.classList.toggle('without-images',!on('showImages'));
 document.body.classList.toggle('reduce-motion',!on('animations'));
 document.querySelectorAll('[data-feature]').forEach(el=>el.checked=on(el.dataset.feature));
}
function initPreferences(){
 document.getElementById('featureSettings').innerHTML=featureDefinitions().map(([id,label,desc])=>`<label><input type="checkbox" data-feature="${id}"><span><b>${label}</b><small>${desc}</small></span></label>`).join('');
 document.querySelectorAll('[data-feature]').forEach(el=>el.onchange=()=>{state.settings[el.dataset.feature]=el.checked;saveState(false);applyPreferences();renderGeminiUI();if(el.dataset.feature==='animations')drawCharts();});
 applyPreferences();
 const cats=[...new Set(Object.values(EX).map(e=>e.cat))].sort();
 document.getElementById('exerciseCategory').innerHTML+=cats.map(c=>`<option>${escapeHTML(c)}</option>`).join('');
 document.getElementById('exerciseCategory').onchange=renderExerciseLibrary;
 document.getElementById('exerciseSearch').oninput=renderExerciseLibrary;
 renderExerciseLibrary();
}
function renderExerciseLibrary(){
 const q=(document.getElementById('exerciseSearch').value||'').toLocaleLowerCase('de'),cat=document.getElementById('exerciseCategory').value;
 const list=Object.entries(EX).filter(([id,e])=>(!cat||e.cat===cat)&&(!q||(e.name+' '+e.cat).toLocaleLowerCase('de').includes(q)));
 document.getElementById('exerciseCount').textContent=`${list.length} von ${Object.keys(EX).length} Übungen und Trainingsbausteinen`;
 document.getElementById('exerciseLibrary').innerHTML=list.length?list.map(([id,e])=>`<details class="surface accordion-card library-exercise"><summary><span><b>${escapeHTML(e.name)}</b><small>${escapeHTML(e.cat)}</small></span></summary><div class="accordion-body">${visualHTML(e.visual,false,e.name)}<p class="image-caption">${['wallHspuNegative','wallHspuPartial'].includes(id)?'Beispielposition eines Wall HSPU. Tempo bzw. Tiefe gemäß Anleitung anpassen.':'Illustration einer Übungsposition. Bewegung und Tempo siehe Hinweise.'}</p><ul class="cue-list">${e.cues.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul><h3>Darauf achten</h3><p class="support-copy">${e.mistakes.map(escapeHTML).join(' ')}</p><p class="micro-copy">${escapeHTML(e.progress)}</p></div></details>`).join(''):'<div class="surface"><p>Keine Übung gefunden. Versuche einen anderen Suchbegriff.</p></div>';
}
function renderActivity(){
 const keys=weekKeys(),all=sessions(),count=all.filter(s=>keys.includes(s.date)).length,target=+state.profile.trainingDays||3;
 document.getElementById('weekActivityCount').textContent=`${count} / ${target}`;
 document.getElementById('activitySummary').textContent=count?`${count} abgeschlossene ${count===1?'Einheit':'Einheiten'} · Ziel: ${target} pro Woche`:'Dein erstes abgeschlossenes Training startet diesen Verlauf.';
 document.getElementById('weekActivityBars').innerHTML=keys.map((k,i)=>{const n=all.filter(s=>s.date===k).length;return `<div class="activity-day ${k===localDateKey()?'is-today':''}" aria-label="${deDate(k)}: ${n} Einheiten"><div class="activity-track"><span style="--fill:${n?Math.min(100,n*50):4}%;--delay:${i*45}ms" class="${n?'has-activity':''}"></span></div><b>${['Mo','Di','Mi','Do','Fr','Sa','So'][i]}</b><small>${n||'–'}</small></div>`;}).join('');
}

initPreferences();
document.getElementById('importFile').onchange=importBackupFile;
renderActivity();

document.querySelectorAll('details').forEach(el=>el.addEventListener('toggle',()=>{if(el.open && el.querySelector('canvas')){renderFoodTrend();drawCharts();}}));
window.addEventListener('storage',e=>{if(e.key===STORE_KEY){const n=document.getElementById('appNotice');n.textContent='Daten wurden in einem anderen Tab geändert. Bitte diese Seite neu laden, bevor du weiter einträgst.';n.classList.remove('hidden');}});

// Refresh date-derived views when the app returns on a new day.
let displayedDate=localDateKey();
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)return;
 if(timer.id){timer.remaining=Math.max(0,Math.ceil((timer.deadline-Date.now())/1000));updateTimerDisplay();if(!timer.remaining)closeTimer(true);}
 if(displayedDate!==localDateKey()){displayedDate=localDateKey();loadDailyForm();renderAllDerived();}
});
// Keyboard containment for active sheets and guided dialogs.
document.addEventListener('keydown',event=>{
 const overlays=[...document.querySelectorAll('[role="dialog"]')].filter(el=>!el.classList.contains('hidden'));
 const dialog=overlays.at(-1);if(!dialog)return;
 const focusable=[...dialog.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('.hidden'));
 if(event.key==='Tab'&&focusable.length){const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}}
 if(event.key==='Escape'&&dialog.id==='planEditorOverlay'){closePlanEditor();}
});

window.addEventListener('popstate',()=>switchView(location.hash.slice(1)||'today',true,false));
if(state.profile.onboardingComplete&&document.getElementById(location.hash.slice(1))?.matches('[data-view]'))switchView(location.hash.slice(1),true,false);
