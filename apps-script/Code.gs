/**
 * Elbert Marketing – Recruiting-Anfrage (branchenoffen, mehrere Stellen pro Anfrage)
 * ---------------------------------------------------------------
 * Dieses Script schreibt jede Formular-Einreichung als neue Zeile in die
 * Google-Tabelle ("Seedliste") und verschickt eine E-Mail an NOTIFY_EMAIL.
 *
 * Die Tabelle wird fest über ihre ID angesprochen (SPREADSHEET_ID unten).
 * Dadurch funktioniert das Script sowohl gebunden (Erweiterungen > Apps Script)
 * als auch als eigenständiges Projekt auf script.google.com.
 *
 * Ein Kunde kann im Formular mehrere Stellen (auch unterschiedliche Berufe)
 * in einer einzigen Anfrage angeben. Pro Stelle entsteht eine eigene Zeile –
 * alle Zeilen einer Anfrage teilen sich dieselbe "Anfrage-ID" und dieselben
 * Firmenangaben. Die E-Mail fasst alle Stellen einer Anfrage in einer Mail
 * zusammen, gegliedert nach Unternehmen, Stelle(n), Benefits,
 * Bewerbungsprozess, Freigabe und Material.
 *
 * WICHTIG NACH DEM EINFÜGEN / ÄNDERN DES CODES:
 *  1. Speichern (Cmd+S).
 *  2. Funktion testDoPost einmal ausführen, Berechtigungen bestätigen.
 *  3. Bereitstellen > Bereitstellungen verwalten > Bearbeiten (Stift) >
 *     Version "Neue Version" > Bereitstellen. Die /exec-URL bleibt gleich.
 */

// ID der Google-Tabelle ("Seedliste"). Steht in der Tabellen-URL zwischen /d/ und /edit.
var SPREADSHEET_ID = '1PiGF7BAmBRuYydJd3xUTFPtAH6CA-087IjTJ-UNPdHY';

// E-Mail-Adresse, die bei jeder neuen Anfrage benachrichtigt wird.
var NOTIFY_EMAIL = 'info.infoelbert@gmail.com';

// Wie viele Stellen-Suffixe (_1 .. _N) beim Einlesen geprüft werden. Grosszügig,
// weil die Nummerierung im Formular nach Hinzufügen/Entfernen Lücken haben kann.
var SCAN_LIMIT = 60;

// Einmalige Angaben zum Unternehmen (kein Suffix im Formular-Feldnamen).
var COMPANY_FIELDS = [
  { key: 'firmenname',              label: 'Firmenname' },
  { key: 'branche',                 label: 'Art des Betriebs' },
  { key: 'firmensitz',              label: 'Firmensitz (PLZ, Ort)' },
  { key: 'firmengroesse',           label: 'Unternehmensgröße' },
  { key: 'firma_web',               label: 'Website / Social-Media-Links' },
  { key: 'ansprechpartner_name',    label: 'Ansprechpartner – Name' },
  { key: 'ansprechpartner_telefon', label: 'Telefon' },
  { key: 'ansprechpartner_email',   label: 'E-Mail' }
];

// Angaben pro Stelle. Im Formular tragen diese Felder den Suffix "_1", "_2", ...
// "multi: true"  = Checkbox-Gruppe (mehrere Werte).
// "section: ..." = Zwischenüberschrift in der E-Mail.
var POSITION_FIELDS = [
  { key: 'jobtitel',                    label: 'Bezeichnung der Stelle', section: 'Eckdaten' },
  { key: 'anzahl_stellen',              label: 'Anzahl offener Stellen' },
  { key: 'einsatzort',                  label: 'Haupteinsatzort' },

  { key: 'zielgruppe',                  label: 'Passende Bewerbergruppen', multi: true, section: 'Zielgruppe' },
  { key: 'zielgruppe_sonstige',         label: 'Zielgruppe – Sonstige' },

  { key: 'aufgaben',                    label: 'Wichtigste Aufgaben im Alltag', section: 'Aufgaben & Anforderungen' },
  { key: 'muss_kriterien',              label: 'Zwingende Anforderungen (Muss)' },
  { key: 'kann_kriterien',              label: 'Wünschenswerte Kenntnisse (Kann)' },
  { key: 'qualifikation',               label: 'Gewünschte Ausbildung / formale Qualifikation' },
  { key: 'ausschluss_kriterien',        label: 'Ausschlusskriterien' },
  { key: 'fachkenntnisse_noetig',       label: 'Besondere Fachkenntnisse nötig?' },
  { key: 'fachkenntnisse',              label: 'Wichtige Fachkenntnisse' },
  { key: 'eigenschaften',               label: 'Gewünschte Eigenschaften' },
  { key: 'sprachkenntnisse',            label: 'Gewünschte Sprachkenntnisse' },

  { key: 'arbeitsumfang',               label: 'Arbeitsumfang', section: 'Anstellung & Arbeitszeit' },
  { key: 'vertragsart',                 label: 'Vertragsart' },
  { key: 'wochenstunden',               label: 'Wochenstunden' },
  { key: 'arbeitszeiten',               label: 'Arbeitszeiten / Schichtmodell', multi: true },
  { key: 'schichtmodell',               label: 'Schichtmodell (Details)' },
  { key: 'rufbereitschaft_haeufigkeit', label: 'Rufbereitschaft – Häufigkeit' },
  { key: 'arbeitszeiten_details',       label: 'Arbeitszeiten – weitere Details' },

  { key: 'gehalt_umgang',               label: 'Umgang mit der Vergütung', section: 'Vergütung' },
  { key: 'gehalt',                      label: 'Gehaltsspanne (brutto)' },

  { key: 'besetzung_zeitpunkt',         label: 'Gewünschter Besetzungszeitpunkt', section: 'Besetzung' },
  { key: 'besetzung_datum',             label: 'Konkretes Datum' },
  { key: 'wann_besetzt',                label: 'Ergänzung zum Zeitpunkt' },

  { key: 'reiseanteil',                 label: 'Reise-/Außendienst', section: 'Reisetätigkeit' },
  { key: 'aussendienst_fuehrerschein',  label: 'Führerschein erforderlich?' },
  { key: 'firmenfahrzeug',              label: 'Firmenfahrzeug vorhanden?' },
  { key: 'fuehrerschein',               label: 'Benötigte Führerscheinklasse' }
];

// Wieder einmalige Angaben, gelten für das ganze Unternehmen / alle Stellen zusammen.
var FOLLOWUP_FIELDS = [
  { key: 'warum_wir',                label: '3 Gründe für Bewerber', section: 'Arbeitgeber & Benefits' },
  { key: 'urlaubstage',              label: 'Urlaubstage pro Jahr' },
  { key: 'benefits',                 label: 'Zusatzleistungen / Benefits', multi: true },
  { key: 'benefits_sonstiges',       label: 'Weitere Zusatzleistungen' },
  { key: 'mitarbeiter_vorteile',     label: 'Ergänzungen zu Benefits' },
  { key: 'team_beschreibung',        label: 'Team- / Firmenbeschreibung' },

  { key: 'bewerbungsweg',            label: 'Bewerbungswege', multi: true, section: 'Bewerbungsprozess' },
  { key: 'bewerbungsweg_sonstige',   label: 'Bewerbungsweg – Sonstiges' },
  { key: 'bewerbung_kontakt_name',   label: 'Zuständig für Bewerbungen' },
  { key: 'bewerbung_kontakt_telefon',label: 'Telefon für Bewerber' },
  { key: 'bewerbung_kontakt_email',  label: 'E-Mail für Bewerber' },
  { key: 'bewerbung_kontakt_zeiten', label: 'Beste Erreichbarkeit' },
  { key: 'reaktionszeit',            label: 'Reaktionszeit auf Bewerbungen' },
  { key: 'auswahlprozess',           label: 'Ablauf der Auswahl', multi: true },
  { key: 'auswahlprozess_sonstige',  label: 'Auswahl – Sonstiges' },

  { key: 'freigabe_name',            label: 'Freigabe – Name', section: 'Freigabe der Kampagne' },
  { key: 'freigabe_rolle',           label: 'Freigabe – Funktion / Rolle' },
  { key: 'freigabe_email',           label: 'Freigabe – E-Mail' },
  { key: 'freigabe_telefon',         label: 'Freigabe – Telefon' },
  { key: 'freigabe_berechtigt',      label: 'Freigabe-Berechtigung bestätigt' },

  { key: 'material_vorhanden',       label: 'Foto-/Videomaterial vorhanden?', section: 'Bilder & Videos' },
  { key: 'material_rechte',          label: 'Bildrechte bestätigt' },

  { key: 'anmerkungen',              label: 'Weitere Anmerkungen', section: 'Sonstiges' },
  { key: 'consent',                  label: 'Einwilligung Datenschutz' }
];

/**
 * Liefert das Blatt, in das geschrieben wird: erste Registerkarte der Tabelle
 * mit SPREADSHEET_ID. Rückfall auf die gebundene Tabelle, falls nötig.
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

function allHeaders_() {
  return ['Zeitstempel', 'Anfrage-ID', 'Stelle Nr.']
    .concat(COMPANY_FIELDS.map(function (f) { return f.label; }))
    .concat(POSITION_FIELDS.map(function (f) { return f.label; }))
    .concat(FOLLOWUP_FIELDS.map(function (f) { return f.label; }));
}

/** Legt die Kopfzeile an bzw. bringt sie auf den aktuellen Spaltenstand. */
function ensureHeaders_(sheet) {
  var headers = allHeaders_();
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  var same = existing.length >= headers.length;
  if (same) {
    for (var i = 0; i < headers.length; i++) {
      if (String(existing[i] || '') !== headers[i]) { same = false; break; }
    }
  }
  if (!same) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

/** Wert eines Feldes aus dem Request lesen (Checkbox-Gruppen zusammenführen). */
function readField_(field, p, mp, suffix) {
  var key = field.key + (suffix || '');
  if (field.multi) {
    var arr = mp[key];
    return arr ? arr.join(', ') : '';
  }
  return p[key] || '';
}

function doGet() {
  return ContentService.createTextOutput('Recruiting-Formular-Backend laeuft. POST-only.');
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
    ensureHeaders_(sheet);

    var timestamp = new Date();
    var requestId = Utilities.getUuid().slice(0, 8);

    var companyValues = COMPANY_FIELDS.map(function (f) { return readField_(f, p, mp, ''); });
    var followupValues = FOLLOWUP_FIELDS.map(function (f) { return readField_(f, p, mp, ''); });

    // 2) Alle ausgefüllten Stellen einsammeln (Suffix _1, _2, ... im Feldnamen).
    var positions = [];
    for (var i = 1; i <= SCAN_LIMIT; i++) {
      var jobtitel = p['jobtitel_' + i];
      if (jobtitel) {
        var suffix = '_' + i;
        var posValues = POSITION_FIELDS.map(function (f) { return readField_(f, p, mp, suffix); });
        positions.push({ jobtitel: jobtitel, values: posValues });
      }
    }
    if (positions.length === 0) {
      positions.push({ jobtitel: '', values: POSITION_FIELDS.map(function () { return ''; }) });
    }

    // 3) Eine Zeile pro Stelle, alle mit derselben Anfrage-ID verknüpft.
    positions.forEach(function (pos, idx) {
      var row = [timestamp, requestId, (idx + 1) + ' von ' + positions.length]
        .concat(companyValues)
        .concat(pos.values)
        .concat(followupValues);
      sheet.appendRow(row);
    });

    // 4) Gebündelte E-Mail-Benachrichtigung. Ein Mail-Fehler darf die bereits
    //    gespeicherte Anfrage NICHT als Fehlschlag erscheinen lassen.
    try {
      sendNotificationEmail_(p, companyValues, followupValues, positions, requestId, timestamp);
    } catch (mailErr) {
      Logger.log('Mailversand fehlgeschlagen: ' + mailErr);
    }

    return ContentService.createTextOutput('OK');
  } catch (err) {
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

/** Gibt eine Feldliste (Company/Position/Followup) als lesbaren Textblock aus. */
function renderFields_(fields, values, indent) {
  var pad = indent || '';
  var out = '';
  fields.forEach(function (f, i) {
    if (f.section) {
      out += '\n' + pad + '— ' + f.section + ' —\n';
    }
    var v = values[i];
    if (v !== undefined && v !== null && String(v) !== '') {
      out += pad + f.label + ': ' + v + '\n';
    }
  });
  return out;
}

function sendNotificationEmail_(p, companyValues, followupValues, positions, requestId, timestamp) {
  var firmenname = p.firmenname || 'Unbekannte Firma';
  var stellenWort = positions.length === 1 ? 'Stelle' : 'Stellen';
  var subject = 'Neue Recruiting-Anfrage: ' + firmenname + ' – ' + positions.length + ' ' + stellenWort;

  var body = 'Neue Anfrage über das Recruiting-Formular:\n\n';

  body += '========== UNTERNEHMEN ==========\n';
  COMPANY_FIELDS.forEach(function (f, i) {
    if (companyValues[i]) body += f.label + ': ' + companyValues[i] + '\n';
  });

  positions.forEach(function (pos, idx) {
    body += '\n========== STELLE ' + (idx + 1) + ' von ' + positions.length +
      (pos.jobtitel ? ': ' + pos.jobtitel : '') + ' ==========\n';
    body += renderFields_(POSITION_FIELDS, pos.values, '');
  });

  body += '\n========== ARBEITGEBER, PROZESS & FREIGABE ==========\n';
  body += renderFields_(FOLLOWUP_FIELDS, followupValues, '');

  body += '\nAnfrage-ID: ' + requestId;
  body += '\nEingegangen am: ' + timestamp.toLocaleString('de-DE');

  MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

/** Hilfsfunktion zum manuellen Testen im Apps-Script-Editor (Menü "Ausführen"). */
function testDoPost() {
  var fakeEvent = {
    parameter: {
      firmenname: 'Testfirma GmbH',
      branche: 'Sanitär- und Heizungsbau',
      firmensitz: '48431 Rheine',
      firmengroesse: '10–49 Mitarbeitende',
      firma_web: 'www.testfirma.de, instagram.com/testfirma',
      ansprechpartner_name: 'Anna Mustermann',
      ansprechpartner_telefon: '0171 2345678',
      ansprechpartner_email: 'anna@testfirma.de',

      jobtitel_1: 'Anlagenmechaniker SHK (m/w/d)',
      anzahl_stellen_1: '2',
      einsatzort_1: 'Rheine + Umkreis 50 km',
      zielgruppe_sonstige_1: '',
      aufgaben_1: 'Heizungs- und Sanitäranlagen installieren; Wartung; Störungsdienst',
      muss_kriterien_1: '1. Ausbildung SHK  2. Führerschein B  3. Deutsch für Kundenkontakt',
      kann_kriterien_1: 'Erfahrung mit Wärmepumpen',
      qualifikation_1: 'Ausbildung Anlagenmechaniker/-in SHK',
      ausschluss_kriterien_1: 'ohne Führerschein B nicht möglich',
      fachkenntnisse_noetig_1: 'Besondere Fachkenntnisse erforderlich',
      fachkenntnisse_1: 'Installationspläne lesen, Messtechnik',
      eigenschaften_1: 'zuverlässig, freundlich im Kundenkontakt',
      arbeitsumfang_1: 'Vollzeit',
      vertragsart_1: 'Unbefristet',
      wochenstunden_1: '38,5 Std./Woche',
      schichtmodell_1: '',
      arbeitszeiten_details_1: 'Mo–Fr, gelegentlich Samstag',
      gehalt_umgang_1: 'Gehaltsspanne in der Anzeige veröffentlichen',
      gehalt_1: '42.000–50.000 €/Jahr',
      besetzung_zeitpunkt_1: 'Zu einem konkreten Datum',
      besetzung_datum_1: '2026-11-01',
      wann_besetzt_1: 'Einarbeitung ab Mai möglich',
      reiseanteil_1: 'Gelegentlich regional',
      aussendienst_fuehrerschein_1: 'Ja',
      firmenfahrzeug_1: 'Ja',
      fuehrerschein_1: 'Klasse B',

      jobtitel_2: 'Bürokraft (m/w/d)',
      einsatzort_2: 'Büro Rheine',
      aufgaben_2: 'Angebote schreiben, Telefon, Terminplanung',
      muss_kriterien_2: 'kaufmännische Ausbildung, sicheres Deutsch',
      fachkenntnisse_noetig_2: 'Keine besonderen Fachkenntnisse erforderlich – Einarbeitung erfolgt',
      arbeitsumfang_2: 'Teilzeit',
      vertragsart_2: 'Unbefristet',
      wochenstunden_2: '20–30 Std./Woche',
      gehalt_umgang_2: 'Vergütung noch offen – im Kick-off-Call klären',
      besetzung_zeitpunkt_2: 'So schnell wie möglich',
      reiseanteil_2: 'Nein',

      warum_wir: '1. Planbare Arbeitszeiten  2. Moderne Fahrzeuge  3. Familiäres Team',
      urlaubstage: '30 Tage',
      benefits_sonstiges: 'Tankgutschein',
      bewerbungsweg_sonstige: '',
      bewerbung_kontakt_name: 'Anna Mustermann',
      bewerbung_kontakt_telefon: '0171 2345678',
      bewerbung_kontakt_email: 'bewerbung@testfirma.de',
      bewerbung_kontakt_zeiten: 'Mo–Fr 8–12 Uhr',
      reaktionszeit: 'Am selben Werktag',
      auswahlprozess_sonstige: '',
      freigabe_name: 'Thomas Mustermann',
      freigabe_rolle: 'Geschäftsführung',
      freigabe_email: 'thomas@testfirma.de',
      freigabe_telefon: '0171 0000000',
      freigabe_berechtigt: 'Ja',
      material_vorhanden: 'Ja, wir können Material bereitstellen',
      material_rechte: 'Ja',
      anmerkungen: 'Bitte nicht zwischen 12 und 14 Uhr anrufen',
      consent: 'Ja'
    },
    parameters: {
      zielgruppe_1: ['Berufserfahrene Fachkräfte', 'Quereinsteiger'],
      arbeitszeiten_1: ['Feste Zeiten'],
      zielgruppe_2: ['Wiedereinsteiger', 'Berufseinsteiger'],
      arbeitszeiten_2: ['Gleitzeit'],
      benefits: ['Betriebliche Altersvorsorge', 'Weihnachtsgeld', 'Firmenwagen / Dienstfahrzeug', 'Mitarbeiterrabatte / Sachbezüge'],
      bewerbungsweg: ['WhatsApp', 'Telefon', 'E-Mail'],
      auswahlprozess: ['Kurzes Telefonat', 'Persönliches Kennenlernen', 'Probearbeit / Schnuppertag']
    }
  };
  doPost(fakeEvent);
}
