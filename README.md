# Cal Coach V5.3

Überarbeitete Version der hochgeladenen V5.2. Die App bleibt eine eigenständige statische Webapp: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, `icons/`, `assets/exercises/`, `404.html` und `.nojekyll` bleiben an ihren ursprünglichen Positionen. Kein Build und kein Framework erforderlich.

## Start und Update

1. Vor dem Update in der bisherigen App ein Backup exportieren.
2. Den gesamten ZIP-Inhalt entpacken und die Dateien einschließlich Assets auf demselben HTTPS-Webspace ersetzen. Die ZIP enthält keinen zusätzlichen übergeordneten Ordner.
3. Alle offenen App-Tabs bzw. PWA-Fenster schließen und die App erneut öffnen. Ein aktualisierter Service Worker übernimmt nach dem Schließen alter Fenster. Falls noch V5.2 erscheint, einmal online neu laden und erneut schließen/öffnen.
4. Unter Mehr → Einstellungen die gewünschten Bereiche wählen. Lokale Trainingsdaten bleiben bei gleicher Domain und gleichem Browser über den bisherigen Schlüssel `calisthenicsCoach_v2` erhalten. Bei einem Domainwechsel das Backup importieren.

Für einen lokalen Test: `python3 -m http.server 8080` im entpackten Ordner; anschließend `http://localhost:8080` öffnen. Ein Doppelklick auf `index.html` ist kein vollständiger PWA-Test. Installation und Service Worker benötigen HTTPS oder localhost. Nach erfolgreichem ersten Laden sind die App-Dateien und Übungsbilder offline verfügbar. KI benötigt Internet und einen eigenen Gemini-Key.

## Bedienung

- **Heute:** Tagescheck, nächste Einheit, optional kompakte Ernährung. Details bleiben eingeklappt.
- **Training:** geführtes Training, veränderbare Pläne, Zusatztraining und Verlauf.
- **Essen:** Eingabe, Tageswerte und einklappbarer Verlauf.
- **Fortschritt:** Wochenaktivität und animierte Zeitverläufe mit lesbaren aktuellen Werten. Zeigen auf einen Verlauf zeigt die Werte des nächstgelegenen Tages.
- **Mehr:** Skills, Roadmap, durchsuchbare Übungsbibliothek, Coach und Progressionsvorschläge.
- **Mehr → Einstellungen:** Profil, Ziele, Datensicherung, KI und Schalter für Ernährungsübersicht, Progressionen, Skills, Fotos, Übungsbilder sowie Animationen.

Das Ausschalten eines Bereichs löscht keine Daten. Tagescheck und Training bleiben Kernfunktionen. Für neue Profile sind automatische KI-Anfragen standardmäßig aus. Einstellungen vorhandener Profile werden übernommen.

## Übungen und Bilder

36 Übungseinträge einschließlich Warm-up und Handstand-Baustein. Ergänzt wurden erhöhte Push-ups als Einstieg, Kniebeugen und Glute Bridge. Die ursprünglichen Übungsstufen bleiben erhalten. 13 neue Illustrationen ersetzen unpassende Grundübungsbilder bzw. bebildern Ergänzungen. Tempo-Varianten können dieselbe Körperposition zeigen; Wall-HSPU-Negative und Teil-ROM verwenden eine als Beispiel gekennzeichnete HSPU-Position. Maßgeblich sind zusätzlich die Hinweise zu Tempo, Unterstützung und Bewegungsumfang. Die Bilder sind Illustrationen, keine Bewegungserkennung oder individuelle Technikkontrolle.

## KI und Daten

Gemini `gemini-3.5-flash-lite`, Interactions API mit `store:false`, Textauswertung über `steps`. Strukturierte Ernährungsausgaben werden als JSON angefragt und geprüft. Die Integration wurde anhand der offiziellen Google-Dokumentation und mit simulierten Antworten geprüft. Es wurde kein echter Kunden-API-Key verwendet. Ein erfolgreicher Live-Test und die Qualität einzelner KI-Empfehlungen sind deshalb nicht bestätigt.

Bei einer Anfrage gehen die benötigten Profil-, Trainings- oder Ernährungsinformationen an Google. Fortschrittsfotos und der vollständige Backup-Inhalt werden nicht an den Coach gesendet. Der API-Key bleibt im Browser und fehlt im exportierten Backup; in einer rein statischen Webapp ist er kein serverseitig geschütztes Geheimnis. Nutze diese Fassung mit deinem eigenen Schlüssel auf einem vertrauenswürdigen Gerät. Eine öffentliche App mit gemeinsamem Anbieter-Schlüssel benötigt ein Backend.

Quellen für den Schnittstellenabgleich:
- https://ai.google.dev/api/interactions-api
- https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026
- https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite

Details zu Korrekturen, Tests und verbleibenden Grenzen: `PRUEFBERICHT.md`.
