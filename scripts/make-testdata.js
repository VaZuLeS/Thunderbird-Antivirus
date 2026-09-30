/**
 * Creates the reproducible test messages for the manual Thunderbird live test
 * (store readiness A-02/A-11..A-13).
 *
 * The messages contain no real data: all addresses use the reserved
 * `.example`/`.test` domains, all attachments are generated text. Run:
 *
 *     node scripts/make-testdata.js
 *
 * See docs/testdata.md for how to import them into a Thunderbird test profile.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'testdata');

function crlf(text) {
  return text.replace(/\n/g, '\r\n');
}

function multipart({ headers, boundary, parts }) {
  const body = parts.map((part) => [
    `--${boundary}`,
    `Content-Type: ${part.contentType}`,
    part.contentDisposition ? `Content-Disposition: ${part.contentDisposition}` : null,
    part.transferEncoding ? `Content-Transfer-Encoding: ${part.transferEncoding}` : null,
    '',
    crlf(part.body)
  ].filter((line) => line !== null).join('\r\n')).join('\r\n');

  return [
    crlf(headers.join('\n')),
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    body,
    `--${boundary}--`,
    ''
  ].join('\r\n');
}

function baseHeaders({ from, replyTo, subject, messageId, date }) {
  const headers = [
    `From: ${from}`,
    'To: Thundy AV Test <test@example.test>',
    `Subject: ${subject}`,
    `Date: ${date}`,
    `Message-ID: <${messageId}>`,
    'MIME-Version: 1.0',
    'Authentication-Results: mx.example.test; spf=pass smtp.mailfrom=example.com; dkim=pass; dmarc=pass'
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  return headers;
}

const messages = [
  {
    file: '01-harmless-attachment.eml',
    build: () => multipart({
      headers: baseHeaders({
        from: 'Test Sender <sender@example.com>',
        subject: 'Test: message with a harmless attachment',
        messageId: 'test-01@example.com',
        date: 'Mon, 01 Sep 2026 09:00:00 +0200'
      }),
      boundary: 'b01',
      parts: [
        { contentType: 'text/plain; charset=utf-8', body: 'Hello,\n\nthis is a harmless test attachment for the Thundy AV test run.\n' },
        {
          contentType: 'text/plain; charset=utf-8; name="test.txt"',
          contentDisposition: 'attachment; filename="test.txt"',
          body: 'Thundy AV test fixture 01 - not malware.\n'
        }
      ]
    })
  },
  {
    file: '02-html-attachment.eml',
    build: () => multipart({
      headers: baseHeaders({
        from: 'Test Sender <sender@example.com>',
        subject: 'Test: message with an HTML attachment (disarm test)',
        messageId: 'test-02@example.com',
        date: 'Mon, 01 Sep 2026 09:05:00 +0200'
      }),
      boundary: 'b02',
      parts: [
        { contentType: 'text/plain; charset=utf-8', body: 'The attachment is a simple HTML page with a script tag.\n' },
        {
          contentType: 'text/html; charset=utf-8; name="invoice.html"',
          contentDisposition: 'attachment; filename="invoice.html"',
          body: '<!DOCTYPE html>\n<html><body>\n<h1>Test invoice</h1>\n<script>document.title = "should be removed by the disarm function";</script>\n<p>Fixture for the "download disarmed HTML" action.</p>\n</body></html>\n'
        }
      ]
    })
  },
  {
    file: '03-risky-urgency-link.eml',
    build: () => multipart({
      headers: baseHeaders({
        from: 'Billing <billing@example.com>',
        subject: 'URGENT: Ihre Rechnung ist faellig - sofort zahlen',
        messageId: 'test-03@example.com',
        date: 'Mon, 01 Sep 2026 09:10:00 +0200'
      }),
      boundary: 'b03',
      parts: [
        {
          contentType: 'text/plain; charset=utf-8',
          body: 'Dringend! Ihre Ueberweisung ist faellig. Bitte sofort bezahlen:\n\nhttps://example.com/login?token=test\nhttps://example.org/verify\n'
        },
        {
          contentType: 'text/html; charset=utf-8',
          body: '<html><body><p><strong>Dringend!</strong> Zahlung faellig.</p><p><a href="https://example.com/login?token=test">Rechnung pruefen</a></p><p><a href="https://example.org/verify">Konto verifizieren</a></p></body></html>\n'
        }
      ]
    })
  },
  {
    file: '04-sender-mismatch.eml',
    build: () => multipart({
      headers: baseHeaders({
        from: '"PayPal Service" <service@paypal-support.example>',
        replyTo: 'collect@other-domain.example',
        subject: 'Test: reply-to mismatch and lookalike sender domain',
        messageId: 'test-04@example.com',
        date: 'Mon, 01 Sep 2026 09:15:00 +0200'
      }),
      boundary: 'b04',
      parts: [
        { contentType: 'text/plain; charset=utf-8', body: 'Fixture for the sender/reply-to heuristics. No attachment, no link.\n' }
      ]
    })
  }
];

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const message of messages) {
    const target = path.join(OUT_DIR, message.file);
    fs.writeFileSync(target, message.build(), 'utf8');
    console.log('wrote ' + path.relative(path.join(__dirname, '..'), target));
  }
  console.log('\n' + messages.length + ' fixtures written. Import instructions: docs/testdata.md');
}

if (require.main === module) {
  main();
}

module.exports = { messages, OUT_DIR };
