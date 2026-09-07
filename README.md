# Calisthenics Coach V2.4 FINAL

Finaler Phase-1 Build der persönlichen Calisthenics-PWA. Die App ist auf schnelle tägliche Bedienung ausgelegt und übernimmt bestehende V2-Daten.

## Enthalten

- kompletter Park-A / Park-B / Home-C-Plan mit exakten Satz- und Wiederholungsbereichen
- echte Übungsbilder mit normalen Menschen statt Strichfiguren
- eigene Bilder für Hauptübungen, Warm-up und Accessory-Übungen
- Recovery-Check vor Trainingsstart
- Training nach Schließen/Reload exakt fortsetzen
- offene Session blockiert versehentliches Starten einer anderen Einheit
- kein doppeltes Pflicht-Workout am selben Tag
- vollständige Übungsliste standardmäßig eingeklappt
- korrekte 10/20/30-kg-Bandlogik für Pull-ups sowie getrennte Widerstandsband-Eingabe bei Rows/Face Pulls
- HSPU/Pike-Progression bleibt erhalten, auch wenn danach Home C kommt
- Wochenende zählt Samstag **oder** Sonntag für Handstand/Home C
- mehrere Workouts pro Tag technisch sauber historisiert
- Auto-PRs aus Pull-ups, Dips und Dead Hang
- 2.300 kcal, 170+ g Protein, Creatin, halal/laktosefrei, Wochenend- und Urlaubsregeln
- 7-Tage-Gewicht, Bauchumfang, Schlaf, Kraftcharts und Coach-Review
- Fortschrittsfotos in IndexedDB statt normalem Browser-Textspeicher; alte Fotos werden migriert
- Backup/Restore enthält auch Fotos
- lokale Datumslogik ohne UTC-Nachtfehler
- PWA/Offline inklusive aller Übungsbilder

## GitHub Pages

Den **Inhalt** dieses Ordners direkt in den Repository-Hauptordner laden. `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `assets/` und `icons/` müssen im Root liegen.

Bei GitHub Pages: **Settings → Pages → Deploy from a branch → main → /(root)**.
