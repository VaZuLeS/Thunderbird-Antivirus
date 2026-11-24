// Original-file actions through Thundy. Evidence is read from local storage.
const ThundyAttachmentDownload = (() => {
    const hashLimit = 25 * 1024 * 1024;
    const assessmentWait = 5000;
    const partPattern = /^[0-9]+(?:\.[0-9]+)*$/;
    const validScore = value => Number.isFinite(value) && value >= 0 && value <= 100;
    const fail = code => Object.assign(new Error(code), {code});
    const unavailable = () => ({score:null, malicious:false, state:'unknown'});

    function evidence(item, digest, managed = false, archived = false) {
        if (!digest || item?.hybrid_sha256?.toLowerCase?.() !== digest) return unavailable();
        const {bound:matching,fullyBound} = ThundyProviderResults.boundAttachmentReports(item.report,digest);
        // A mixed legacy payload may also have produced an unbound composite assessment.
        const stored = fullyBound ? ThundyProviderResults.project(item.assessment) : {};
        const evaluated = matching.map(report => ThundyProviderResults.evaluate('hybridanalysis',report));
        const signals = [...(stored.signals || []), ...evaluated.flatMap(report => report.signals)];
        const scores = signals.filter(s => s.code === 'threat_score' && validScore(s.value)).map(s => s.value);
        const score = scores.length ? Math.max(...scores) : null;
        const detections = item.virustotal_stats?.malicious;
        const maliciousProviders = [];
        if (signals.some(s => (s.code === 'verdict' || managed && s.code === 'scanner') && s.verdict === 'malicious')) maliciousProviders.push('Hybrid Analysis');
        if (managed && !archived && Number.isSafeInteger(detections) && detections > 0) maliciousProviders.push('VirusTotal');
        const state = item.state === 'UPLOADED' || stored.completion === 'pending' ||
            evaluated.some(report => report.completion === 'pending') ? 'pending' :
            stored.completion === 'failed' || evaluated.some(report => report.completion === 'failed') ? 'failed' :
            matching.length > 0 && fullyBound &&
                matching.every((report,i) => evaluated[i].completion === 'complete' &&
                    ThundyProviderResults.hybridCompletionConfirmed(report)) ? 'complete' : 'unknown';
        return {score, malicious:maliciousProviders.length > 0, state, maliciousProviders};
    }

    function decision(policy, result) {
        if (policy.invalid) return {mode:'block',reason:'policy_invalid'};
        if (policy.managed) return ThundyManagedPolicy.decision(policy, {
            score:result.score, malicious:result.malicious, incomplete:!validScore(result.score) || result.state !== 'complete'
        });
        if (policy.mode === 'off') return {mode:'allow',reason:null};
        if (result.malicious) return {mode:policy.mode,reason:'malicious'};
        if (validScore(result.score) && result.score >= policy.threshold) return {mode:policy.mode,reason:'threshold'};
        if (!validScore(result.score) || result.state !== 'complete') return {mode:policy.unknown,reason:'unknown'};
        return {mode:'allow',reason:null};
    }

    function selectEvidence(record,part,digest,policy,pending) {
        const matches = entry => entry?.partName === part &&
            typeof entry.hybrid_sha256 === 'string' && entry.hybrid_sha256.toLowerCase() === digest;
        const active = (Array.isArray(record?.attachments) ? record.attachments : []).filter(matches);
        const current = active.length === 1 ? active[0] : null;
        const result = evidence(current,digest,policy.managed);
        if (pending) result.state = 'pending';
        const observed = item => {
            const time = typeof item?.report_fetched_at === 'string' ? Date.parse(item.report_fetched_at) : NaN;
            return Number.isFinite(time) ? time : null;
        };
        const selection = {item:current,result,source:current ? 'current' : null,observedAt:observed(current)};
        const entries = record?.analysisReportArchive?.entries;
        if (!Array.isArray(entries)) return selection;
        const stronger = (a,b) => Number(a.malicious)-Number(b.malicious) || (a.score ?? -1)-(b.score ?? -1);
        let best = selection;
        for (const entry of entries) {
            const item = entry?.resource;
            if (entry?.kind !== 'attachment' || !matches(item)) continue;
            const archived = evidence(item,digest,policy.managed,true);
            const time = observed(item);
            if (result.state === 'complete' && (result.malicious || validScore(result.score)) &&
                selection.observedAt !== null && time !== null && selection.observedAt > time) continue;
            if (archived.malicious || validScore(archived.score) && archived.score >= policy.threshold) {
                const rank = stronger(archived,best.result);
                if (rank > 0 || rank === 0 && best.source === 'archive' && (time ?? 0) > (best.observedAt ?? 0)) {
                    best = {item,result:archived,currentState:result.state,source:'archive',observedAt:time};
                }
            }
        }
        return best;
    }

    function safeFilename(value) {
        let name = String(value || '').split(/[/\\]/).pop().replace(/[<>:"|?*\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,'_').trim();
        name = name.replace(/^[. ]+|[. ]+$/g,'');
        if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_'+name;
        if (name.length > 180) {
            const extension = /\.[^.]{1,24}$/.exec(name)?.[0] || '';
            name = name.slice(0,180-extension.length)+extension;
        }
        return name || 'attachment';
    }

    function attachmentIncidentEvidence(item, current, digest, source, observedAt) {
        const providers = [];
        if (item && digest) {
            const {bound,fullyBound} = ThundyProviderResults.boundAttachmentReports(item.report,digest);
            if (bound.length) {
                const assessed = ThundyProviderResults.stored('hybridanalysis',{report:bound,assessment:fullyBound ? item.assessment : null});
                if (['malicious','suspicious'].includes(assessed.verdict) || assessed.verdict === 'none' && assessed.completion === 'complete') {
                    providers.push({provider:'hybridanalysis',verdict:assessed.verdict === 'none' ? 'no_detection' : assessed.verdict,
                        source:source === 'archive' ? 'archive' : 'stored',observedAt,
                        score:evidence(item,digest).score,reference:digest,jobId:fullyBound ? item.hybrid_job_id : null,
                        detections:ThundyProviderResults.hybridDetections(bound)});
                }
            }
        }
        const stats = current?.virustotal_stats;
        if (Number.isSafeInteger(stats?.malicious) && stats.malicious >= 0 && Number.isSafeInteger(stats.suspicious) && stats.suspicious >= 0) {
            const verdict = stats.malicious ? 'malicious' : stats.suspicious ? 'suspicious' :
                stats.harmless > 0 || stats.undetected > 0 ? 'no_detection' : null;
            if (verdict) providers.push({provider:'virustotal',verdict,source:'stored',
                maliciousCount:stats.malicious,suspiciousCount:stats.suspicious,detections:ThundyProviderResults.projectDetections(stats.detections)});
        } else if (Number.isSafeInteger(stats?.malicious) && stats.malicious > 0) {
            providers.push({provider:'virustotal',verdict:'malicious',source:'stored',maliciousCount:stats.malicious,detections:ThundyProviderResults.projectDetections(stats.detections)});
        }
        return providers;
    }

    function create(api, deps) {
        const challenges = new Map();
        const starts = new Set();
        const lifetime = 60000;
        const page = api.runtime.getURL('attachment_download.html');

        function forget(id) {
            clearTimeout(challenges.get(id)?.timer);
            challenges.delete(id);
        }
        function clear() {
            for (const id of challenges.keys()) forget(id);
            for (const start of starts) start.invalidated = true;
        }
        api.tabs.onRemoved?.addListener(id => {
            for (const [key,entry] of challenges) if (entry.tabId === id || entry.target.tabId === id) forget(key);
            for (const start of starts) if (start.target.tabId === id) start.invalidated = true;
        });
        api.messageDisplay?.onMessagesDisplayed?.addListener((tab,list) => {
            const displayed = Array.isArray(list) ? list : list?.messages;
            const changed = target => target.tabId === tab.id &&
                (displayed?.length !== 1 || displayed[0].id !== target.messageId);
            for (const [key,entry] of challenges) if (changed(entry.target)) forget(key);
            for (const start of starts) if (changed(start.target)) start.invalidated = true;
        });

        async function current(target) {
            const list = await api.messageDisplay.getDisplayedMessages(target.tabId);
            const messages = Array.isArray(list) ? list : list?.messages;
            if (messages?.length !== 1 || messages[0].id !== target.messageId) throw fail('ATTACHMENT_CONTEXT_CHANGED');
            return messages[0];
        }

        async function readFile(target) {
            await current(target);
            const inventory = await api.messages.listAttachments(target.messageId);
            const matches = inventory.filter(item => item.partName === target.partName);
            if (matches.length !== 1 || target.operation === 'open' && matches[0].type && matches[0].type !== 'normal') throw fail('ATTACHMENT_CONTEXT_CHANGED');
            try {
                const file = await api.messages.getAttachmentFile(target.messageId,target.partName);
                const digest = file.size <= hashLimit ? await deps.hash(await file.arrayBuffer()) : null;
                return {file,digest};
            } catch (_) { throw fail('ATTACHMENT_READ_FAILED'); }
        }

        async function sameFile(initial, next) {
            if (initial.file.name !== next.file.name || initial.file.size !== next.file.size ||
                initial.file.type !== next.file.type || initial.digest !== next.digest) return false;
            if (initial.digest) return true;
            // Large files remain unscored. Compare their two immutable reads with bounded memory.
            const chunk = 1024 * 1024;
            for (let offset = 0; offset < initial.file.size; offset += chunk) {
                const end = offset+chunk;
                const [a,b] = await Promise.all([initial.file.slice(offset,end).arrayBuffer(),next.file.slice(offset,end).arrayBuffer()]);
                const other = new Uint8Array(b);
                if (!new Uint8Array(a).every((byte,i) => byte === other[i])) return false;
            }
            return true;
        }

        async function evaluate(target, resource) {
            const saved = await (deps.security.effective?.() ?? deps.security.read());
            const policy = {...deps.security.attachmentDefaults,...saved.attachmentPolicy};
            let showReport = false;
            if (resource.digest && policy.mode !== 'off') {
                try {
                    showReport = (await api.storage.local.get('analysisShowHybridDetails')).analysisShowHybridDetails !== false;
                } catch (_) { /* report action is optional */ }
            }
            const message = await current(target);
            const revision = deps.revision(target.messageId);
            let record;
            if (resource.digest && policy.mode !== 'off') {
                // Read the latest stored result last. A manual report can update it without a scan-job revision.
                try { record = await deps.record(message); } catch (_) { /* missing evidence stays unknown */ }
            }
            const {item,result,currentState,source,observedAt} = selectEvidence(record,target.partName,resource.digest,policy,
                deps.pending(target.messageId,target.partName));
            const rules = decision(policy,result);
            const reporting = policy.managed ? saved.managed?.reporting : null;
            const matching = resource.digest && Array.isArray(record?.attachments) ?
                record.attachments.filter(entry => entry?.partName === target.partName &&
                    entry.hybrid_sha256?.toLowerCase?.() === resource.digest) : [];
            const findings = attachmentIncidentEvidence(item,matching.length === 1 ? matching[0] : null,resource.digest,source,observedAt);
            const presentation = typeof ThundySeverity === 'undefined' ? null : ThundySeverity.presentation({
                ...rules,score:result.score,malicious:result.malicious,incomplete:currentState !== 'complete' && currentState !== 'checked'
            },saved.managed?.severityColors);
            const details = {name:safeFilename(resource.file.name),threshold:policy.invalid ? null : policy.threshold,managed:policy.managed === true,operation:target.operation,...result,...rules,currentState,source,observedAt,
                report:showReport && !!item?.report,approvalConfigured:!!saved.approval,presentation,findings};
            return {details, item, approval:saved.approval, revision, reportMode:reporting?.mode,
                incidentEvidence:reporting?.details ? findings : [],
                signature:JSON.stringify([policy.revision,details,saved.approval?.hash])};
        }

        function boundedAssessment(target, resource) {
            let timer;
            // A stalled read must release the shared settings and approval queue.
            // Only the caller commits a download after the read wins this race.
            const timeout = new Promise((_,reject) => {
                timer = setTimeout(() => reject(fail('ATTACHMENT_CHECK_TIMEOUT')),assessmentWait);
            });
            return Promise.race([evaluate(target,resource),timeout]).finally(() => clearTimeout(timer));
        }

        async function download(file, name) {
            const url = URL.createObjectURL(file);
            try {
                const id = await api.downloads.download({url,filename:name,saveAs:true,conflictAction:'uniquify'});
                if (!Number.isInteger(id)) throw fail('ATTACHMENT_DOWNLOAD_FAILED');
                return {success:true,saved:true};
            } finally {
                setTimeout(() => URL.revokeObjectURL(url),60000);
            }
        }

        async function transfer(target, resource, assessment) {
            if (target.operation !== 'open') return download(resource.file,assessment.details.name);
            try {
                await api.messages.openAttachment(target.messageId,target.partName,target.tabId);
                return {success:true,opened:true};
            } catch (_) { throw fail('ATTACHMENT_OPEN_FAILED'); }
        }

        function recordAttempt(attempt, resource, assessment) {
            const { mode, reason } = assessment.details;
            if (!assessment.reportMode || assessment.reportMode === 'off' || !deps.reportAttempt || attempt.reported ||
                (reason !== 'malicious' && !(reason === 'threshold' && assessment.reportMode === 'suspicious'))) return;
            attempt.reported = true;
            void deps.reportAttempt({id:attempt.eventId,kind:attempt.target.operation === 'open' ? 'attachment_open' : 'attachment_save',
                mode,reason,finding:'malware',indicator:resource.digest,score:assessment.details.score,threshold:assessment.details.threshold,
                name:assessment.details.name,evidence:assessment.incidentEvidence});
        }

        async function openDialog(attempt, resource, assessment) {
            if (challenges.size >= 20) throw fail('ATTACHMENT_DIALOG_LIMIT');
            const id = crypto.randomUUID();
            const entry = {...attempt,resource,assessment,until:Date.now()+lifetime,busy:false};
            entry.timer = setTimeout(() => forget(id),lifetime);
            challenges.set(id,entry);
            try {
                entry.ready = api.tabs.create({url:page+'#'+id});
                entry.tabId = (await entry.ready).id;
                return {success:true,dialog:true};
            } catch (error) { forget(id); throw error; }
        }

        async function start(target) {
            if (!Number.isSafeInteger(target.tabId) || !Number.isSafeInteger(target.messageId) ||
                target.messageId < 1 || typeof target.partName !== 'string' || target.partName.length > 80 ||
                !partPattern.test(target.partName)) throw fail('ATTACHMENT_CONTEXT_CHANGED');
            target = {...target,operation:target.operation === 'open' ? 'open' : 'save'};
            const attempt = {target,invalidated:false,eventId:crypto.randomUUID()};
            starts.add(attempt);
            try {
                const resource = await readFile(target);
                if (target.operation === 'open' && !await sameFile(resource,await readFile(target))) throw fail('ATTACHMENT_CONTEXT_CHANGED');
                const result = await deps.security.serialized(async () => {
                    const assessment = await boundedAssessment(target,resource);
                    if (attempt.invalidated || assessment.revision !== deps.revision(target.messageId)) {
                        throw fail('ATTACHMENT_CONTEXT_CHANGED');
                    }
                    recordAttempt(attempt,resource,assessment);
                    if (assessment.details.mode === 'allow') return {transfer:transfer(target,resource,assessment)};
                    return {assessment};
                });
                if (result.transfer) return result.transfer;
                if (attempt.invalidated) throw fail('ATTACHMENT_CONTEXT_CHANGED');
                return openDialog(attempt,resource,result.assessment);
            } finally { starts.delete(attempt); }
        }

        async function command(request, sender) {
            const id = request.challenge;
            if (typeof id !== 'string' || sender?.id !== api.runtime.id || sender.url !== page+'#'+id) {
                throw fail('ATTACHMENT_DIALOG_EXPIRED');
            }
            const entry = challenges.get(id);
            if (!entry || (await entry.ready).id !== sender.tab?.id || challenges.get(id) !== entry ||
                entry.until <= Date.now()) throw fail('ATTACHMENT_DIALOG_EXPIRED');
            if (request.op === 'cancel') {forget(id);return {success:true};}
            if (request.op === 'status') return {success:true,details:entry.assessment.details};
            if (entry.busy || !['save','report','refresh'].includes(request.op)) throw fail('ATTACHMENT_CONTEXT_CHANGED');
            entry.busy = true;
            try {
                const next = await readFile(entry.target);
                if (!(await sameFile(entry.resource,next))) {
                    forget(id);
                    throw fail('ATTACHMENT_CONTEXT_CHANGED');
                }
                if (request.op === 'report' || request.op === 'refresh') {
                    const assessment = await boundedAssessment(entry.target,next);
                    if (challenges.get(id) !== entry || entry.until <= Date.now()) throw fail('ATTACHMENT_DIALOG_EXPIRED');
                    if (assessment.revision !== deps.revision(entry.target.messageId)) throw fail('ATTACHMENT_CONTEXT_CHANGED');
                    if (request.op === 'refresh') {
                        const changed = entry.assessment.signature !== assessment.signature;
                        entry.assessment = assessment;
                        return {success:true,changed,details:assessment.details};
                    }
                    if (!assessment.details.report) throw fail('REPORT_UNAVAILABLE');
                    return deps.openReport(entry.target,next,sender,assessment.details.source === 'archive' ? assessment.item : null);
                }
                const result = await deps.security.serialized(async () => {
                    let assessment = await boundedAssessment(entry.target,next);
                    recordAttempt(entry,next,assessment);
                    if (entry.assessment.signature !== assessment.signature) {
                        entry.assessment = assessment;
                        return {success:false,changed:true,details:assessment.details};
                    }
                    if (assessment.details.mode === 'block') throw fail('ATTACHMENT_BLOCKED');
                    if (assessment.details.mode === 'approval') {
                        if (!assessment.approval) throw fail('APPROVAL_NOT_CONFIGURED');
                        await deps.security.verify(request.password,assessment.approval,'approval');
                        assessment = await boundedAssessment(entry.target,next);
                        if (entry.assessment.signature !== assessment.signature) {
                            entry.assessment = assessment;
                            return {success:false,changed:true,details:assessment.details};
                        }
                    }
                    if (entry.until <= Date.now() || challenges.get(id) !== entry ||
                        assessment.revision !== deps.revision(entry.target.messageId)) throw fail('ATTACHMENT_CONTEXT_CHANGED');
                    forget(id);
                    return {transfer:transfer(entry.target,next,assessment)};
                });
                return await (result.transfer || result);
            } finally {entry.busy = false;}
        }
        return {start,command,clear};
    }

    return {create,evidence,decision,safeFilename};
})();
