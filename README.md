# Recruiting-Formular – Setup-Anleitung

Dieses Paket enthält eine schlanke 3-Seiten-Website (Startseite, Formular, Dankeseite),
die du auf Vercel hostest. Jede Formular-Einreichung landet automatisch als neue Zeile
in deiner Google-Tabelle (der „Seedliste") **und** löst eine E-Mail an
`info.infoelbert@gmail.com` aus. Es wird kein Server, keine Datenbank und kein
bezahlter Dienst benötigt – nur dein Google-Konto und Vercel.

## Enthaltene Dateien

```
index.html          → Startseite mit Erklärung + Button zum Formular
anfrage.html         → Das eigentliche Recruiting-Formular
danke.html           → Dankeseite nach erfolgreichem Absenden
vercel.json          → Sorgt für saubere URLs (/anfrage statt /anfrage.html)
apps-script/Code.gs  → Google Apps Script Code für Tabelle + E-Mail-Versand
```

---

## Schritt 1 – Google Apps Script mit deiner Tabelle verbinden

Du hast bereits eine Google-Tabelle als Seedliste angelegt:
`https://docs.google.com/spreadsheets/d/1PiGF7BAmBRuYydJd3xUTFPtAH6CA-087IjTJ-UNPdHY/edit`

1. Tabelle öffnen → Menü **Erweiterungen → Apps Script**.
2. Den kompletten Beispielcode im Editor löschen und stattdessen den Inhalt von
   `apps-script/Code.gs` (aus diesem Paket) einfügen.
3. Oben speichern (Diskettensymbol / Strg+S). Projektname z. B. „Recruiting Formular Backend".

   > **Hinweis zur Tabellen-ID:** Ganz oben in `Code.gs` steht
   > `var SPREADSHEET_ID = '1PiGF7BAmBRuYydJd3xUTFPtAH6CA-087IjTJ-UNPdHY';`.
   > Das Script spricht die Tabelle fest über diese ID an und funktioniert
   > deshalb auch, wenn es **nicht** an die Tabelle gebunden ist. Falls du
   > die Seedliste je durch eine andere Tabelle ersetzt, trage hier die neue
   > ID ein (steht in der Tabellen-URL zwischen `/d/` und `/edit`).
4. Rechts oben auf **Bereitstellen → Neue Bereitstellung** klicken.
   - Typ auswählen: **Web-App**.
   - „Ausführen als": **Ich (dein Google-Konto)**.
   - „Wer hat Zugriff": **Jeder**.
   - Auf **Bereitstellen** klicken. Google fragt beim ersten Mal nach Berechtigungen
     (Zugriff auf die Tabelle + E-Mail-Versand) – das musst du bestätigen, das ist normal.
5. Du bekommst eine **Web-App-URL** (endet auf `/exec`). Diese kopieren – sie wird in
   Schritt 2 gebraucht.

**Wichtig:** Die Kopfzeile (Firmenname, Branche, Telefon, Datum usw.) musst du **nicht**
manuell eintragen – das Script schreibt sie beim allerersten eingehenden Formular
automatisch in Zeile 1 der Tabelle.

Zum Testen kannst du im Apps-Script-Editor oben die Funktion `testDoPost` auswählen und
auf „Ausführen" klicken – danach sollte eine Testzeile in der Tabelle stehen und eine
Test-Mail bei dir ankommen.

## Schritt 2 – Formular mit der Web-App-URL verbinden

1. Öffne `anfrage.html` in einem Texteditor.
2. Suche die Zeile:
   ```html
   <form id="recruitingForm" action="PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE" method="POST" target="hidden_iframe">
   ```
3. Ersetze `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` durch die in Schritt 1 kopierte
   `.../exec`-URL.
4. Speichern.

## Schritt 3 – Auf Vercel veröffentlichen

**Option A – über GitHub (empfohlen, für spätere Änderungen am einfachsten):**

1. Erstelle ein neues, leeres Repository auf GitHub (z. B. `recruiting-formular`).
2. Lade den Inhalt dieses Ordners dorthin hoch (per GitHub-Weboberfläche „Upload files"
   reicht völlig aus, kein Git-Wissen nötig).
3. Auf [vercel.com](https://vercel.com) einloggen → **Add New → Project** → das GitHub-Repo
   auswählen → **Deploy** (Framework-Einstellungen bitte nicht ändern, „Other"/keine
   Framework-Erkennung ist hier korrekt, da es reines HTML ist).
4. Vercel zeigt dir danach eine Live-URL wie `recruiting-formular.vercel.app`.

**Option B – über die Vercel CLI (falls du lieber im Terminal arbeitest):**

```bash
npm i -g vercel
cd recruiting-formular
vercel login
vercel --prod
```

## Schritt 4 – Eigene Domain verbinden

In den Vercel-Projekteinstellungen unter **Domains** kannst du z. B.
`anfrage.elbert-marketing.de` oder direkt `elbert-marketing.de` hinzufügen und die
angezeigten DNS-Einträge bei deinem Domain-Anbieter setzen. Wenn du die alte
`/welcome`-Seite bei LeadConnector/GoHighLevel ablösen willst, kannst du zusätzlich
dort eine Weiterleitung auf die neue Vercel-URL einrichten, bis die DNS-Umstellung
vollständig ist.

## Testen

1. Neue Vercel-URL öffnen → auf „Jetzt Anfrage starten" klicken.
2. Formular ausfüllen und absenden.
3. Prüfen: Landet eine neue Zeile in der Google-Tabelle? Kommt eine E-Mail an
   `info.infoelbert@gmail.com` an? Erscheint die Dankeseite?

### Fehlermail „Fehler im Recruiting-Formular"

Wenn du beim Absenden zwar auf der Dankeseite landest, aber statt der normalen
Benachrichtigung eine Mail mit Betreff **„Fehler im Recruiting-Formular"**
bekommst, konnte das Script die Tabelle nicht beschreiben. Häufigste Ursachen:

- **Das Script wurde nach der letzten Code-Änderung nicht neu bereitgestellt.**
  Lösung: **Bereitstellen → Bereitstellungen verwalten → Bearbeiten (Stift) →
  Version „Neue Version" → Bereitstellen**. Die `/exec`-URL bleibt gleich.
- **Berechtigungen wurden nie vollständig bestätigt** (Zugriff auf Tabelle +
  E-Mail). Lösung: im Editor einmal die Funktion `testDoPost` ausführen und den
  Google-Berechtigungsdialog komplett durchklicken.
- **Falsche `SPREADSHEET_ID`** in `Code.gs`. Lösung: ID aus der Tabellen-URL
  (zwischen `/d/` und `/edit`) kopieren und oben im Script eintragen.

Seit der aktuellen Version von `Code.gs` steht der genaue Fehlertext mit im Text
dieser Mail – der sagt dir, welche der drei Ursachen es ist.

## Mehrere Stellen pro Anfrage

Ein Kunde kann im Formular beliebig viele Stellen angeben (Button „+ Weitere Stelle
hinzufügen", maximal 5) — auch unterschiedliche Berufe, z. B. gleichzeitig einen
Hydrauliker und einen Servicetechniker. Für jede angegebene Stelle entsteht eine
eigene Zeile in der Google-Tabelle; alle Zeilen einer Anfrage teilen sich dieselbe
„Anfrage-ID" und dieselben Firmenangaben, unterscheiden sich aber in den
stellen-spezifischen Spalten. Die E-Mail an dich fasst dagegen alle Stellen einer
Anfrage in einer einzigen Nachricht zusammen.

## Später Felder ändern

Die Felder sind in drei Gruppen aufgeteilt, jeweils als Array oben in
`apps-script/Code.gs`:

- `COMPANY_FIELDS` — einmalige Angaben zum Unternehmen (Feldname ohne Zahl-Suffix,
  z. B. `firmenname`).
- `POSITION_FIELDS` — Angaben pro Stelle (Feldname mit Zahl-Suffix im Formular, z. B.
  `jobtitel_1`, `jobtitel_2`, ...).
- `FOLLOWUP_FIELDS` — wieder einmalige Angaben, die für alle Stellen gemeinsam gelten
  (z. B. „Warum bei Ihnen arbeiten").

Wenn du ein Formularfeld hinzufügst, entfernst oder umbenennst, musst du **zwei
Stellen** synchron halten:

1. Das `name="..."`-Attribut des Feldes in `anfrage.html`. Stellen-Felder stehen
   **einmal** in der Vorlage `<template id="positionTpl">` (weiter unten in der
   Datei); der Platzhalter `{{N}}` im Feldnamen wird beim Einfügen einer Stelle
   automatisch durch die Stellen-Nummer ersetzt. Es gibt keinen separaten „Stelle 1"-
   Block mehr — Stelle 1 wird beim Laden aus derselben Vorlage erzeugt.
2. Den passenden Eintrag in `COMPANY_FIELDS`, `POSITION_FIELDS` oder
   `FOLLOWUP_FIELDS` in `apps-script/Code.gs` (gleicher `key`). Checkbox-Gruppen
   brauchen `multi: true`. Mit `section: '...'` setzt du eine Zwischenüberschrift
   in der Benachrichtigungs-E-Mail.

Bedingte Felder (z. B. „Bitte Zielgruppe kurz beschreiben", das nur bei Auswahl
„Sonstige" erscheint) werden über einen `<div class="cond" data-cond-field="..."
data-cond-kind="..." data-cond-value="...">`-Wrapper gesteuert. Pflichtfelder darin
tragen `data-req-when-shown` und werden nur validiert, solange sie sichtbar sind.

Die maximale Stellenzahl steht als `MAX_POSITIONS` im `<script>`-Teil von
`anfrage.html`. In `apps-script/Code.gs` liest `SCAN_LIMIT` (bewusst großzügig)
die Stellen-Suffixe `_1 … _N` ein — die Nummerierung kann nach Hinzufügen/Entfernen
Lücken haben.

Die Kopfzeile der Tabelle wird bei jeder Einreichung automatisch mit dem aktuellen
Spaltenstand abgeglichen (`ensureHeaders_`), du musst sie nach Feld-Änderungen also
nicht von Hand anpassen.

Nach jeder Änderung am Apps Script im Editor erneut **Bereitstellen →
Bereitstellungen verwalten → Bearbeiten (Stift-Symbol) → Neue Version →
Bereitstellen** wählen, damit die Änderung live geht (die Web-App-URL bleibt dabei
gleich).

## Farben & Logo

Die Farben (Hintergrund fast Schwarz, Gold-Akzent `#C8A454` usw.) wurden per
Pixel-Analyse direkt aus einem Screenshot von elbert-marketing.de ausgelesen und sind
in jeder HTML-Datei ganz oben im `<style>`-Block als CSS-Variablen hinterlegt
(`--bg`, `--accent`, `--ink`, `--muted` …) — zum Anpassen einfach den Hex-Wert an der
jeweiligen Stelle in `index.html`, `anfrage.html` und `danke.html` ändern (dieselbe
Änderung in allen drei Dateien vornehmen).

`logo.png` ist dein aus dem Screenshot freigestelltes Logo-Icon (transparenter
Hintergrund) und wird im Header aller drei Seiten verwendet. Da es aus einem
Screenshot stammt, ist die Auflösung begrenzt (58×79 px) — für ein gestochen scharfes
Ergebnis am besten die Original-Logodatei (SVG oder hochauflösendes PNG) aus deinem
Website-Baukasten exportieren und `logo.png` in diesem Ordner damit ersetzen
(gleicher Dateiname, dann einfach neu hochladen/deployen).

## Spam-Schutz

Das Formular enthält ein unsichtbares „Honeypot"-Feld (`website`). Menschen sehen und
füllen es nie aus; Bots, die Formulare automatisch ausfüllen, tappen oft hinein. Solche
Einsendungen werden von Google Apps Script still verworfen und tauchen weder in der
Tabelle noch als E-Mail auf.
