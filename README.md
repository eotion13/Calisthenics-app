# Cal Coach V5 · Native Minimal

V5 ist der komplette UI/UX-Neubau der bisherigen Guided-AI-App. Die vorhandenen lokalen Daten bleiben kompatibel (`calisthenicsCoach_v2`).

## Designprinzipien
- eine klare Hauptaktion pro Screen
- wichtige Informationen sofort, Details erst auf Wunsch
- geführte Vollbild-Flows für Onboarding, Tagescheck und Essen
- Training als Übung-für-Übung-Coach statt langer Formularseite
- fester 5-Tab-Bottom-Navigation wie bei einer mobilen App
- größere Touch-Ziele, Safe-Area-Unterstützung, PWA/Standalone
- ruhiges Dark-UI mit Mint-Akzent und deutlich weniger visueller Unruhe

## Bereiche
- **Heute:** Tagescheck, Tagesempfehlung und kompakter Ernährungsstatus
- **Training:** eine primäre Einheit, alternative Einheiten verborgen, Verlauf separat
- **Essen:** Makros, natürlicher Gemini-Schnelleintrag, Mahlzeiten; manuelle Werkzeuge eingeklappt
- **Fortschritt:** vier Kernwerte, ein Chart zur Zeit, Messungen/Fotos eingeklappt
- **Mehr:** Profil, Skills, Roadmap, Gemini-Key, Backup und Datenverwaltung

## Beibehaltene Funktionen
- Montag A / Donnerstag B / Home C + Handstand
- Tages-Recovery-Logik
- Satzbearbeitung und -löschung
- Vergleich mit dem letzten gleichen Training
- vergangene Trainingseinheiten
- Gemini im Tagescheck, Training, Trainingsabschluss und Ernährung
- natürlichsprachiger KI-Food-Log mit Rückfragen/Schätzungen
- eigene Lebensmittel
- Messungen, Krafttests und Fortschrittsfotos
- lokaler Speicher pro Browser/Nutzer
- PWA + Offline-Cache

## Version
V5.0.2


## V5.0.2 – Navigation Fix
- Die untere Hauptnavigation bleibt jetzt auch während eines laufenden/fortgesetzten Trainings sichtbar.
- Wechsel zu Heute, Essen, Fortschritt oder Mehr ist jederzeit möglich; die offene Trainingseinheit bleibt gespeichert und kann später fortgesetzt werden.
- Zusätzlicher Abstand unten verhindert, dass die Navigation Satz-Eingaben verdeckt.
