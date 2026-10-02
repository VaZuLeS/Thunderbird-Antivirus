'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const ThundyReport = require('./report.js');

// Alle Abschnitte, die ein Incident-Report enthalten muss.
const SECTION_HEADINGS = [
  '1. Übersicht zur Nachricht',
  '2. Risikobewertung',
  '3. Linkanalyse',
  '4. Anhänge (nur Metadaten und Hashwerte)',
  '5. Quellen und Datenschutz',
  '6. Ansprechpartner',
  '7. Was der Empfänger jetzt tun sollte',
  '8. Datenschutzhinweis'
];

// Vollständige Beispieleingabe für die Report-Tests.
function fullInput() {
  return {
    message: {
      headerMessageId: '<abc@example.com>',
      subject: 'Dringende Rechnung',
      author: 'billing@evil.example',
      recipient: 'user@corp.example',
      date: '2026-01-02T09:00:00Z',
      isFirstCommunication: true,
      replyTo: 'reply@other.example'
    },
    threat: {
      score: 87,
      level: 'critical',
      reasons: ['SPF fehlgeschlagen', 'Reply-To-Abweichung'],
      authStatus: 'fail'
    },
    links: [
      {
        url: 'https://evil.example/login',
        level: 'critical',
        action: 'block',
        score: 90,
        reasons: ['Markenimitation'],
        sources: { urlhaus: true, urlscan: false }
      }
    ],
    attachments: [
      {
        name: 'rechnung.pdf.exe',
        size: 2048,
        contentType: 'application/octet-stream',
        hash: 'a'.repeat(64),
        verdict: 'malicious',
        // Dieses Feld darf NIE im Report auftauchen.
        content: 'ATTACHMENT_BODY_SECRET'
      }
    ],
    ipReputation: { provider: 'abuseipdb', maliciousIps: ['203.0.113.5'] },
    contacts: {
      emails: 'admin@corp.example; SOC@corp.example',
      phone: '+49 30 1234567',
      name: 'Max Mustermann',
      organization: 'SOC Corp'
    },
    reporter: { email: 'user@corp.example', name: 'Erika Muster' },
    meta: {
      version: '1.7.0',
      generatedAt: '2026-01-02T09:05:00Z',
      privacyTier: 'high',
      consent: true,
      gateMode: 'strict'
    }
  };
}

function assertLineLength(body, max) {
  const lines = body.split('\n');
  for (let i = 0; i < lines.length; i++) {
    assert.ok(lines[i].length <= max, 'Zeile ' + (i + 1) + ' ist zu lang (' + lines[i].length + '): ' + lines[i]);
  }
}

describe('ThundyReport.parseAdminEmails', () => {
  it('zerlegt eine ";"-getrennte Liste, trimmt und erzwingt Kleinschreibung', () => {
    const result = ThundyReport.parseAdminEmails('  Admin@Corp.DE ; SOC@corp.de;second@Corp.de  ');
    assert.deepStrictEqual(result.emails, ['admin@corp.de', 'soc@corp.de', 'second@corp.de']);
    assert.deepStrictEqual(result.invalid, []);
  });

  it('entfernt Duplikate (auch mit unterschiedlicher Schreibweise)', () => {
    const result = ThundyReport.parseAdminEmails('a@b.de; A@B.DE ; a@b.de');
    assert.deepStrictEqual(result.emails, ['a@b.de']);
    assert.deepStrictEqual(result.invalid, []);
  });

  it('sammelt ungültige Einträge und ignoriert leere Tokens', () => {
    const result = ThundyReport.parseAdminEmails('a@b.de;;  ; notanemail; c@d; @x.de; ;e@f.de');
    assert.deepStrictEqual(result.emails, ['a@b.de', 'e@f.de']);
    assert.deepStrictEqual(result.invalid, ['notanemail', 'c@d', '@x.de']);
  });

  it('akzeptiert auch ein Array als Eingabe', () => {
    const result = ThundyReport.parseAdminEmails(['a@b.de', ' B@C.DE ', 'a@b.de']);
    assert.deepStrictEqual(result.emails, ['a@b.de', 'b@c.de']);
    assert.deepStrictEqual(result.invalid, []);
  });

  it('ist robust bei undefined, null, leerem String und Nicht-Strings', () => {
    assert.deepStrictEqual(ThundyReport.parseAdminEmails(undefined), { emails: [], invalid: [] });
    assert.deepStrictEqual(ThundyReport.parseAdminEmails(null), { emails: [], invalid: [] });
    assert.deepStrictEqual(ThundyReport.parseAdminEmails(''), { emails: [], invalid: [] });
    assert.deepStrictEqual(ThundyReport.parseAdminEmails(42), { emails: [], invalid: ['42'] });
  });
});

describe('ThundyReport.parseAdminPhone', () => {
  it('normalisiert internationale Nummern mit Plus', () => {
    assert.deepStrictEqual(ThundyReport.parseAdminPhone('+49 30 1234567'), { phone: '+49301234567', valid: true });
  });

  it('normalisiert nationale Nummern mit Schrägstrich', () => {
    assert.deepStrictEqual(ThundyReport.parseAdminPhone('030/123456'), { phone: '030123456', valid: true });
  });

  it('normalisiert Klammern, Bindestriche und Punkte', () => {
    assert.deepStrictEqual(ThundyReport.parseAdminPhone('(030) 123-456'), { phone: '030123456', valid: true });
    assert.deepStrictEqual(ThundyReport.parseAdminPhone('030.123.456'), { phone: '030123456', valid: true });
  });

  it('lehnt Buchstaben, leere Eingaben und zu kurze Nummern ab', () => {
    assert.deepStrictEqual(ThundyReport.parseAdminPhone('abc'), { phone: '', valid: false });
    assert.deepStrictEqual(ThundyReport.parseAdminPhone(''), { phone: '', valid: false });
    assert.deepStrictEqual(ThundyReport.parseAdminPhone('123'), { phone: '123', valid: false });
    assert.deepStrictEqual(ThundyReport.parseAdminPhone(undefined), { phone: '', valid: false });
    assert.deepStrictEqual(ThundyReport.parseAdminPhone(null), { phone: '', valid: false });
  });

  it('lehnt ein zusätzliches Pluszeichen innerhalb der Nummer ab', () => {
    const result = ThundyReport.parseAdminPhone('030+123456');
    assert.strictEqual(result.valid, false);
  });
});

describe('ThundyReport.severityForScore', () => {
  it('bildet die Stufen-Grenzen korrekt ab', () => {
    assert.strictEqual(ThundyReport.severityForScore(0).key, 'info');
    assert.strictEqual(ThundyReport.severityForScore(14).key, 'info');
    assert.strictEqual(ThundyReport.severityForScore(15).key, 'low');
    assert.strictEqual(ThundyReport.severityForScore(39).key, 'low');
    assert.strictEqual(ThundyReport.severityForScore(40).key, 'medium');
    assert.strictEqual(ThundyReport.severityForScore(59).key, 'medium');
    assert.strictEqual(ThundyReport.severityForScore(60).key, 'high');
    assert.strictEqual(ThundyReport.severityForScore(79).key, 'high');
    assert.strictEqual(ThundyReport.severityForScore(80).key, 'critical');
    assert.strictEqual(ThundyReport.severityForScore(100).key, 'critical');
  });

  it('begrenzt Werte außerhalb von 0..100', () => {
    assert.strictEqual(ThundyReport.severityForScore(-50).key, 'info');
    assert.strictEqual(ThundyReport.severityForScore(999).key, 'critical');
  });

  it('ist robust bei nicht-numerischen Eingaben', () => {
    assert.strictEqual(ThundyReport.severityForScore(undefined).key, 'info');
    assert.strictEqual(ThundyReport.severityForScore(null).key, 'info');
    assert.strictEqual(ThundyReport.severityForScore('keine-zahl').key, 'info');
    assert.strictEqual(ThundyReport.severityForScore(NaN).key, 'info');
  });

  it('liefert immer key, label und recommendation', () => {
    for (const score of [0, 20, 50, 70, 90]) {
      const severity = ThundyReport.severityForScore(score);
      assert.ok(typeof severity.key === 'string' && severity.key.length > 0);
      assert.ok(typeof severity.label === 'string' && severity.label.length > 0);
      assert.ok(typeof severity.recommendation === 'string' && severity.recommendation.length > 0);
    }
  });
});

// __TESTS3__