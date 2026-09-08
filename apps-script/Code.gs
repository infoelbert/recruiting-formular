/**
 * Elbert Marketing – Recruiting-Anfrage (branchenoffen, mehrere Stellen pro Anfrage)
 * ---------------------------------------------------------------
 * Dieses Script muss an die Google-Tabelle gebunden sein, die als
 * "Seedliste" dient (Erweiterungen > Apps Script in der Tabelle).
 *
 * Ein Kunde kann im Formular mehrere Stellen (auch unterschiedliche Berufe)
 * in einer einzigen Anfrage angeben. Darum entsteht pro Stelle eine eigene
 * Zeile in der Tabelle – alle Zeilen einer Anfrage teilen sich dieselbe
 * "Anfrage-ID" und dieselben Firmenangaben, unterscheiden sich aber in den
 * stellen-spezifischen Spalten (Jobbezeichnung, Fachkenntnisse usw.).
 * Die E-Mail-Benachrichtigung fasst dagegen alle Stellen einer Anfrage in
 * einer einzigen Mail zusammen.
 *
 * Was es tut, wenn das Formular auf der Website abgeschickt wird:
 *  1. Prüft das Honeypot-Feld (Spam-Schutz) – Bots werden stillschweigend ignoriert.
 *  2. Schreibt beim allerersten Aufruf automatisch die Kopfzeile in die Tabelle.
 *  3. Hängt pro angegebener Stelle eine neue Zeile an ("Seedliste").
 *  4. Verschickt eine E-Mail-Benachrichtigung an NOTIFY_EMAIL mit allen Stellen.
 *
 * WICHTIG NACH DEM EINFÜGEN DES CODES:
 *  Deploy > Neuer Bereitstellung > Typ "Web App"
 *    - Ausführen als: Ich (dein Google-Konto)
 *    - Zugriff: Jeder
 *  Die dabei erzeugte "Web-App-URL" musst du in anfrage.html im <form action="...">
 *  Attribut einsetzen (siehe README.md).
 */

// E-Mail-Adresse, die bei jeder neuen Anfrage benachrichtigt wird.
var NOTIFY_EMAIL = 'info.infoelbert@gmail.com';

// Muss zur Konstante MAX_POSITIONS im <script> von anfrage.html passen.
var MAX_POSITIONS = 5;

// Einmalige Angaben zum Unternehmen (kein Suffix im Formular-Feldnamen).
var COMPANY_FIELDS = [
  { key: 'firmenname',              label: 'Firmenname' },
  { key: 'branche',                 label: 'Art des Betriebs' },
  { key: 'firmensitz',              label: 'Firmensitz (PLZ, Ort)' },
  { key: 'ansprechpartner_name',    label: 'Ansprechpartner – Name' },
  { key: 'ansprechpartner_telefon', label: 'Telefon' },
  { key: 'ansprechpartner_email',   label: 'E-Mail' }
];

// Angaben pro Stelle. Im Formular tragen diese Felder den Suffix "_1", "_2", ...
// (z. B. "jobtitel_1", "jobtitel_2"), je nachdem wie viele Stellen hinzugefügt wurden.
var POSITION_FIELDS = [
  { key: 'jobtitel',         label: 'Bezeichnung der Stelle' },
  { key: 'anzahl_stellen',   label: 'Anzahl offener Stellen' },
  { key: 'einsatzort',       label: 'Haupteinsatzort der Stelle' },
  { key: 'anstellungsart',   label: 'Art der Anstellung', multi: true },
  { key: 'gehalt',           label: 'Gehaltsspanne (brutto/Jahr)' },
  { key: 'wann_besetzt',     label: 'Wann soll die Stelle besetzt sein' },
  { key: 'reiseanteil',      label: 'Reisebereitschaft nötig' },
  { key: 'qualifikation',    label: 'Nötige Ausbildung / Erfahrung' },
  { key: 'fuehrerschein',    label: 'Nötiger Führerschein' },
  { key: 'fachkenntnisse',   label: 'Wichtige Fachkenntnisse' },
  { key: 'eigenschaften',    label: 'Gewünschte Eigenschaften' },
  { key: 'sprachkenntnisse', label: 'Gewünschte Sprachkenntnisse' }
];

// Wieder einmalige Angaben, gelten für das ganze Unternehmen / alle Stellen zusammen.
var FOLLOWUP_FIELDS = [
  { key: 'warum_wir',            label: 'Warum Bewerber sich für die Firma entscheiden sollten' },
  { key: 'mitarbeiter_vorteile', label: 'Was die Firma Mitarbeitern bietet' },
  { key: 'team_beschreibung',    label: 'Team- / Firmenbeschreibung' },
  { key: 'bewerbungsweg',        label: 'Gewünschter Bewerbungsweg' },
  { key: 'anmerkungen',          label: 'Weitere Anmerkungen' },
  { key: 'consent',              label: 'Einwilligung Datenschutz' }
];

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var mp = (e && e.parameters) ? e.parameters : {};

    // 1) Spam-Schutz: Honeypot-Feld "website" ist für Menschen unsichtbar.
    if (p.website) {
      return ContentService.createTextOutput('OK');
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // 2) Kopfzeile beim ersten Mal automatisch anlegen.
    if (sheet.getLastRow() === 0) {
      var headers = ['Zeitstempel', 'Anfrage-ID', 'Stelle Nr.']
        .concat(COMPANY_FIELDS.map(function (f) { return f.label; }))
        .concat(POSITION_FIELDS.map(function (f) { return f.label; }))
        .concat(FOLLOWUP_FIELDS.map(function (f) { return f.label; }));
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }

    var timestamp = new Date();
    var requestId = Utilities.getUuid().slice(0, 8);

    var companyValues = COMPANY_FIELDS.map(function (f) { return p[f.key] || ''; });
    var followupValues = FOLLOWUP_FIELDS.map(function (f) { return p[f.key] || ''; });

    // 3) Alle ausgefüllten Stellen einsammeln (Suffix _1, _2, ... im Feldnamen).
    var positions = [];
    for (var i = 1; i <= MAX_POSITIONS; i++) {
      var jobtitel = p['jobtitel_' + i];
      if (jobtitel) {
        var posValues = POSITION_FIELDS.map(function (f) {
          if (f.multi) {
            var arr = mp[f.key + '_' + i];
            return arr ? arr.join(', ') : '';
          }
          return p[f.key + '_' + i] || '';
        });
        positions.push({ jobtitel: jobtitel, values: posValues });
      }
    }
    // Falls aus irgendeinem Grund keine Stelle erkannt wurde, trotzdem eine Zeile schreiben.
    if (positions.length === 0) {
      positions.push({ jobtitel: '', values: POSITION_FIELDS.map(function () { return ''; }) });
    }

    // Eine Zeile pro Stelle, alle mit derselben Anfrage-ID verknüpft.
    positions.forEach(function (pos, idx) {
      var row = [timestamp, requestId, (idx + 1) + ' von ' + positions.length]
        .concat(companyValues)
        .concat(pos.values)
        .concat(followupValues);
      sheet.appendRow(row);
    });

    // 4) Eine gebündelte E-Mail-Benachrichtigung für die ganze Anfrage.
    var firmenname = p.firmenname || 'Unbekannte Firma';
    var stellenWort = positions.length === 1 ? 'Stelle' : 'Stellen';
    var subject = 'Neue Recruiting-Anfrage: ' + firmenname + ' – ' + positions.length + ' ' + stellenWort;

    var body = 'Neue Anfrage über das Recruiting-Formular:\n\n';
    body += '--- Unternehmen ---\n';
    COMPANY_FIELDS.forEach(function (f, i) {
      if (companyValues[i]) body += f.label + ': ' + companyValues[i] + '\n';
    });

    positions.forEach(function (pos, idx) {
      body += '\n--- Stelle ' + (idx + 1) + (pos.jobtitel ? ': ' + pos.jobtitel : '') + ' ---\n';
      POSITION_FIELDS.forEach(function (f, i) {
        if (pos.values[i]) body += f.label + ': ' + pos.values[i] + '\n';
      });
    });

    body += '\n--- Weitere Angaben ---\n';
    FOLLOWUP_FIELDS.forEach(function (f, i) {
      if (followupValues[i]) body += f.label + ': ' + followupValues[i] + '\n';
    });

    body += '\nAnfrage-ID: ' + requestId;
    body += '\nEingegangen am: ' + timestamp.toLocaleString('de-DE');

    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);

    return ContentService.createTextOutput('OK');
  } catch (err) {
    // Fehler ebenfalls per Mail melden, damit nichts unbemerkt verloren geht.
    try {
      MailApp.sendEmail(NOTIFY_EMAIL, 'Fehler im Recruiting-Formular', String(err));
    } catch (e2) { /* ignore */ }
    return ContentService.createTextOutput('ERROR');
  }
}

/** Hilfsfunktion zum manuellen Testen im Apps-Script-Editor (Menü "Ausführen"). */
function testDoPost() {
  var fakeEvent = {
    parameter: {
      firmenname: 'Testfirma GmbH',
      branche: 'Handwerk',
      firmensitz: '12345 Musterstadt',
      ansprechpartner_name: 'Max Mustermann',
      ansprechpartner_telefon: '0123 456789',
      ansprechpartner_email: 'max@testfirma.de',

      jobtitel_1: 'Hydrauliker (m/w/d)',
      einsatzort_1: 'Musterstadt und Umgebung',
      fachkenntnisse_1: 'Hydraulikpläne lesen, Ventiltechnik',

      jobtitel_2: 'Servicetechniker (m/w/d)',
      einsatzort_2: 'Bundesweit, Außendienst',
      fachkenntnisse_2: 'Maschinenwartung, Fehlerdiagnose',

      warum_wir: 'Familienunternehmen mit flachen Hierarchien',
      consent: 'Ja'
    },
    parameters: {
      anstellungsart_1: ['Vollzeit', 'Unbefristet'],
      anstellungsart_2: ['Vollzeit']
    }
  };
  doPost(fakeEvent);
}
