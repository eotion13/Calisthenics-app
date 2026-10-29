# KONZEPT – Calisthenics-Coach für iOS (Arbeitstitel „Drill“)

> Status: Entwurf v0.1 · Stand 29.10.2026 · zur Diskussion
> Ergänzend: `LASTENHEFT.md` (verbindliche Anforderungen)

---

## 1. Vision in einem Satz

**Die App entscheidet, was du heute isst und trainierst – und lässt dich nicht in Ruhe, bis du es nachweislich getan hast.**

Keine Tracking-App, kein Kalorienzählen, kein Menü-Dschungel. Die App ist ein strenger Coach mit Konsequenzen: Sie gibt vor, kontrolliert per Beweis, eskaliert bei Ausreden und macht Versäumnisse sichtbar und spürbar.

## 2. Leitprinzipien

1. **Vorgeben statt fragen.** Der Nutzer entscheidet einmal (Onboarding, Härtegrad), danach entscheidet die App.
2. **Eine Sache zur Zeit.** Der Hauptbildschirm zeigt nur die nächste fällige Aufgabe.
3. **Beweis statt Häkchen.** Erledigt ist nur, was belegt ist (Foto, Kamera-Zählung, Watch-Daten).
4. **Druck ist das Produkt.** Der Härtegrad ist einstellbar, aber nie null.
5. **Konsequenz ist sichtbar.** Ein Begleiter spiegelt die Disziplin wider – im Positiven wie im Negativen.
6. **Schlicht.** Nur anzeigen, was gerade gebraucht wird. Statistik nur, wenn sie eine Aussage hat.
7. **Sicher hart.** Streng ja, gesundheitsgefährdend nie (Mindestzufuhr, Verletzungs-/Krankheitsmodus).

## 3. Der Begleiter – Vorschläge

Das Tier war ein Beispiel. Kandidaten:

| # | Begleiter | Idee | Stärken | Schwächen |
|---|---|---|---|---|
| A | **Die Glut** (Flamme) | Eine Flamme, die du mit erledigten Aufgaben fütterst. Verpasst = sie wird kleiner, flackert, raucht. Zu lange nichts = **erloschen**. Mit Training wird sie heller, später blau-weiß. | Passt perfekt zu schlichtem Design, funktioniert winzig in Dynamic Island/Widget, starke Metapher („Feuer am Leben halten“), animierbar | Weniger „niedlich“, weniger emotionale Bindung als ein Tier |
| B | **Dein Zukunfts-Ich** | Ein stilisierter Avatar von dir am Programmende. Disziplin → er wird definierter, steht aufrecht. Versäumnisse → er verfällt, wird schwächer, schaut enttäuscht. | Stärkste persönliche Verbindung, direkt an das Ziel gekoppelt | Aufwendige Grafik, Körperbilder sind heikel (Store/Psychologie) |
| C | **Ein Tier** (z. B. Wolf, Gorilla, Axolotl) | Klassisches Tamagotchi: Hunger, Laune, Stärke. Kann sterben. | Höchste emotionale Bindung, bewährtes Prinzip | Kindlicher Eindruck, bekanntes Konzept, viel Grafikaufwand |
| D | **Der Sergeant** (Coach-Figur) | Kein Pflege-Objekt, sondern eine Stimme/Figur, die mit jeder Ausrede wütender und enttäuschter wird. | Passt zum „penetrant“-Konzept, Text/Sprache günstig umzusetzen | Kein „Verlust“, den man vermeiden will |
| E | **Der Bonsai/Baum** | Wächst über das Programm, wird gestutzt bei Versäumnissen, verdorrt. | Ruhig, langfristige Wachstumsmetapher | Zu sanft für das Konzept |

**Empfehlung: A + D kombiniert.** Die **Glut** als visueller Zustand (minimalistisch, überall einsetzbar), dazu ein **Coach-Ton**, der je nach Härtegrad von sachlich bis Drill-Sergeant reicht. Das Feuer ist das, was man verlieren kann; der Coach ist der, der einen antreibt.

### Mechanik der Glut (Vorschlag)
- **Energie 0–100**: erledigte Aufgaben +, verpasste –, Tageswechsel ohne Erfüllung –
- **Intensität / Farbe**: wächst langfristig mit Trainingsfortschritt (rot → orange → gelb → weiß → blau)
- **Erlöschen** bei Energie 0: Serie verloren, Intensitätsstufe zurückgesetzt, „Neu entzünden“ nur mit einer Bewährungsaufgabe (z. B. 3 Tage 100 % Erfüllung)
- **Asche-Archiv**: Jede erloschene Glut bleibt mit Datum und Dauer im Verlauf sichtbar (Mahnmal)

## 4. Härtegrad

Einstellbar in 4 Stufen. **Stufe 0 / „aus“ gibt es nicht.**

| | 1 · Konsequent | 2 · Streng | 3 · Hart | 4 · Drill |
|---|---|---|---|---|
| Erinnerungsintervall nach Fälligkeit | 30 min | 15 min | 10 min | 5 min |
| AlarmKit-Vollbildalarm | nein | nach 60 min | nach 30 min | nach 15 min, wiederholt |
| Apps sperren bis erledigt | nein | nur Training | Training + Essen | alles, ab Fälligkeit |
| Joker (Aufgabe aussetzen) pro Monat | 6 | 4 | 2 | 0 |
| Foto-Prüfung | KI-Prüfung, tolerant | KI, normal | KI, streng + Zufallskontrollen | KI, sehr streng + Zufallskontrollen |
| Glut-Schaden bei Verpassen | gering | mittel | hoch | sehr hoch |
| Coach-Ton | sachlich | bestimmt | scharf | Drill-Sergeant |

**Schutz gegen Selbstbetrug:**
- Härtegrad **erhöhen**: sofort.
- Härtegrad **senken**: nur eine Stufe, mit Begründung, wirksam erst nach **72 h Wartezeit**, max. 1× pro Woche.
- Benachrichtigungen/Berechtigungen deaktivieren wird erkannt → Glut-Schaden + Hinweis beim nächsten Öffnen.

## 5. Ablauf

### 5.1 Onboarding (einmalig, ca. 10–15 min)
1. **Begrüßung & Vertrag-Ankündigung** – „Diese App wird dich nerven. Das ist Absicht.“
2. **Profil**: Alter, Geschlecht, Größe, Gewicht, Gesundheitseinschränkungen, Verletzungen
3. **Ziele**: Abnehmen / Muskelaufbau / Skills (Handstand, Muscle-up, Front Lever …) / Kombination; Wunsch-Zeitraum
4. **Alltag**: Arbeitszeiten, Schlafzeiten, verfügbare Trainingstage und -zeiten, Ort (Zuhause, Park, Gym)
5. **Equipment**: Klimmzugstange, Ringe, Barren, Bänder, nichts
6. **Ernährung**: Mahlzeiten pro Tag, Abneigungen, Allergien, Ernährungsform, Kochbereitschaft, Budget, Küche/Meal-Prep
7. **Leistungstest** (mit Kamera-Zählung): max. Push-ups, Klimmzüge, Squats, Plank-Hold, Hollow-Hold, optional Dips
8. **Härtegrad wählen**
9. **KI-Bewertung**: Einschätzung des Ist-Stands, realistische Ziele, Zeitraum (z. B. 12 Wochen in 3 Phasen)
10. **Programmvorschlag**: Trainingsplan, Essensplan, Einkaufsliste, Tagesrhythmus – Nutzer kann im Dialog mit der KI anpassen
11. **Vertrag unterschreiben** (Unterschrift auf dem Bildschirm): Ziel, Zeitraum, Härtegrad, Konsequenzen
12. **Berechtigungen**: Benachrichtigungen, Alarme, Kamera, Bildschirmzeit, Health – jeweils mit Begründung
13. **Glut entzünden** → Programm startet

### 5.2 Ein typischer Tag
```
07:00  Aufstehen + Wasser            Beweis: Foto/Check
07:30  Frühstück: 3 Eier, 60 g Hafer  Beweis: Foto
12:30  Mittag: Bowl Nr. 2             Beweis: Foto
15:30  Snack: Skyr + Beeren           Beweis: Foto
18:00  Training B (45 min)            Beweis: Kamera-Zählung / Watch
19:30  Abendessen: Lachs, Kartoffeln  Beweis: Foto
22:30  Handy weg, schlafen            Beweis: Bildschirmzeit
```
Jede Aufgabe: Zeitfenster → Erinnerung → Eskalation → Beweis → Glut-Effekt.

### 5.3 Wöchentlicher Rhythmus
- **Sonntag**: Wiegen (Foto der Waage), optional Fortschrittsfoto, **Wochenbilanz** durch KI
- KI passt Essensplan (Mengen) und Trainingsplan (Progression) für die neue Woche an
- Einkaufsliste für die neue Woche

## 6. Bildschirme (bewusst wenige)

1. **Jetzt** – Glut oben, darunter groß die aktuelle Aufgabe mit Countdown und einem Button „Beweisen“. Darunter klein: der Rest des Tages als Zeitleiste.
2. **Fortschritt** – Erfüllungsquote, Gewichtstrend, Kraftstufen, Serie, Asche-Archiv.
3. **Profil** – Programm, Härtegrad, Zeiten, Einkaufsliste, Coach-Chat, Einstellungen.

Kontextbildschirme (nur bei Bedarf): Beweis-Kamera, geführtes Training, Wochenbilanz, Alarm.

## 7. Abgrenzung zur alten Web-App

| Alt (Cal Coach V5.3) | Neu |
|---|---|
| Statische PWA | Native SwiftUI-App |
| Viele Tabs, viele Schalter | 3 Tabs, eine Aufgabe im Fokus |
| Kalorien eingeben | Mahlzeiten werden vorgegeben |
| Keine Benachrichtigungen | Eskalierende Erinnerungen und Alarme |
| Eigener Gemini-Key im Browser | KI über eigenes Backend |
| Nutzer entscheidet täglich | App entscheidet, Nutzer beweist |
| Viele Diagramme ohne Aussage | 4–5 Kennzahlen mit Aussage |

Übernommen werden können: Übungs-Progressionsstufen, ggf. einzelne Illustrationen (neu im einheitlichen Stil empfohlen).

## 8. Offene Diskussionspunkte

- [ ] Begleiter final: Glut + Coach? Oder anderer?
- [ ] App-Name (Arbeitstitel „Drill“)
- [ ] Konsequenzen beim Erlöschen – reicht Serien-Verlust, oder mehr (z. B. Programm-Neustart)?
- [ ] Soll es echtes Geld als Einsatz geben (Commitment-Contract, z. B. 5 € pro verpasstem Training an Spendenzweck)? Rechtlich/Store-seitig aufwendig → eher später.
- [ ] Soziale Komponente (Buddy, der Benachrichtigungen bei deinem Versagen bekommt)?
- [ ] Sprachausgabe des Coaches (Text-to-Speech) im Training/Alarm?
- [ ] KI-Anbieter und Kostenmodell
- [ ] Monetarisierung für den späteren Store-Release (Abo?)
- [ ] Design-Richtung (Farben, Typo, Dark-only?)
