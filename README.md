# Calisthenics Coach V2.2

Persönliche, offline-fähige PWA. Alle Trainings-, Ernährungs-, Körper- und Fotodaten werden lokal im Browser gespeichert.

## Was in V2.2 angepasst wurde

- deutlich **cleaneres Start-Dashboard**
- nur noch die **wichtigsten Bereiche** direkt sichtbar
- zusätzliche Inhalte in **einklappbaren Bereichen** oder unter **Mehr**
- **Skills** und **Langfrist-Plan** aus der Hauptnavigation entfernt und nach **Mehr** verschoben
- **Warm-up ergänzt**: Handgelenke mobilisieren
- **Übungsdarstellungen überarbeitet**: keine Strichmännchen mehr, sondern cleanere Illustrationskarten
- **aktive Trainingseinheit bleibt erhalten** und kann nach Reload fortgesetzt werden
- **mehrere Workouts am selben Tag** werden sauber gespeichert

## Update eines bestehenden GitHub-Pages-Repositories

Die Dateien `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `404.html`, `.nojekyll` und der Ordner `icons` gehören direkt in den Repository-Hauptordner.

Bei GitHub Pages mit **Deploy from a branch**: `main` + `/(root)` verwenden.

V2.2 behält bestehende lokale Daten, weil derselbe lokale Speicher-Schlüssel weiterverwendet wird.
