1. **Understand Request**: Add BEC (Business Email Compromise) protection:
    - Standard: Detect "Reply-To" vs "From" discrepancy.
    - Modern: Behavioral analysis. Has the user communicated with this address before? Are there unusual "urgency" signal words in the subject/text?

2. **Analysis**:
    - The `calculateThreatScore` function in `background.js` evaluates threat scores based on various checks. We need to pass `replyTo`, `messageText`, `subject`, and `isFirstCommunication` to it.
    - `browser.messages.getFull(message.id)` returns the full message including headers. `fullMessage.headers['reply-to']` should give us the Reply-To header. We can extract it and pass it to `calculateThreatScore`.
    - `messageText` is already extracted using `extractTextFromParts(fullMessage)`.
    - `message.subject` provides the subject.
    - For `isFirstCommunication` (Has the user communicated with this address before?), we can use the Thunderbird API: `browser.messages.query({ to: senderEmail })`. Or, we can query `messagesRead` which searches all messages. If the search returns no results, the user hasn't sent a message to this address. Alternatively, maybe `browser.messages.query({ folder: { type: "sent" }, to: senderEmail })` or simply searching all messages involving this email as a recipient. Or actually, just `browser.messages.query({ author: userEmail, to: senderEmail })`. Since we just want to know if the user sent an email *to* the sender, we can use `browser.messages.query({ to: senderEmail })` or `browser.messages.query({ emails: [senderEmail] })`. Wait, the user could have received messages from them before, but "Has the user communicated with this address" usually means "Has the user sent a message to this address". Actually, the simplest check is `await browser.messages.query({ to: senderEmail })` or `await browser.messages.query({ fullText: senderEmail })` or maybe just `browser.messages.query({ author: "*", to: senderEmail })` ? Let's check Thunderbird WebExtensions API for `messages.query`. The `query` method accepts a `QueryInfo` object which can include `to`, `author`, `subject`, etc. If `(await browser.messages.query({ to: senderEmail })).messages.length === 0` (or `> 0`), we know if there has been previous outgoing communication. Actually, checking if the user replied to them can be done by checking `browser.messages.query({ to: senderEmail })`. Wait, if we use `browser.messages.query`, `messagesList.messages.length` might work.

3. **Modifications to `background.js`**:
    - In `tab_mail_open_display`:
        - Extract sender email from `message.author`.
        - Await `browser.messages.query({ to: senderEmail })`. (Thunderbird's `messages.query` returns a `MessageList` which has a `messages` array). Wait, to be safe, `let previousMsgs = await browser.messages.query({ to: senderEmail }); let isFirstCommunication = previousMsgs.messages.length === 0;` Wait, `messages.query` might not be supported in older Thunderbird versions, so we should wrap it in a try-catch. If it fails, we assume `isFirstCommunication = false` or we just ignore the error.
        - Extract `reply-to` header: `let replyTo = fullMessage.headers['reply-to'] ? fullMessage.headers['reply-to'][0] : "";`.
        - Update `calculateThreatScore` signature and pass these variables.
        - In `calculateThreatScore`:
            - Implement logic from my `test_bec_logic.js` script to compare "From" and "Reply-To" domains.
            - Implement logic to check for urgency words in `subject + " " + messageText`.
            - If `isFirstCommunication` is true and urgency words exist, it's a high risk BEC.

4. **Testing**: Add cases in `test_risk_score.js` and `background.test.js`.
