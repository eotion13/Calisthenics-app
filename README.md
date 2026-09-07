# Calisthenics Coach V4.2 Guided AI

V4.2 ergänzt den geführten Coach um eine optionale Gemini-KI mit Bring-your-own-key.

## Neu
- eigener Gemini API-Key pro Nutzer unter **Mehr → KI Coach**
- Key bleibt nur auf dem jeweiligen Gerät und wird nicht in Backups exportiert
- Verbindungstest und Key löschen
- KI-Schnellfragen: Tagescheck, letztes Training, heutige Ernährung
- freie Coach-Frage mit den relevanten lokalen App-Daten als Kontext
- Standardmodell: `gemini-2.5-flash-lite`

## Sicherheit
Die App ist statisch auf GitHub Pages. Der vom Nutzer eingegebene Key wird deshalb clientseitig verwendet. Das ist für BYOK bequem, aber weniger sicher als ein Backend. Google empfiehlt für produktive Apps einen Backend-Proxy.

## GitHub Pages
Alle Dateien direkt in den Root des Repositories hochladen.
