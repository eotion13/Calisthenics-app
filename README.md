# Calisthenics Coach V2

Persönliche, offline-fähige PWA für einen langfristigen Calisthenics-, Kraft-, Cut- und Skill-Plan.

## Profil / Ausgangslage

- 34, männlich, 180 cm, ca. 87 kg
- 2 strikte Pull-ups, 7–10 Dips, 1–5 s freier Handstand
- Bänder: 10 / 20 / 30 kg
- Training: Montag Park A, Donnerstag Park B, Wochenende Home C
- aktueller Schlaf: ca. 5–6 h
- Priorität: maximale Kraft → Muskeln → shredded → Handstand/HSPU → weitere Skills
- Ernährung: Start 2.300 kcal, mindestens 170 g Protein, 5 g Creatin täglich

## V2 Funktionen

- Workout Mode mit Satz-Logging, RIR, Bandhilfe, Pausentimer und Recovery-Anpassung
- automatische Progressionshinweise für Pull-ups, Dips, Pike Push-ups und Dead Hang
- täglicher Recovery-Check mit Schlaf, Energie, Ellenbogen- und Schulterschmerz
- Gewicht, Bauchumfang, Pull-ups, Dips, Handstand, Dead Hang und HSPU tracken
- 7-Tage-Gewichtsschnitt, Wochenreview, Schlaf- und Leistungsstatistik
- Ernährungs-Logging mit persönlichen Meal-Presets
- Creatin-Streak, Wasser und Protein-Ziel
- HSPU-Skilltree und Human-Flag-Readiness
- 4×/Woche Handstand-Checkliste
- Jogging-Tracking
- Urlaubsmodus für All-inclusive-Woche
- Fortschrittsfotos lokal auf dem Gerät
- JSON-Backup / Restore
- PWA / Homescreen / Offline-Modus

## Datenschutz

Die App ist statisch. Trainings-, Körper-, Ernährungs- und Fotodaten werden ausschließlich im Browser des Geräts gespeichert (`localStorage`). GitHub Pages hostet nur den App-Code und erhält diese persönlichen Einträge nicht.

## GitHub Pages

Das Repository enthält `.github/workflows/pages.yml`. Bei Push auf `main` oder `master` wird die statische App über GitHub Pages deployt.

Erwartete URL für dieses Repository:

`https://eotion13.github.io/Calisthenics-App/`

Falls Pages im Repository noch nicht aktiviert ist: GitHub → **Settings → Pages → Source: GitHub Actions**. Danach den Workflow erneut ausführen bzw. einmal auf `main` pushen.
