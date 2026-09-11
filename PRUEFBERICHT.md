# Prüfbericht · Cal Coach V5.3

Stand: 11. September 2026. Ausgangspunkt: Calisthenics-Coach-V5.2-Adaptive-Pro-FINAL.zip.

## Änderungen mit funktionalem Nutzen

- Tagescheck blockiert die Navigation zu Einstellungen, Verlauf und anderen Ansichten nicht mehr. Der Trainingsstart bleibt an den Belastungscheck gekoppelt.
- Zwei gewählte Krafttage führen am Wochenende zu Regeneration. Ohne Bänder entfallen Bandübungen im Heimtraining und Bandteile des Warm-ups. Der Heimtag erhält ein Warm-up; Anfänger bekommen eine erhöhte Push-up-Variante. Glute Bridge ergänzt die Hüftstreckung.
- Bei LIGHT/REDUCED wird die Satzanzahl der gestarteten Einheit tatsächlich reduziert. Der gespeicherte Trainingsplan wird dabei nicht überschrieben.
- Laufende Einheiten speichern einen eigenen Planstand. Eine spätere Planänderung verändert die laufende Einheit nach einem Neustart nicht.
- Vollständig protokollierte, noch nicht abgeschlossene Einheiten werden nicht mehr als vermeintlich veraltete Daten gelöscht. Bereits gespeicherte Doppelgänger werden weiterhin entfernt.
- Abschluss ist gegen doppelte Speicherung geschützt; mehrfache Satzklicks während einer Pause werden abgefangen. Schutz bei STOP-Belastungsstatus auch beim Satzeintrag und Handstand-Timer.
- Pausen basieren auf einer Endzeit statt auf der Anzahl von Timer-Ticks. Rückkehr aus dem Hintergrund gleicht die Anzeige ab. Verkürzte Skill-Timer zählen nicht als vollständig absolviert, wenn sie übersprungen werden.
- Planeditor erhält ungespeicherte Felder beim Hinzufügen weiterer Übungen. Doppelte Übungen werden abgewiesen, weil die Logstruktur Übungen anhand ihrer ID ablegt. Auch Progressionsübernahme darf keine doppelte Zielübung erzeugen.
- Benutzerdefinierter B-Tag funktioniert ohne dynamische Beinwahl. KI-Pläne akzeptieren nur bekannte Übungen, entfernen doppelte IDs, begrenzen Umfänge und erhalten die zur Übung gehörende Einheit.
- Namen und weitere Texte werden an relevanten HTML-Ausgabestellen maskiert. Zusätzliche Content Security Policy erlaubt Skripte nur aus der eigenen App.
- Import prüft Struktur, Übungen, Sätze, Mahlzeiten, unzulässige Schlüssel und Fotodaten vor der Übernahme. Fotoimporte verwenden eine IndexedDB-Transaktion. Speicherfehler werden sichtbar gemeldet. Neuanlage eines Profils entfernt auch den alten API-Key.
- Kurven berücksichtigen echte Datumsabstände. Fehlende Tage werden nicht zu erfundenen Nullwerten. Trendindex für Band-/Widerstandsübungen wird auf einen Satz bezogen, damit mehr Sätze nicht allein einen Leistungsanstieg vortäuschen. Der Index ist weiterhin eine Heuristik, kein physikalischer Kraftwert.
- Animierte Wochenaktivität und Verlaufskurven; Textwerte bleiben zugänglich. Animationen sind abschaltbar und beachten `prefers-reduced-motion`.
- Durchsuchbare Bibliothek mit 36 Bausteinen und 13 ergänzten Illustrationen. Bestehende, zur Grundübung passende Bilder bleiben erhalten.
- KI: Hauptschalter, automatische Analysen separat schaltbar, verständliche Offline-/Timeout-/Limitfehler, Prüfung unvollständiger Antworten, Validierung von Nährwerten und Schutz vor bestimmten konkurrierenden Anfragen. Tages-/Essens-Cache merkt sich den angefragten Datenstand. Ein verspäteter Planvorschlag überschreibt keinen inzwischen geöffneten anderen Planeditor.
- Service Worker beschränkt sich auf den eigenen App-Pfad, schützt fremde Caches, liefert bei fehlenden Bildern keine HTML-Seite und hält die App-Dateien einer Version zusammen. Navigation erhält Browser-Zurück-Unterstützung.

## Ausgeführte Tests

31 erfolgreiche Funktionsszenarien in einer DOM-Testumgebung mit simuliertem IndexedDB und Canvas-Kontext, keine dabei erfassten DOM-Laufzeitfehler:

1. Start der App und Anzahl der Übungseinträge.
2. Existenz aller Übungsbildpfade.
3. ISO-Woche, Sonntag und Schaltjahr.
4. Zwei-/Drei-Tage-Auswahl.
5. Anfänger- und Ohne-Band-Anpassung.
6. Recovery-Grenzen und blockierter Start.
7. Reduzierter Trainingsumfang.
8. Benutzerdefinierter B-Plan ohne Beinwahl.
9. Unveränderlicher Planstand einer laufenden Einheit.
10. Erhalt vollständig protokollierter, noch offener Einheiten.
11. Einmaliger Trainingsabschluss.
12. Vollständiger Satzablauf mit Schutz gegen Doppelklicks.
13. Ablehnen doppelter Planübungen.
14. Erhalt ungespeicherter Editorfelder.
15. Mahlzeitensummen und maskierte HTML-Eingabe.
16. Übungssuche.
17. Anzeigeschalter und Navigation ohne Tagescheck.
18. Migration eines gültigen Backups.
19. Ablehnen fehlerhafter Backups.
20. Fehlerhaftes KI-JSON.
21. Chart-Aufruf mit Daten und Leerzustand.
22. Vergleichbarer Lastindex bei unterschiedlicher Satzanzahl.
23. Deadline-Timer nach verstrichener Hintergrundzeit.
24. Ablehnen nichtnumerischer KI-Nährwerte.
25. Alle Übungskategorien sowie erfolglose Suche.
26. Progression ohne doppelte Zielübung.
27. Gemini-Anfrage und Antwortverarbeitung mit Testantwort.
28. Anfragelimit mit Testantwort.
29. Unvollständige KI-Antwort mit Testantwort.
30. KI-Schalter verhindert Anfragen.
31. Fotoablage: Schreiben, Lesen, Löschen.

7 weitere erfolgreiche Service-Worker-Szenarien mit simulierten Cache-/Netzwerkfunktionen: vorhandene Precache-Dateien, Erhalt fremder Caches, keine KI-Caches, Pfadabgrenzung, kein HTML-Ersatz für Bilder, Navigation aus dem Cache und Nachladen erfolgreicher Assets.

Zusätzlich: JavaScript-Syntaxprüfung, ZIP-Struktur und Dateiintegrität; visuelle Inspektion der ursprünglichen und generierten Übungsbilder.

## Grenzen der Prüfung

Dies ist keine Garantie, dass jeder denkbare Fehler ausgeschlossen ist. Die Tests prüfen gezielte Szenarien und den Quellcode; sie ersetzen keine vollständige Geräteabnahme. Ein Chromium-Start war in der bereitgestellten Umgebung nicht möglich. Daher wurden mobile/desktop Screenshots, tatsächliches CSS-Layout, Browser-Animationen, Touch-Verhalten und PWA-Installation auf iOS/Android nicht abschließend visuell geprüft. Canvas-Aufrufe und Offline-Logik wurden simuliert geprüft; der reale Browser-Cache wurde nicht durch einen End-to-End-Test bestätigt.

Ein Live-Aufruf mit einem gültigen Gemini-Schlüssel wurde nicht ausgeführt. Modellverfügbarkeit, Kontingente, Abrechnung, CORS-Verhalten auf deinem konkreten Host und die inhaltliche Qualität einzelner Empfehlungen sind vor dem produktiven Einsatz zu prüfen. KI-Ausgaben können trotz Strukturprüfung sachlich falsch sein. Die App ist weiterhin eine lokale, statische PWA ohne Konten, Cloud-Synchronisation oder Server-Backend.

Die Trainings- und Ernährungsheuristiken wurden technisch geprüft, nicht klinisch validiert. Automatische Progression wertet protokollierte Zahlen aus; sie kann die tatsächliche Bewegungsausführung nicht beurteilen. Verlaufseinträge und Fortschrittsfotos bleiben lokal; ein Export ist für dauerhafte Sicherung weiterhin wichtig.

## Erzeugte Bilder

Built-in-Bildgenerierung, ein Einzelbild pro Übung, anschließend visuell inspiziert. Gemeinsamer Prompt: realistische Fitnessillustration, dunkles navyfarbenes Studio, schwarze ärmellose Kleidung, eine Person, vollständige Körperposition, keine Schrift. Übungsspezifische Vorgaben: erhöhte Pike-Push-ups mit Füßen auf Bank; Wall HSPU mit gebeugten Ellenbogen; Hanging Leg Raise mit gestreckten waagerechten Beinen; Towel Hang mit Handtuchgriff; Decline Push-up mit erhöhten Füßen; Inverted Row mit erhöhten Füßen; freier Pistol Squat; strikte Toes-to-Bar; Pseudo-Planche Push-up mit Schultern vor den Händen; Incline Push-up mit Händen auf Bank; Glute Bridge; Kniebeuge; Assisted Dip mit Fußunterstützung auf stabiler Box. Dateien liegen unter `assets/exercises/`.
