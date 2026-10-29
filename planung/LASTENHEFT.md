# LASTENHEFT – Calisthenics-Coach für iOS (Arbeitstitel „Drill“)

> Version 0.1 · Stand 29.10.2026 · Status: Entwurf zur Abstimmung
> Grundlage: `KONZEPT.md`

**Priorität:** **M** = Muss · **S** = Soll · **K** = Kann
**Phase:** **P1** MVP privat · **P2** Druck & Beweise · **P3** KI · **P4** App-Store-Release

---

## 1. Zielsetzung

### 1.1 Ziel
Eine native iOS-App, die Nutzern einen individuellen Trainings- und Ernährungsplan vorgibt, die Einhaltung per Beweis kontrolliert und durch eskalierende Erinnerungen, Alarme, App-Sperren und einen Begleiter mit Konsequenzen für konsequentes Durchziehen sorgt.

### 1.2 Muss-Ziele
- Individueller Plan (Training + Ernährung + Zeitraum + Ziele) aus einem KI-gestützten Onboarding
- Tägliche, zeitgebundene Aufgaben mit Beweispflicht
- Eskalation, die erst mit erbrachtem Beweis endet
- Einstellbarer, aber nie abschaltbarer Härtegrad
- Begleiter, dessen Zustand die Disziplin abbildet
- Schlichte Oberfläche mit Fokus auf die aktuelle Aufgabe

### 1.3 Abgrenzung (Nicht-Ziele)
- Kein Kalorien-/Makro-Tracking durch den Nutzer
- Kein soziales Netzwerk, kein Feed
- Keine Android-Version (vorerst)
- Keine medizinische Beratung, keine Therapie
- Keine echten Telefonanrufe (technisch/Store nicht zulässig) – stattdessen Alarme

## 2. Ausgangssituation

Die bestehende Web-App „Cal Coach V5.3“ (statische PWA) ist überladen, fühlt sich nicht wie eine App an, hat keine Benachrichtigungen, keine aussagekräftige Statistik und eine unbefriedigende Trainingslogik. Der KI-Schlüssel liegt im Browser. Die neue App wird von Grund auf neu entwickelt, in einem neuen Repository.

## 3. Produkteinsatz

### 3.1 Zielgruppe
- **P1–P3:** der Auftraggeber selbst (ein Nutzer, ein iPhone)
- **P4:** Erwachsene (18+), die abnehmen, Muskeln aufbauen oder Calisthenics-Skills lernen wollen und bewusst externe Kontrolle suchen

### 3.2 Nutzungsumgebung
- iPhone mit iOS 26 oder neuer, optional Apple Watch
- Zuhause, Park, Gym; Training teils ohne Internet

## 4. Funktionale Anforderungen

### 4.1 Onboarding (ONB)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| ONB-01 | Die App erfasst Profildaten: Alter, Geschlecht, Größe, Gewicht, Verletzungen/Einschränkungen. | M | P1 |
| ONB-02 | Die App erfasst Ziele (Abnehmen, Muskelaufbau, Skills, Kombination) und einen Wunsch-Zeitraum. | M | P1 |
| ONB-03 | Die App erfasst Tagesrhythmus: Aufsteh-/Schlafzeit, Arbeitszeiten, Trainingstage und -zeitfenster. | M | P1 |
| ONB-04 | Die App erfasst verfügbares Equipment und Trainingsort. | M | P1 |
| ONB-05 | Die App erfasst Ernährungsrahmen: Mahlzeiten/Tag, Abneigungen, Allergien, Ernährungsform, Kochbereitschaft, Budget. | M | P1 |
| ONB-06 | Die App führt einen Leistungstest durch (max. Push-ups, Klimmzüge, Squats, Plank, Hollow Hold), Zählung per Kamera oder manuell. | M | P1 (manuell) / P2 (Kamera) |
| ONB-07 | Die KI bewertet alle Angaben und erzeugt: Einschätzung, Ziele, Zeitraum mit Phasen, Trainingsplan, Essensplan, Einkaufsliste, Tagesplan-Vorlage. | M | P3 |
| ONB-08 | Ohne KI (P1) wird der Plan regelbasiert aus Vorlagen erzeugt. | M | P1 |
| ONB-09 | Der Nutzer kann den Vorschlag im Dialog mit der KI anpassen, bevor er ihn annimmt. | S | P3 |
| ONB-10 | Der Nutzer wählt den Härtegrad (Stufe 1–4). | M | P1 |
| ONB-11 | Der Nutzer bestätigt einen „Vertrag“ (Ziel, Zeitraum, Härtegrad, Konsequenzen) per Unterschrift. | S | P1 |
| ONB-12 | Die App fordert alle Berechtigungen einzeln mit Begründung an (Benachrichtigungen, Alarme, Kamera, Bildschirmzeit, Health). | M | P1/P2 |
| ONB-13 | Gesundheits-Screening: Bei Warnsignalen (z. B. BMI < 18,5, Essstörung angegeben, Herzprobleme) werden strenge Ernährungsvorgaben deaktiviert und ein ärztlicher Rat empfohlen. | M | P1 |
| ONB-14 | Altersprüfung: Nutzung erst ab 18 Jahren. | M | P4 |

### 4.2 Programm & Tagesplan (PLN)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| PLN-01 | Ein Programm hat Start, Ende, Phasen (z. B. 3 × 4 Wochen), Ziele und Härtegrad. | M | P1 |
| PLN-02 | Die App erzeugt für jeden Tag einen Tagesplan aus Aufgaben (Mahlzeit, Training, Wiegen, Schlaf, Wasser, Sonstiges). | M | P1 |
| PLN-03 | Jede Aufgabe hat: Titel, Inhalt, Zeitfenster (Beginn, Fälligkeit, Verfallszeit), Beweisart, Eskalationsprofil, Status. | M | P1 |
| PLN-04 | Aufgabenstatus: geplant → fällig → überfällig → erledigt / verpasst / Joker / pausiert. | M | P1 |
| PLN-05 | Der Tagesplan für morgen steht spätestens am Vorabend fest und wird angezeigt. | M | P1 |
| PLN-06 | Der Nutzer kann Aufgaben nicht löschen und nur im Rahmen des Härtegrads verschieben. | M | P1 |
| PLN-07 | Wöchentliche Anpassung: Nach der Wochenbilanz werden Mengen und Progression für die Folgewoche angepasst. | M | P1 (Regeln) / P3 (KI) |
| PLN-08 | Ausnahmen: Krankheit, Verletzung, Urlaub als **Pause** mit Begründung; Dauer und Häufigkeit je Härtegrad begrenzt. | M | P1 |
| PLN-09 | Bei Verletzung: betroffene Übungen werden ersetzt statt komplett pausiert. | S | P3 |

### 4.3 Ernährung (ERN)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| ERN-01 | Die App gibt pro Mahlzeit konkret vor, was gegessen wird (Gericht, Zutaten, Mengen in g/Stück). | M | P1 |
| ERN-02 | Der Essensplan nutzt bewusst wenige, wiederkehrende Gerichte (z. B. 2–3 Varianten pro Mahlzeit). | S | P1 |
| ERN-03 | Zu jedem Gericht gibt es eine Kurzanleitung (Zubereitung, Zeit). | S | P1 |
| ERN-04 | Die App erzeugt eine wöchentliche Einkaufsliste mit Abhaken. | M | P1 |
| ERN-05 | Optional Meal-Prep-Aufgabe (z. B. Sonntag vorkochen). | K | P3 |
| ERN-06 | Gerichte können einmalig gegen eine gleichwertige Alternative getauscht werden (Anzahl je Härtegrad). | S | P3 |
| ERN-07 | Kalorienwerte sind intern hinterlegt, werden dem Nutzer aber nicht als Tracking-Aufgabe gezeigt. | M | P1 |
| ERN-08 | Sicherheitsgrenzen: Mindestzufuhr (Richtwert ≥ Grundumsatz), max. Defizit ca. 20–25 %, max. Abnahme ca. 1 % Körpergewicht/Woche. Die KI darf diese Grenzen nicht unterschreiten. | M | P1 |
| ERN-09 | „Außer Plan gegessen“ kann ehrlich gemeldet werden (Foto); dies wirkt milder als ein verpasster Beweis. | S | P2 |

### 4.4 Training (TRN)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| TRN-01 | Trainingsplan mit festen Einheiten (z. B. A/B/C) pro Woche, an den Tagesplan gebunden. | M | P1 |
| TRN-02 | Übungsdatenbank mit Progressionsketten je Bewegungsmuster (Drücken, Ziehen, Beine, Core, Skills). | M | P1 |
| TRN-03 | Geführter Modus: eine Übung nach der anderen, Satz/Wdh./Haltezeit, Pausentimer, Bild/Animation der Ausführung. | M | P1 |
| TRN-04 | Erfassung je Satz: Wiederholungen bzw. Haltezeit, optional Anstrengung (RPE). | M | P1 |
| TRN-05 | Automatische Progression: Ziel in 2 aufeinanderfolgenden Einheiten erreicht → nächste Stufe bzw. mehr Volumen; deutlich verfehlt → Rückstufung. | M | P1 |
| TRN-06 | Aufwärmen ist Teil jeder Einheit und wird nicht übersprungen. | S | P1 |
| TRN-07 | Skill-Ziele (Handstand, Muscle-up, Front Lever, Planche, Pistol …) steuern die Übungsauswahl. | S | P1 |
| TRN-08 | Schmerz-Button während des Trainings: Übung ersetzen, Einheit sicher beenden, Hinweis protokollieren. | M | P1 |
| TRN-09 | Sprachansagen (Satzbeginn, Pause vorbei, Coach-Sprüche). | K | P2 |
| TRN-10 | Apple-Watch-Begleitung (Timer, Herzfrequenz, Satz bestätigen). | K | P4 |

### 4.5 Beweise (BEW)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| BEW-01 | Foto-Beweis nur über die In-App-Kamera, kein Galerie-Import. | M | P1 |
| BEW-02 | Jedes Foto wird mit Zeitstempel und Aufgabenbezug gespeichert. | M | P1 |
| BEW-03 | Duplikaterkennung: Ähnliche/gleiche Fotos (Bild-Hash) werden abgelehnt. | S | P2 |
| BEW-04 | KI prüft Mahlzeitenfotos: Entspricht das Gericht der Vorgabe? Menge plausibel? Ergebnis: akzeptiert / Rückfrage / abgelehnt mit Begründung. | M | P3 |
| BEW-05 | Strenge der KI-Prüfung richtet sich nach dem Härtegrad. | S | P3 |
| BEW-06 | Zufallskontrollen (Stufe 3–4): kurzfristige Aufforderung, z. B. „Zeig deinen Teller jetzt“ (Frist 2 min). | K | P3 |
| BEW-07 | Training wird per Kamera-Posenerkennung (Wiederholungen zählen) belegt, alternativ über Watch/HealthKit-Workout mit Herzfrequenz. | M | P2 |
| BEW-08 | Wiegen per Foto der Waage-Anzeige (Zahl wird erkannt und bestätigt). | S | P2 |
| BEW-09 | Bis P2 genügt in P1 eine Bestätigung im geführten Training als Beweis. | M | P1 |
| BEW-10 | Fotos werden nach der Prüfung nur lokal behalten; serverseitig keine dauerhafte Speicherung. | M | P3 |

### 4.6 Erinnerungen & Eskalation (ESK)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| ESK-01 | Vorab-Hinweis vor Fälligkeit (Standard 15 min). | M | P1 |
| ESK-02 | Bei Fälligkeit „Time Sensitive“-Benachrichtigung (durchbricht Fokus-Modi, sofern erlaubt). | M | P1 |
| ESK-03 | Danach wiederholte Benachrichtigungen im Intervall des Härtegrads, bis der Beweis vorliegt oder die Aufgabe verfällt. | M | P1 |
| ESK-04 | Ab der festgelegten Schwelle Vollbild-Alarm über AlarmKit (klingelt auch lautlos/gesperrt). | M | P1 |
| ESK-05 | Mit Beweis werden alle ausstehenden Benachrichtigungen/Alarme der Aufgabe sofort entfernt. | M | P1 |
| ESK-06 | Benachrichtigungen sind direkt aktionsfähig („Jetzt beweisen“ öffnet die Kamera). Kein „Erledigt“-Knopf ohne Beweis. | M | P1 |
| ESK-07 | Texte eskalieren in Ton und Inhalt (Bezug auf Glut, Serie, Vertrag). | S | P1 |
| ESK-08 | Live Activity auf Sperrbildschirm/Dynamic Island mit nächster Aufgabe und Countdown. | S | P2 |
| ESK-09 | App-Sperre (Bildschirmzeit-API): Vom Nutzer gewählte Apps werden ab Schwelle gesperrt, bis der Beweis vorliegt. | M | P2 |
| ESK-10 | Notfall-Freigabe der Sperre ist immer möglich (z. B. Telefon, Karten, Notruf nie gesperrt), kostet aber einen Joker bzw. Glut-Energie. | M | P2 |
| ESK-11 | Die App erkennt deaktivierte Berechtigungen/Benachrichtigungen und reagiert (Hinweis, Glut-Schaden). | S | P1 |
| ESK-12 | iOS-Limit von 64 geplanten lokalen Benachrichtigungen wird durch rollierende Planung eingehalten. | M | P1 |
| ESK-13 | Ruhezeiten: Zwischen Schlafenszeit und Aufstehen keine Eskalation (außer Schlaf-Aufgabe selbst). | M | P1 |

### 4.7 Härtegrad (HRT)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| HRT-01 | 4 Stufen (Konsequent, Streng, Hart, Drill); eine Stufe „aus“ existiert nicht. | M | P1 |
| HRT-02 | Jede Stufe definiert: Erinnerungsintervall, Alarm-Schwelle, App-Sperre, Joker/Monat, Prüfstrenge, Glut-Schaden, Coach-Ton, Pausen-Kontingent (Werte siehe KONZEPT.md §4). | M | P1 |
| HRT-03 | Erhöhen sofort möglich. | M | P1 |
| HRT-04 | Senken nur um eine Stufe, mit Begründung, wirksam nach 72 h, max. 1× pro Woche. | M | P1 |
| HRT-05 | Joker: setzt eine Aufgabe ohne Glut-Schaden aus; Kontingent pro Monat je Stufe; nicht übertragbar. | M | P1 |

### 4.8 Begleiter (BGL)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| BGL-01 | Ein Begleiter (Vorschlag: „Glut“) mit Energie 0–100 spiegelt die Erfüllung wider. | M | P1 |
| BGL-02 | Erledigte Aufgaben erhöhen, verpasste senken die Energie; Gewichtung je Aufgabentyp und Härtegrad. | M | P1 |
| BGL-03 | Langfristige Entwicklungsstufe wächst mit Trainingsfortschritt und Serie. | S | P1 |
| BGL-04 | Bei Energie 0 „stirbt“/erlischt der Begleiter: Serie und Entwicklungsstufe zurückgesetzt, Eintrag im Archiv. | M | P1 |
| BGL-05 | Neustart nur über eine Bewährungsphase (z. B. 3 Tage 100 % Erfüllung). | S | P1 |
| BGL-06 | Begleiter erscheint in Widgets, Live Activity und Benachrichtigungstexten. | S | P2 |
| BGL-07 | Animierte Zustände (stark, normal, schwach, kritisch, erloschen). | S | P2 |

### 4.9 KI-Coach (KI)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| KI-01 | KI-Aufrufe laufen ausschließlich über ein eigenes Backend; kein API-Schlüssel auf dem Gerät. | M | P3 |
| KI-02 | Funktionen: Onboarding-Bewertung, Planerstellung, Plananpassung, Foto-Prüfung, Wochenbilanz, Coach-Chat. | M | P3 |
| KI-03 | KI-Ausgaben für Pläne sind strukturiert (JSON nach festem Schema) und werden vor Übernahme validiert (Schema, Sicherheitsgrenzen ERN-08, Equipment, Zeitfenster). | M | P3 |
| KI-04 | Ungültige oder unsichere KI-Ausgaben werden verworfen und durch regelbasierte Fallbacks ersetzt. | M | P3 |
| KI-05 | Coach-Ton richtet sich nach Härtegrad; nie beleidigend bzgl. Körper/Aussehen, keine Scham über Gewicht. | M | P3 |
| KI-06 | An die KI werden nur die für die Anfrage nötigen Daten gesendet. | M | P3 |
| KI-07 | Kosten pro Nutzer und Monat werden protokolliert; Rate-Limit pro Nutzer. | S | P3 |

### 4.10 Fortschritt & Statistik (STA)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| STA-01 | Erfüllungsquote pro Woche, getrennt nach Ernährung und Training. | M | P1 |
| STA-02 | Gewichtsverlauf mit geglätteter Trendlinie (z. B. 7-Tage-Mittel). | M | P1 |
| STA-03 | Kraftstand: aktuelle Progressionsstufe je Bewegungsmuster + Bestleistungen. | M | P1 |
| STA-04 | Aktuelle und längste Serie, Begleiter-Archiv. | M | P1 |
| STA-05 | Prognose: Erreichen des Ziels bis Programmende auf Basis des Trends. | S | P3 |
| STA-06 | Fortschrittsfotos im Vergleich (Start vs. heute), nur lokal. | K | P2 |
| STA-07 | Keine Statistik ohne Aussage; jede Kennzahl mit kurzem Satz („Du liegst 1,2 kg vor Plan“). | S | P1 |

### 4.11 Wochenbilanz (WOB)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| WOB-01 | Wöchentliche Bilanz an festem Tag: Erfüllung, Gewicht, Kraft, Begleiter. | M | P1 |
| WOB-02 | Bilanz enthält die Anpassungen der Folgewoche (was ändert sich und warum). | M | P1 (Regeln) / P3 (KI) |
| WOB-03 | Nutzer gibt kurzes Feedback (Hunger, Energie, Schlaf, Schmerzen) – fließt in Anpassung ein. | S | P1 |

### 4.12 Einstellungen & Daten (EIN)

| ID | Anforderung | Prio | Phase |
|---|---|---|---|
| EIN-01 | Profil, Zeiten, Equipment, App-Sperrliste, Härtegrad (gemäß HRT) änderbar. | M | P1 |
| EIN-02 | Änderungen an Zeiten wirken ab dem Folgetag. | S | P1 |
| EIN-03 | Datenexport (JSON) und vollständige Löschung aller Daten. | M | P1 |
| EIN-04 | Backup/Sync über iCloud (CloudKit). | S | P2 |
| EIN-05 | Programm abbrechen nur mit Bestätigung + Wartezeit (24 h); Daten bleiben erhalten. | S | P1 |

## 5. Produktdaten (Hauptobjekte)

| Objekt | Wesentliche Inhalte |
|---|---|
| Nutzerprofil | Stammdaten, Gesundheitsangaben, Zeiten, Equipment, Ernährungsrahmen |
| Programm | Zeitraum, Phasen, Ziele, Härtegrad, Vertrag |
| Tagesplan | Datum, Aufgaben |
| Aufgabe | Typ, Inhalt, Zeitfenster, Beweisart, Eskalationsprofil, Status, Verlauf |
| Beweis | Typ, Zeitpunkt, Foto/Messwerte, Prüfergebnis, Begründung |
| Essensplan / Gericht | Gerichte, Zutaten, Mengen, Nährwerte (intern), Anleitung |
| Einkaufsliste | Woche, Positionen, abgehakt |
| Trainingsplan / Einheit | Übungen, Sätze, Ziele, Pausen |
| Übung / Progressionskette | Muster, Stufen, Kriterien, Medien |
| Trainingsprotokoll | Einheit, Sätze, Ist-Werte, RPE, Schmerzmeldungen |
| Körperwerte | Gewicht, optional Umfang, Fotos |
| Begleiter | Energie, Stufe, Zustand, Archiv |
| Härtegrad-Historie | Änderungen mit Zeitpunkt und Begründung |
| Joker/Pausen | Kontingent, Verbrauch |
| Ereignisprotokoll | Erinnerungen, Alarme, Sperren, Reaktionen |

Speicherung lokal (SwiftData), Sync über CloudKit (P2), nur KI-relevante Ausschnitte an das Backend (P3).

## 6. Nichtfunktionale Anforderungen (NFA)

| ID | Anforderung | Prio |
|---|---|---|
| NFA-01 | **Offline:** Tagesplan, Training, Erinnerungen, Alarme, Beweis-Fotos funktionieren ohne Internet; KI-Prüfungen werden nachgeholt. | M |
| NFA-02 | **Zuverlässigkeit:** Erinnerungen/Alarme lösen auch aus, wenn die App beendet ist (lokal geplant). | M |
| NFA-03 | **Performance:** App-Start bis „Jetzt“-Bildschirm < 1 s; Kamera bereit < 1 s. | S |
| NFA-04 | **Akku:** Posenerkennung nur während aktiver Sätze; keine dauerhafte Hintergrundaktivität. | M |
| NFA-05 | **Datenschutz:** Local-first, DSGVO-konform, Datenschutzerklärung, Gesundheitsdaten als besondere Kategorie behandelt, Fotos nicht dauerhaft auf Servern. | M |
| NFA-06 | **Sicherheit:** API-Schlüssel nur serverseitig; Backend mit Geräte-/Nutzer-Authentifizierung (App Attest). | M |
| NFA-07 | **Bedienbarkeit:** Jede Aufgabe ist aus der Benachrichtigung in ≤ 2 Taps beweisbar. | M |
| NFA-08 | **Design:** Schlicht, max. 3 Tabs, Hauptbildschirm zeigt eine Aufgabe; Dark Mode; Dynamic Type; VoiceOver-Grundunterstützung. | M |
| NFA-09 | **Sprache:** Deutsch, lokalisierbar vorbereitet (Englisch in P4). | M |
| NFA-10 | **Wartbarkeit:** Modulare Architektur (Plan-Engine, Eskalation, Beweise, Begleiter, KI-Client getrennt), Unit-Tests für Plan-Engine, Progression, Eskalation, Härtegrad-Regeln. | M |
| NFA-11 | **Gesundheit:** Hinweis „kein medizinischer Rat“, Sicherheitsgrenzen gemäß ERN-08, Schmerz-/Krankheitsmodus immer erreichbar. | M |
| NFA-12 | **Erweiterbarkeit:** Architektur für späteren Store-Release (Accounts, Abo) ohne Neubau. | M |

## 7. Benutzeroberfläche

- **Tab „Jetzt“:** Begleiter · aktuelle Aufgabe (Titel, Inhalt, Countdown, Button „Beweisen“) · kompakte Tageszeitleiste
- **Tab „Fortschritt“:** Erfüllung · Gewichtstrend · Kraftstufen · Serie · Archiv
- **Tab „Profil“:** Programm & Vertrag · Härtegrad · Einkaufsliste · Coach-Chat · Einstellungen
- **Kontextansichten:** Beweis-Kamera · geführtes Training · Wochenbilanz · Pause/Krankheit · Onboarding
- **Systemflächen:** Benachrichtigungen mit Aktionen · AlarmKit-Alarm · Live Activity · Widgets (klein: Begleiter, mittel: nächste Aufgabe)

## 8. Technische Rahmenbedingungen

| Bereich | Festlegung |
|---|---|
| Plattform | iOS 26+ (iPhone), Swift 6, SwiftUI |
| Entwicklung | Mac mini (Apple Silicon), Xcode, eigenes Git-Repository (neu) |
| Daten | SwiftData; CloudKit-Sync (P2) |
| System-Frameworks | UserNotifications, AlarmKit, ActivityKit, WidgetKit, FamilyControls/ManagedSettings/DeviceActivity, Vision (Posen), AVFoundation, HealthKit, App Intents |
| Backend (P3) | Schlanke Serverfunktionen (z. B. Cloudflare Workers oder Supabase), LLM mit Bildverständnis (Anbieter offen) |
| Konto | Apple Developer Program (99 €/Jahr) für Gerätebetrieb > 7 Tage, Entitlements, TestFlight |
| Entitlements | Family Controls (Distribution-Freigabe bei Apple beantragen für P4), AlarmKit, HealthKit, Time Sensitive Notifications |

## 9. Risiken

| Risiko | Auswirkung | Gegenmaßnahme |
|---|---|---|
| Apple verweigert Family-Controls-Distribution | Keine App-Sperre im Store | Früh beantragen; App funktioniert auch ohne Sperre |
| App-Store-Prüfung (Gesundheit, „Belästigung“) | Ablehnung | Sicherheitsgrenzen, Nutzer wählt Härte selbst, klare Einwilligung, Notfall-Freigabe |
| KI-Fehlurteile bei Fotos | Frust, Vertrauensverlust | Rückfrage-Status statt Ablehnung bei Unsicherheit, Einspruch möglich |
| Nutzer deaktiviert Benachrichtigungen | Konzept wirkungslos | Erkennen + Konsequenz (ESK-11), App-Sperre als zweiter Kanal |
| Psychische Belastung / Essstörungen | Gesundheitsschaden | Screening (ONB-13), Ton-Regeln (KI-05), Pausenmodus |
| KI-Kosten | Laufende Kosten | Kleine Modelle für Prüfungen, Caching, Rate-Limits |

## 10. Abnahmekriterien (MVP P1)

1. Onboarding erzeugt einen vollständigen Plan (Training, Essen, Einkaufsliste, Tagesrhythmus) ohne KI.
2. Eine fällige Mahlzeit erzeugt Erinnerung → Wiederholungen → AlarmKit-Alarm gemäß Härtegrad – auch bei beendeter App.
3. Ein Foto über die In-App-Kamera beendet sofort alle Erinnerungen der Aufgabe.
4. Galerie-Import ist nicht möglich.
5. Ein geführtes Training protokolliert Sätze; die Progression greift nach 2 erfolgreichen Einheiten.
6. Verpasste Aufgaben senken die Begleiter-Energie; bei 0 erlischt er und die Serie wird zurückgesetzt.
7. Härtegrad senken ist erst nach 72 h wirksam; erhöhen sofort.
8. Statistikseite zeigt Erfüllung, Gewichtstrend, Kraftstufen, Serie.
9. Unit-Tests für Plan-Engine, Eskalation, Progression und Härtegrad laufen grün.

## 11. Glossar

| Begriff | Bedeutung |
|---|---|
| Aufgabe | Zeitgebundene Vorgabe (Mahlzeit, Training, Wiegen …) mit Beweispflicht |
| Beweis | Nachweis der Erfüllung (Foto, Kamera-Zählung, Watch-Daten) |
| Eskalation | Zunehmende Erinnerungsstufen bis zum Beweis |
| Härtegrad | Nutzerwahl 1–4, steuert Strenge aller Mechaniken |
| Joker | Kontingent, um eine Aufgabe ohne Strafe auszusetzen |
| Begleiter / Glut | Visuelle Figur, deren Zustand die Disziplin abbildet |
| Vertrag | Bestätigte Selbstverpflichtung zu Ziel, Zeitraum, Härte |
| AlarmKit | iOS-Framework (ab iOS 26) für wecker-artige Alarme |
| Bildschirmzeit-API | FamilyControls/ManagedSettings – Sperren anderer Apps |

## 12. Offene Punkte

- [ ] Begleiter final festlegen (KONZEPT.md §3)
- [ ] App-Name
- [ ] Konkrete Glut-Werte (Punkte pro Aufgabe, Abbau pro Tag)
- [ ] Pausen-Kontingent je Härtegrad
- [ ] KI-Anbieter, Backend-Plattform, Kostenrahmen
- [ ] Monetarisierung (P4)
- [ ] Design-Richtung / Styleguide
- [ ] Übernahme alter Übungsbilder oder neuer Bildstil
