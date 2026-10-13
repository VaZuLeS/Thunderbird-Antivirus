// Local audit records are independent of provider caches. No network transmission.
const LINK_AUDIT_KEY = 'linkAuditLog';
const LINK_AUDIT_DAYS = 30;
const LINK_AUDIT_LIMIT = 2000;
const LINK_AUDIT_BYTES = 2 * 1024 * 1024;
let linkAuditQueue = Promise.resolve();
const linkAuditSessions = new ExpiringMap(60 * 60 * 1000);

function pruneLinkAudit(records, now = Date.now()) {
    const retained = records.filter(record => record && Number.isFinite(record.clickedAt) && now - record.clickedAt <= LINK_AUDIT_DAYS * 86400000)
        .sort((a, b) => b.clickedAt - a.clickedAt).slice(0, LINK_AUDIT_LIMIT);
    let size = 2;
    return retained.filter(record => { size += new TextEncoder().encode(JSON.stringify(record)).length + 1; return size <= LINK_AUDIT_BYTES; });
}

function editLinkAudit(edit) {
    const job = linkAuditQueue.then(async () => {
        const stored = await browser.storage.local.get([LINK_AUDIT_KEY, 'linkAuditProfileId']);
        const records = pruneLinkAudit(Array.isArray(stored[LINK_AUDIT_KEY]) ? stored[LINK_AUDIT_KEY] : []);
        const result = edit(records);
        const profileId = stored.linkAuditProfileId || crypto.randomUUID();
        await browser.storage.local.set({ [LINK_AUDIT_KEY]: pruneLinkAudit(records), linkAuditProfileId: profileId });
        return { result, profileId };
    });
    linkAuditQueue = job.catch(() => {});
    return job;
}

function reportLinkAuditFailure() {
    Logger.warn('Local link audit could not be persisted');
    notify('notificationTitleError', 'auditFailure');
}

function auditSessionKey(request, sender) {
    if (!sender || !sender.tab || sender.tab.id == null || typeof request.interactionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(request.interactionId)) return null;
    return sender.tab.id + ':' + request.interactionId;
}

async function updateLinkAudit(id, changes) {
    const { result } = await editLinkAudit(records => {
        const record = records.find(record => record.id === id);
        if (!record) return false; // Retention or explicit deletion removed this interaction.
        Object.assign(record, changes);
        return pruneLinkAudit(records).some(retained => retained.id === id);
    });
    return result;
}

async function handleAuditedLinkCheck(request, sender) {
    const clickedAt = Date.now();
    const key = auditSessionKey(request, sender);
    if (!key || linkAuditSessions.has(key)) return { status: 'ERROR', auditSaved: false };
    if (linkAuditSessions.size >= LINK_AUDIT_LIMIT) linkAuditSessions.delete(linkAuditSessions.keys().next().value);
    const session = { auditSaved: true, url: request.url, messageId: request.messageId, checked: false, terminal: false, opening: false, score: null };
    linkAuditSessions.set(key, session);
    session.ready = (async () => {
        const url = new URL(request.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid link scheme');
        const message = await getFirstDisplayedMessage(sender.tab.id, { throwOnError: true });
        if (!message || message.id !== request.messageId) throw new Error('Message context changed');
        const record = { id: crypto.randomUUID(), clickedAt, decidedAt: null, messageId: message.id, url: url.href, score: null, scoreSource: 'local-message-and-link', scoreAtDecision: null, verdict: 'UNKNOWN', verdictAtDecision: null, providerAtDecision: null, provider: 'none', reasons: [], outcome: 'PENDING', cancelReason: null, openAttempts: 0, extensionVersion: browser.runtime.getManifest().version };
        session.record = record;
        try {
            if (new TextEncoder().encode(JSON.stringify(record)).length + 2 > LINK_AUDIT_BYTES) throw new Error('Audit event exceeds retention budget');
            await editLinkAudit(records => records.unshift(record));
        }
        catch (error) { session.auditSaved = false; reportLinkAuditFailure(); }
        return message;
    })();
    try {
        const message = await session.ready;
        const localCheck = (async () => {
            try {
                const fullMessage = await browser.messages.getFull(message.id);
                const messageText = extractTextFromParts(fullMessage.parts || fullMessage);
                const options = await collectThreatEvaluationOptions({ message, fullMessage, filteredUrls: [request.url], messageText, allowExternal: false });
                const threat = calculateThreatScore(message.author, [request.url], options);
                session.score = Number.isFinite(threat.score) ? Math.max(0, Math.min(100, threat.score)) : null;
                session.scoredAt = Date.now();
                try {
                    const saved = await updateLinkAudit(session.record.id, { score: session.score, scoredAt: session.scoredAt, reasons: (threat.reasons || []).slice(0, 20), reasonDetails: (threat.reasonDetails || []).slice(0, 20) });
                    if (!saved) session.auditSaved = false;
                } catch (error) { session.auditSaved = false; reportLinkAuditFailure(); }
            } catch (error) { session.score = null; }
        })();
        const verdict = await new Promise(resolve => handleCheckLinkState(request, sender, resolve));
        session.verdict = verdict.status || 'UNKNOWN'; session.provider = verdict.provider || 'none'; session.checked = true;
        await localCheck;
        let saved = false;
        try { saved = await updateLinkAudit(session.record.id, { verdict: session.verdict, provider: session.provider, checkedAt: Date.now(), providerReasons: (verdict.reasons || []).slice(0, 20) }); }
        catch (error) { reportLinkAuditFailure(); }
        return { ...verdict, score: session.score, auditSaved: saved && session.auditSaved };
    } catch (error) {
        // Consume ready rejection even when cancellation arrives while initialising.
        reportLinkAuditFailure();
        return { status: 'ERROR', score: session.score, auditSaved: false };
    }
}

async function handleCancelAuditedLink(request, sender) {
    const session = linkAuditSessions.get(auditSessionKey(request, sender));
    if (!session || session.url !== request.url || session.messageId !== request.messageId || session.opening || session.terminal) return { success: false };
    const decidedAt = Date.now();
    session.terminal = true;
    try {
        await session.ready;
        const reason = ['cancel', 'escape', 'destination_changed', 'context_closed'].includes(request.reason) ? request.reason : 'cancel';
        const saved = await updateLinkAudit(session.record.id, { outcome: 'ABORTED', decidedAt, cancelReason: reason, scoreAtDecision: session.scoredAt <= decidedAt ? session.score : null, verdictAtDecision: session.verdict || 'UNKNOWN', providerAtDecision: session.provider || 'none' });
        return { success: saved };
    } catch (error) { reportLinkAuditFailure(); return { success: false }; }
}

async function handleOpenAuditedLink(request, sender) {
    const session = linkAuditSessions.get(auditSessionKey(request, sender));
    if (!session || session.url !== request.url || session.messageId !== request.messageId || !session.checked || session.opening || session.terminal) return { success: false };
    session.opening = true;
    try {
        await session.ready;
        const result = await handleOpenCheckedLink(request, sender);
        session.record.openAttempts++;
        session.terminal = result.success;
        const decidedAt = Date.now();
        try {
            const saved = await updateLinkAudit(session.record.id, { outcome: result.success ? 'OPENED' : 'OPEN_ERROR', decidedAt, openAttempts: session.record.openAttempts, scoreAtDecision: session.score, verdictAtDecision: session.verdict || 'UNKNOWN', providerAtDecision: session.provider || 'none' });
            if (!saved) return { ...result, auditSaved: false };
        } catch (error) { reportLinkAuditFailure(); return { ...result, auditSaved: false }; }
        return { ...result, auditSaved: true };
    } catch (error) { reportLinkAuditFailure(); return { success: false, auditSaved: false }; }
    finally { session.opening = false; }
}

async function readLinkAudit() {
    const { result, profileId } = await editLinkAudit(records => records.map(record => ({ ...record })));
    return { records: result, profileId, retentionDays: LINK_AUDIT_DAYS, maxRecords: LINK_AUDIT_LIMIT, maxBytes: LINK_AUDIT_BYTES };
}

function isLinkAuditAdminPage(sender) {
    return !!sender && sender.url === browser.runtime.getURL('audit.html');
}
