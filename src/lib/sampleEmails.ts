// Built-in test emails derived from testdata/
import { EmailMessage } from '../types';

export const SAMPLE_EMAILS: EmailMessage[] = [
  {
    id: 'eml-3',
    author: '"Buchhaltung Thundy-Test" <buchhaltung@example.net>',
    fromName: 'Buchhaltung Thundy-Test',
    fromEmail: 'buchhaltung@example.net',
    subject: 'Dringend: Überweisung sofort freigeben',
    date: 'Wed, 01 Oct 2025 11:20:15 +0200',
    messageId: '<testdata-03-urgency@example.net>',
    replyTo: 'finance-urgent@payment-collector.org',
    authHeaders: ['spf=fail (sender IP not in SPF)', 'dkim=fail (bad signature)', 'dmarc=fail'],
    receivedHeaders: ['from mail.example.net (198.51.100.31) by mx.test.example.com'],
    bodyText: `Sehr geehrte Damen und Herren,\n\ndie Rechnung 2025-4711 ist sofort fällig. Bitte führen Sie die Überweisung dringend und schnellstmöglich aus, damit keine Mahngebühren entstehen. Diese Zahlung ist wichtig.\n\nZahlungsportal: https://portal.example.net/rechnung/4711?uid=123\nLogin prüfen: http://secure-login.example.org/verify\nBetrag freigeben: https://example.net/freigabe/4711\n\nMit freundlichen Grüßen\nBuchhaltung`,
    bodyHtml: `<p>Die Rechnung 2025-4711 ist <b>sofort fällig</b>. Bitte die Überweisung <b>dringend</b> freigeben.</p>
<p><a href="https://portal.example.net/rechnung/4711?uid=123">Zahlungsportal</a><br>
<a href="http://secure-login.example.org/verify">Login prüfen</a><br>
<a href="https://example.net/freigabe/4711">Betrag freigeben</a></p>`,
    attachments: [{ filename: 'Rechnung_4711.pdf', size: '124 KB', type: 'application/pdf' }]
  },
  {
    id: 'eml-5',
    author: '"PayPal Security Team" <support@paypa1-update.com>',
    fromName: 'PayPal Security Team',
    fromEmail: 'support@paypa1-update.com',
    subject: 'Your account has been restricted - Action required immediately',
    date: 'Thu, 02 Oct 2025 09:14:00 +0000',
    messageId: '<security-alert-9912@paypa1-update.com>',
    replyTo: 'collector@paypa1-update.com',
    authHeaders: ['spf=fail', 'dkim=fail'],
    receivedHeaders: ['from mail.paypa1-update.com (203.0.113.88) by mx.google.com'],
    bodyText: `Dear customer,\n\nWe noticed suspicious transactions on your PayPal account. You must verify your credentials immediately to avoid suspension.\n\nVerify now: https://paypa1-verification.com/login?id=8381\n\nThank you,\nCustomer Support`,
    bodyHtml: `<p>Dear customer,</p><p>We noticed suspicious transactions on your <b>PayPal account</b>. You must verify your credentials <b>immediately</b> to avoid suspension.</p><p><a href="https://paypa1-verification.com/login?id=8381">Verify your account immediately</a></p>`,
    attachments: []
  },
  {
    id: 'eml-1',
    author: '"Anna Weber" <anna.weber@example.org>',
    fromName: 'Anna Weber',
    fromEmail: 'anna.weber@example.org',
    subject: 'Projektunterlagen und Protokoll der letzten Besprechung',
    date: 'Mon, 29 Sep 2025 14:02:10 +0200',
    messageId: '<meeting-notes-20250929@example.org>',
    replyTo: 'anna.weber@example.org',
    authHeaders: ['spf=pass', 'dkim=pass', 'dmarc=pass'],
    receivedHeaders: ['from mail.example.org (192.0.2.1) by mx.example.com'],
    bodyText: `Hallo zusammen,\n\nanbei die Notizen zu unserem heutigen Statusmeeting. Der nächste Meilenstein ist wie besprochen für nächsten Monat geplant.\n\nDokumentation: https://example.org/projekte/q4\n\nViele Grüße,\nAnna`,
    bodyHtml: `<p>Hallo zusammen,</p><p>anbei die Notizen zu unserem heutigen Statusmeeting. Der nächste Meilenstein ist wie besprochen für nächsten Monat geplant.</p><p><a href="https://example.org/projekte/q4">Projekt-Dokumentation einsehen</a></p>`,
    attachments: [{ filename: 'Protokoll_Status.pdf', size: '280 KB', type: 'application/pdf' }]
  },
  {
    id: 'eml-4',
    author: '"Kundenservice" <service@legit-shop.de>',
    fromName: 'Kundenservice',
    fromEmail: 'service@legit-shop.de',
    subject: 'Ihre Bestellung 8912 - Statusabfrage',
    date: 'Tue, 30 Sep 2025 16:45:22 +0200',
    messageId: '<order-8912@legit-shop.de>',
    replyTo: 'phishing-trap@foreign-server.ru',
    authHeaders: ['spf=pass', 'dkim=neutral'],
    receivedHeaders: ['from mail.legit-shop.de (198.51.100.12) by mx.test.example.com'],
    bodyText: `Guten Tag,\n\nIhre Sendung wurde versandt. Bei Rückfragen antworten Sie bitte direkt auf diese Nachricht.\n\nSendungsverfolgung: https://dhl-paket-tracking.ru/shipment/8912`,
    bodyHtml: `<p>Guten Tag,</p><p>Ihre Sendung wurde versandt. Bei Rückfragen antworten Sie bitte direkt auf diese Nachricht.</p><p><a href="https://dhl-paket-tracking.ru/shipment/8912">Sendung verfolgen (DHL)</a></p>`,
    attachments: []
  }
];
