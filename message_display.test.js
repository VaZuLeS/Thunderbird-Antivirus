const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { JSDOM, VirtualConsole } = require('jsdom');

const CODE = fs.readFileSync(path.join(__dirname, 'message_display.js'), 'utf8');

const HTML = '<!doctype html><html><body><p><a id="link" href="https://example.com/page">Link</a>' +
  '<a id="safe" href="mailto:someone@example.com">Mail</a></p></body></html>';

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Loads message_display.js into a jsdom document with a mocked WebExtension
 * API, exactly like Thunderbird executes it inside a displayed message.
 */
async function createUi({ state = null, checkResponse = null, scanResponse = { success: true } } = {}) {
  const dom = new JSDOM(HTML, { url: 'about:message', virtualConsole: new VirtualConsole() });
  const document = dom.window.document;
  const sent = [];
  const opened = [];
  const messageListeners = [];

  // Models Thunderbird's own link handling: it is only reached when the click
  // is not blocked by the extension.
  for (const id of ['link', 'safe']) {
    document.getElementById(id).addEventListener('click', () => opened.push(id));
  }

  const browser = {
    i18n: { getMessage: () => '' }, // force the bundled fallbacks
    runtime: {
      sendMessage: async (message) => {
        sent.push(message);
        if (message.action === 'getMessageUiState') return state;
        if (message.action === 'checkLinkState') return checkResponse;
        if (message.action === 'requestScan') return scanResponse;
        return null;
      },
      onMessage: { addListener: (listener) => messageListeners.push(listener) },
      openOptionsPage: () => {}
    }
  };

  const context = {
    browser,
    document,
    window: dom.window,
    setTimeout,
    clearTimeout,
    // The script polls for the state; tests drive the state explicitly instead.
    setInterval: () => 0,
    clearInterval: () => {},
    console,
    URL,
    Promise,
    Array,
    String,
    Object,
    JSON,
    Map,
    Set,
    Date
  };
  vm.createContext(context);
  vm.runInContext(CODE, context);
  await tick();

  function click(id) {
    const element = document.getElementById(id);
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event;
  }

  return { dom, document, sent, opened, messageListeners, click, browser };
}

const OPT_IN_STATE = {
  tabId: 7,
  messageId: 1,
  senderEmail: 'sender@example.com',
  threat: { score: 10, reasons: ['first contact'], authStatus: 'none' },
  optInNeeded: true,
  consentGiven: true,
  timeOfClickProtection: true
};

describe('message_display.js', () => {
  it('renders the opt-in banner with both actions and an options button', async () => {
    const ui = await createUi({ state: OPT_IN_STATE });

    const banner = ui.document.getElementById('thundy-banner');
    assert.ok(banner, 'the banner must be rendered');
    const buttons = banner.querySelectorAll('button');
    assert.strictEqual(buttons.length, 3);
    assert.strictEqual(buttons[0].textContent, 'Scan this message once');
    assert.strictEqual(buttons[1].textContent, 'Always scan this sender');
    assert.strictEqual(buttons[2].textContent, 'Open options');
  });

  it('sends requestScan without persisting for the one-off action', async () => {
    const ui = await createUi({ state: OPT_IN_STATE });
    const buttons = ui.document.getElementById('thundy-banner').querySelectorAll('button');

    buttons[0].dispatchEvent(new ui.dom.window.MouseEvent('click', { bubbles: true }));
    await tick();

    const scan = ui.sent.find((message) => message.action === 'requestScan');
    assert.ok(scan, 'a scan request must be sent');
    assert.strictEqual(scan.messageId, 1);
    assert.strictEqual(scan.senderEmail, 'sender@example.com');
    assert.strictEqual(scan.persist, false);
    assert.strictEqual(buttons[0].textContent, 'Scan finished');
  });

  it('persists the sender opt-in for the second action', async () => {
    const ui = await createUi({ state: OPT_IN_STATE });
    const buttons = ui.document.getElementById('thundy-banner').querySelectorAll('button');

    buttons[1].dispatchEvent(new ui.dom.window.MouseEvent('click', { bubbles: true }));
    await tick();

    const scan = ui.sent.find((message) => message.action === 'requestScan');
    assert.strictEqual(scan.persist, true);
    assert.ok(ui.document.getElementById('thundy-banner').textContent.includes('automatically'));
  });

  it('renders the threat banner with score and reasons above the message', async () => {
    const ui = await createUi({
      state: {
        ...OPT_IN_STATE,
        optInNeeded: false,
        threat: { score: 90, reasons: ['Absender-Domain weicht ab', 'Erstkontakt'], authStatus: 'none' }
      }
    });

    const banner = ui.document.getElementById('thundy-banner');
    assert.ok(banner.textContent.includes('Risk score: 90 of 100'));
    assert.ok(banner.textContent.includes('Absender-Domain weicht ab'));
    assert.strictEqual(ui.document.body.firstChild, banner, 'the banner is inserted on top of the message');
    // A scored message no longer offers the opt-in actions.
    assert.strictEqual(banner.querySelectorAll('button').length, 0);
  });

  it('renders the authentication badge for a verified sender', async () => {
    const ui = await createUi({
      state: {
        ...OPT_IN_STATE,
        optInNeeded: false,
        threat: { score: 5, reasons: [], authStatus: 'pass' }
      }
    });

    assert.ok(ui.document.getElementById('thundy-banner').textContent.includes('Sender verified'));
  });

  it('renders no banner when there is nothing to report but marks the links', async () => {
    const ui = await createUi({
      state: { ...OPT_IN_STATE, optInNeeded: false, threat: { score: 0, reasons: [], authStatus: 'none' } }
    });

    assert.strictEqual(ui.document.getElementById('thundy-banner'), null);
    const link = ui.document.getElementById('link');
    assert.strictEqual(link.dataset.thundyMarked, '1');
    assert.ok(link.title.includes('time-of-click'));
  });

  it('shows the consent hint in the banner when external analysis is disabled', async () => {
    const ui = await createUi({ state: { ...OPT_IN_STATE, consentGiven: false } });

    assert.ok(ui.document.getElementById('thundy-banner').textContent
      .includes('External analysis is disabled in the options'));
  });

  it('reports a failed scan in the banner', async () => {
    const ui = await createUi({ state: OPT_IN_STATE, scanResponse: { success: false, error: 'permission_denied' } });
    const buttons = ui.document.getElementById('thundy-banner').querySelectorAll('button');

    buttons[0].dispatchEvent(new ui.dom.window.MouseEvent('click', { bubbles: true }));
    await tick();

    assert.strictEqual(buttons[0].textContent, 'Required host permission was denied');
    assert.strictEqual(buttons[0].disabled, false);
  });

  it('blocks a link that the background classified as malicious', async () => {
    const ui = await createUi({
      state: OPT_IN_STATE,
      checkResponse: { status: 'MALICIOUS_VISUAL', reasons: ['Visuelle Erkennung: Phishing'] }
    });

    const event = ui.click('link');
    await tick();
    await tick();

    assert.strictEqual(event.defaultPrevented, true, 'the click must be blocked');
    const warning = ui.document.getElementById('thundy-link-warning');
    assert.ok(warning, 'a warning must be shown');
    assert.ok(warning.textContent.includes('Visuelle Erkennung: Phishing'));
    assert.deepStrictEqual(ui.opened, [], 'the link must not be opened');
    const check = ui.sent.find((m) => m.action === 'checkLinkState');
    assert.ok(check, 'the background must be asked for the link state');
    assert.strictEqual(check.url, 'https://example.com/page');
  });

  it('opens an unknown or clean link after the check released it', async () => {
    const ui = await createUi({ state: OPT_IN_STATE, checkResponse: { status: 'UNKNOWN' } });

    ui.click('link');
    await tick();
    await tick();

    assert.deepStrictEqual(ui.opened, ['link'],
      'the re-dispatched click reaches the normal link handling');
    assert.strictEqual(ui.document.getElementById('thundy-link-warning'), null,
      'no warning for a link that is not known to be malicious');
  });

  it('keeps blocking a link that is known to be malicious (cached verdict)', async () => {
    const ui = await createUi({
      state: OPT_IN_STATE,
      checkResponse: { status: 'MALICIOUS', reasons: ['known bad'] }
    });

    ui.click('link');
    await tick();
    await tick();
    const second = ui.click('link');
    await tick();

    assert.strictEqual(second.defaultPrevented, true);
    assert.deepStrictEqual(ui.opened, [], 'the link stays blocked');
    assert.strictEqual(ui.sent.filter((m) => m.action === 'checkLinkState').length, 1,
      'the cached verdict avoids another network round trip');
  });

  it('fails closed for schemes that cannot be verified', async () => {
    const ui = await createUi({ state: OPT_IN_STATE });
    ui.document.getElementById('link').setAttribute('href', 'file:///etc/passwd');

    const event = ui.click('link');
    await tick();

    assert.strictEqual(event.defaultPrevented, true);
    const warning = ui.document.getElementById('thundy-link-warning');
    assert.ok(warning.textContent.includes('file'));
    assert.strictEqual(ui.sent.some((m) => m.action === 'checkLinkState'), false,
      'no provider request may happen for such a scheme');
  });

  it('lets the user open a blocked link explicitly', async () => {
    const ui = await createUi({
      state: OPT_IN_STATE,
      checkResponse: { status: 'MALICIOUS', reasons: ['known bad'] }
    });

    ui.click('link');
    await tick();
    await tick();

    const openAnyway = Array.from(ui.document.getElementById('thundy-link-warning').querySelectorAll('button'))
      .find((button) => button.textContent === 'Open the link anyway');
    assert.ok(openAnyway, 'the warning offers an explicit opt-in');
    openAnyway.dispatchEvent(new ui.dom.window.MouseEvent('click', { bubbles: true }));
    await tick();

    assert.deepStrictEqual(ui.opened, ['link']);
  });

  it('does not touch safe schemes such as mailto:', async () => {
    const ui = await createUi({ state: OPT_IN_STATE });

    const event = ui.click('safe');
    await tick();

    assert.strictEqual(event.defaultPrevented, false);
    assert.deepStrictEqual(ui.opened, ['safe'], 'safe schemes keep working');
    assert.strictEqual(ui.sent.some((m) => m.action === 'checkLinkState'), false);
  });

  it('does not intercept clicks when the option is disabled', async () => {
    const ui = await createUi({ state: { ...OPT_IN_STATE, timeOfClickProtection: false } });

    const event = ui.click('link');
    await tick();

    assert.strictEqual(event.defaultPrevented, false);
    assert.deepStrictEqual(ui.opened, ['link'], 'the link is opened normally');
    assert.strictEqual(ui.sent.some((m) => m.action === 'checkLinkState'), false);
  });

  it('blocks the link when the check reports a technical failure', async () => {
    const ui = await createUi({ state: OPT_IN_STATE, checkResponse: { status: 'ERROR' } });

    const event = ui.click('link');
    await tick();
    await tick();

    assert.strictEqual(event.defaultPrevented, true);
    assert.ok(ui.document.getElementById('thundy-link-warning'), 'fail closed on errors');
  });

  it('also blocks middle clicks (auxclick) on unverified links', async () => {
    const ui = await createUi({
      state: OPT_IN_STATE,
      checkResponse: { status: 'MALICIOUS', reasons: ['known bad'] }
    });

    const element = ui.document.getElementById('link');
    const event = new ui.dom.window.MouseEvent('auxclick', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    await tick();
    await tick();

    assert.strictEqual(event.defaultPrevented, true, 'a middle click must not bypass the check');
    assert.deepStrictEqual(ui.opened, []);
    assert.ok(ui.document.getElementById('thundy-link-warning'));
  });

  it('ignores broadcasts as long as the own tab id is unknown', async () => {
    // No initial state -> the script has not learned its tab id yet.
    const ui = await createUi({ state: null });

    for (const listener of ui.messageListeners) {
      listener({ type: 'thundy:messageState', tabId: 42, state: { ...OPT_IN_STATE, tabId: 42 } });
    }

    assert.strictEqual(ui.document.getElementById('thundy-banner'), null,
      'a foreign broadcast must not be rendered before the own tab id is known');
  });

  it('updates the banner from a broadcast for its own tab only', async () => {
    const ui = await createUi({
      state: { ...OPT_IN_STATE, optInNeeded: false, threat: { score: 0, reasons: [], authStatus: 'none' } }
    });
    assert.strictEqual(ui.document.getElementById('thundy-banner'), null);

    for (const listener of ui.messageListeners) {
      listener({ type: 'thundy:messageState', tabId: 99, state: { ...OPT_IN_STATE, optInNeeded: true } });
    }
    assert.strictEqual(ui.document.getElementById('thundy-banner'), null, 'other tabs must be ignored');

    for (const listener of ui.messageListeners) {
      listener({
        type: 'thundy:messageState',
        tabId: 7,
        state: { ...OPT_IN_STATE, optInNeeded: false, threat: { score: 77, reasons: ['Phishing-Verdacht'], authStatus: 'none' } }
      });
    }
    const banner = ui.document.getElementById('thundy-banner');
    assert.ok(banner.textContent.includes('Risk score: 77 of 100'));
    assert.ok(banner.textContent.includes('Phishing-Verdacht'));
  });
});

