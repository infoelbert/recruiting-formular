/**
 * Elbert Marketing – Recruiting-Anfrage (branchenoffen, mehrere Stellen pro Anfrage)
 * ---------------------------------------------------------------
 * Dieses Script schreibt jede Formular-Einreichung als neue Zeile in die
 * Google-Tabelle ("Seedliste") und verschickt eine E-Mail an NOTIFY_EMAIL.
 *
 * Die Tabelle wird fest über ihre ID angesprochen (SPREADSHEET_ID unten).
 * Dadurch funktioniert das Script sowohl, wenn es an die Tabelle gebunden ist
 * (Erweiterungen > Apps Script), als auch als eigenständiges Projekt auf
 * script.google.com. Falls die ID einmal nicht passt, wird als Rückfall die
 * aktuell gebundene Tabelle verwendet.
 *
 * Ein Kunde kann im Formular mehrere Stellen (auch unterschiedliche Berufe)
 * in einer einzigen Anfrage angeben. Darum entsteht pro Stelle eine eigene
 * Zeile in der Tabelle – alle Zeilen einer Anfrage teilen sich dieselbe
 * "Anfrage-ID" und dieselben Firmenangaben, unterscheiden sich aber in den
 * stellen-spezifischen Spalten (Jobbezeichnung, Fachkenntnisse usw.).
 * Die E-Mail-Benachrichtigung fasst dagegen alle Stellen einer Anfrage in
 * einer einzigen Mail zusammen.
 *
 * WICHTIG NACH DEM EINFÜGEN / ÄNDERN DES CODES:
 *  Bereitstellen > Bereitstellungen verwalten > Bearbeiten (Stift) >
 *  Version: "Neue Version" > Bereitstellen.
 *    - Ausführen als: Ich (dein Google-Konto)
 *    - Zugriff: Jeder
 *  Beim ersten Mal fragt Google nach Berechtigungen (Tabelle + E-Mail) –
 *  das muss bestätigt werden. Die Web-App-URL (endet auf /exec) bleibt
 *  bei einer "Neue Version"-Bereitstellung gleich.
 */

// ID der Google-Tabelle, die als "Seedliste" dient.
// Steht in der URL der Tabelle zwischen /d/ und /edit:
// https://docs.google.com/spreadsheets/d/<DIESE_ID>/edit
var SPREADSHEET_ID = '1PiGF7BAmBRuYydJd3xUTFPtAH6CA-087IjTJ-UNPdHY';

// E-Mail-Adresse, die bei jeder neuen Anfrage benachrichtigt wird.
var NOTIFY_EMAIL = 'info.infoelbert@gmail.com';

// Muss zur Konstante MAX_POSITIONS im <script> von anfrage.html passen.
var MAX_POSITIONS = 5;

// Einmalige Angaben zum Unternehmen (kein Suffix im Formular-Feldnamen).
var COMPANY_FIELDS = [
  { key: 'firmenname',              label: 'Firmenname' },
  { key: 'branche',                 label: 'Art des Betriebs' },
  { key: 'firmensitz',              label: 'Firmensitz (PLZ, Ort)' },
  { key: 'firmengroesse',           label: 'Anzahl Mitarbeiter' },
  { key: 'firma_web',               label: 'Website / Social-Media-Links' },
  { key: 'ansprechpartner_name',    label: 'Ansprechpartner – Name' },
  { key: 'ansprechpartner_telefon', label: 'Telefon' },
  { key: 'ansprechpartner_email',   label: 'E-Mail' }
];

// Angaben pro Stelle. Im Formular tragen diese Felder den Suffix "_1", "_2", ...
// (z. B. "jobtitel_1", "jobtitel_2"), je nachdem wie viele Stellen hinzugefügt wurden.
var POSITION_FIELDS = [
  { key: 'jobtitel',              label: 'Bezeichnung der Stelle' },
  { key: 'anzahl_stellen',        label: 'Anzahl offener Stellen' },
  { key: 'einsatzort',            label: 'Haupteinsatzort der Stelle' },
  { key: 'aufgaben',              label: 'Wichtigste Aufgaben im Alltag' },
  { key: 'anstellungsart',        label: 'Art der Anstellung', multi: true },
  { key: 'arbeitszeiten',         label: 'Arbeitszeiten / Schichtmodell', multi: true },
  { key: 'arbeitszeiten_details', label: 'Details zu den Arbeitszeiten' },
  { key: 'gehalt',                label: 'Gehaltsspanne (brutto/Jahr)' },
  { key: 'wann_besetzt',          label: 'Wann soll die Stelle besetzt sein' },
  { key: 'reiseanteil',           label: 'Reisebereitschaft nötig' },
  { key: 'qualifikation',         label: 'Nötige Ausbildung / Erfahrung' },
  { key: 'fuehrerschein',         label: 'Nötiger Führerschein' },
  { key: 'fachkenntnisse',        label: 'Wichtige Fachkenntnisse' },
  { key: 'eigenschaften',         label: 'Gewünschte Eigenschaften' },
  { key: 'sprachkenntnisse',      label: 'Gewünschte Sprachkenntnisse' }
];

// Wieder einmalige Angaben, gelten für das ganze Unternehmen / alle Stellen zusammen.
var FOLLOWUP_FIELDS = [
  { key: 'warum_wir',            label: 'Warum Bewerber sich für die Firma entscheiden sollten' },
  { key: 'urlaubstage',          label: 'Urlaubstage pro Jahr' },
  { key: 'benefits',             label: 'Zusatzleistungen / Benefits', multi: true },
  { key: 'benefits_sonstiges',   label: 'Weitere Zusatzleistungen (Freitext)' },
  { key: 'mitarbeiter_vorteile', label: 'Was die Firma Mitarbeitern bietet (Freitext)' },
  { key: 'team_beschreibung',    label: 'Team- / Firmenbeschreibung' },
  { key: 'bewerbungsweg',        label: 'Gewünschter Bewerbungsweg' },
  { key: 'anmerkungen',          label: 'Weitere Anmerkungen' },
  { key: 'consent',              label: 'Einwilligung Datenschutz' }
];

/**
 * Liefert das Blatt, in das geschrieben wird: erste Registerkarte der
 * Tabelle mit SPREADSHEET_ID. Rückfall auf die gebundene Tabelle, falls
 * die ID nicht gesetzt ist oder nicht geöffnet werden kann.
 */
function getTargetSheet_() {
  var ss = null;
  if (SPREADSHEET_ID && SPREADSHEET_ID.indexOf('DEINE_TABELLEN_ID') === -1) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!ss) {
    throw new Error(
      'Keine Tabelle gefunden. Bitte SPREADSHEET_ID im Script pruefen oder das ' +
      'Script an die Tabelle binden (Erweiterungen > Apps Script).'
    );
  }
  return ss.getSheets()[0];
}

function doGet() {
  return ContentService.createTextOutput(
    'Recruiting-Formular-Backend laeuft. Diese URL wird vom Formular per POST aufgerufen.'
  );
}

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var mp = (e && e.parameters) ? e.parameters : {};

    // 1) Spam-Schutz: Honeypot-Feld "website" ist für Menschen unsichtbar.
    if (p.website) {
      return ContentService.createTextOutput('OK');
    }

    var sheet = getTargetSheet_();

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
    var followupValues = FOLLOWUP_FIELDS.map(function (f) {
      if (f.multi) {
        var arr = mp[f.key];
        return arr ? arr.join(', ') : '';
      }
      return p[f.key] || '';
    });

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
    //    Ein Fehler beim Mailversand darf die bereits gespeicherte Anfrage
    //    NICHT als Fehlschlag erscheinen lassen – daher eigener try/catch.
    try {
      sendNotificationEmail_(p, companyValues, followupValues, positions, requestId, timestamp);
    } catch (mailErr) {
      Logger.log('Mailversand fehlgeschlagen: ' + mailErr);
    }

    return ContentService.createTextOutput('OK');
  } catch (err) {
    // Echter Fehler (z. B. Tabelle nicht erreichbar): per Mail melden,
    // damit nichts unbemerkt verloren geht.
    try {
      MailApp.sendEmail(
        NOTIFY_EMAIL,
        'Fehler im Recruiting-Formular',
        'Beim Verarbeiten einer Anfrage ist ein Fehler aufgetreten:\n\n' +
        String(err) + '\n\n' + (err && err.stack ? err.stack : '')
      );
    } catch (e2) { /* ignore */ }
    return ContentService.createTextOutput('ERROR');
  }
}

function sendNotificationEmail_(p, companyValues, followupValues, positions, requestId, timestamp) {
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
}

/** Hilfsfunktion zum manuellen Testen im Apps-Script-Editor (Menü "Ausführen"). */
function testDoPost() {
  var fakeEvent = {
    parameter: {
      firmenname: 'Testfirma GmbH',
      branche: 'Handwerk',
      firmensitz: '12345 Musterstadt',
      firmengroesse: '25',
      firma_web: 'www.testfirma.de, instagram.com/testfirma',
      ansprechpartner_name: 'Max Mustermann',
      ansprechpartner_telefon: '0123 456789',
      ansprechpartner_email: 'max@testfirma.de',

      jobtitel_1: 'Hydrauliker (m/w/d)',
      einsatzort_1: 'Musterstadt und Umgebung',
      aufgaben_1: 'Hydraulikanlagen warten, Störungen beheben, Kunden vor Ort betreuen',
      arbeitszeiten_details_1: 'Mo–Fr 7–16 Uhr',
      fachkenntnisse_1: 'Hydraulikpläne lesen, Ventiltechnik',

      jobtitel_2: 'Servicetechniker (m/w/d)',
      einsatzort_2: 'Bundesweit, Außendienst',
      aufgaben_2: 'Maschinen beim Kunden montieren und in Betrieb nehmen',
      fachkenntnisse_2: 'Maschinenwartung, Fehlerdiagnose',

      warum_wir: 'Familienunternehmen mit flachen Hierarchien',
      urlaubstage: '30 Tage',
      benefits_sonstiges: 'Firmenwagen auch zur privaten Nutzung',
      consent: 'Ja'
    },
    parameters: {
      anstellungsart_1: ['Vollzeit', 'Unbefristet'],
      arbeitszeiten_1: ['Feste Zeiten'],
      anstellungsart_2: ['Vollzeit'],
      arbeitszeiten_2: ['Feste Zeiten', 'Rufbereitschaft'],
      benefits: ['Betriebliche Altersvorsorge', 'Weihnachtsgeld', 'Firmenwagen / Dienstfahrzeug']
    }
  };
  doPost(fakeEvent);
}
