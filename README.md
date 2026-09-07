# Calisthenics Coach V4.3 Guided AI

V4.3 behebt die Trainings-Sperre grundlegend und integriert Gemini direkt in die geführten Abläufe statt nur als Chat auf der Startseite.

## Training: keine Sackgassen mehr
- A, B und C sind jederzeit auswählbar. Eine offene Einheit sperrt die anderen Tabs nicht mehr.
- Wenn noch eine alte/offene Einheit existiert, kann man sie fortsetzen oder ausdrücklich verwerfen.
- Auch im laufenden Coach gibt es „Offene Einheit verwerfen“.
- Alte vollständig gespeicherte Rest-Sessions werden automatisch bereinigt.
- Vergangene Trainings bleiben einsehbar, bearbeitete Sätze werden lokal gespeichert.

## Gemini jetzt im Ablauf
Mit eigenem Gemini-Key erscheint KI kontextuell an mehreren Stellen:
- Tagescheck: Recovery-Analyse direkt im Check-Ergebnis.
- Training: kurzer Gemini-Tipp nach jedem Satz; normaler lokaler Vergleich bleibt zusätzlich bestehen.
- Trainingsende: automatische Zusammenfassung und Vergleich mit der letzten gleichen Einheit.
- Trainingsverlauf: jede gespeicherte Einheit kann nachträglich von Gemini analysiert werden.
- Essen: KI-Tipp direkt nach dem geführten Essen sowie als Karte im Food-Tracker.
- Startseite: freier Coach-Chat bleibt zusätzlich bestehen.

Unter Mehr → KI Coach kann jede Person getrennt einstellen, ob KI nach Tagescheck, Training und Essen automatisch laufen soll.

## Datenschutz / Bring your own key
Der Gemini-Key wird separat nur im lokalen Browser gespeichert und nicht im App-Backup exportiert. Da die App statisch über GitHub Pages läuft, wird der Key für Gemini-Anfragen direkt aus dem Browser an Google gesendet. Für maximale Sicherheit wäre ein Backend besser; V4.3 bleibt bewusst beim gewünschten BYOK-Modell.

## Daten
Der Hauptspeicher-Key bleibt `calisthenicsCoach_v2`, damit vorhandene Trainings-, Ernährungs- und Profildaten bei Updates erhalten bleiben.
