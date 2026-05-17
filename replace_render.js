const fs = require('fs');

const file = fs.readFileSync('api.js', 'utf8');

const regex = /function renderReport\([\s\S]*?return resultHtml;\n\}/;

const replacement = `function createEl(tag, className = '', textContent = '') {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent) el.textContent = textContent;
    return el;
}

function renderReport(json_data, attachmentName, hybrid_sha, messageId, partName, headerMessageId, virustotal_stats = null) {
    const fragment = document.createDocumentFragment();
    const card = createEl('div', 'card mb-3');
    fragment.appendChild(card);

    const title = createEl('h2', '', \`Geprüftes Element: \${attachmentName || 'Unbekannt'}\`);
    card.appendChild(title);

    if (json_data.state === 'IN_PROGRESS') {
        const p1 = createEl('p', 'text-warning');
        const s1 = createEl('strong', '', 'Status:');
        p1.appendChild(s1);
        p1.appendChild(document.createTextNode(' Die Analyse läuft noch (IN_PROGRESS). Bitte versuchen Sie es später erneut.'));
        card.appendChild(p1);

        card.appendChild(createEl('p', '', \`SHA-256: \${json_data.sha256 || hybrid_sha}\`));
    } else {
        let threatClass = "text-success";
        if (json_data.threat_score > 50) threatClass = "text-warning";
        if (json_data.threat_score > 80) threatClass = "text-danger";

        const pThreat = createEl('p');
        pThreat.appendChild(createEl('strong', \`head_line \${threatClass}\`, 'Bedrohungsscore: '));
        pThreat.appendChild(createEl('span', threatClass, String(json_data.threat_score)));
        card.appendChild(pThreat);

        const pVerdict = createEl('p');
        pVerdict.appendChild(createEl('strong', \`head_line \${threatClass}\`, 'Urteil: '));
        pVerdict.appendChild(createEl('span', threatClass, String(json_data.verdict)));
        card.appendChild(pVerdict);

        const pVxFam = createEl('p');
        pVxFam.appendChild(createEl('strong', '', 'Vx-Familie: '));
        pVxFam.appendChild(document.createTextNode(String(json_data.vx_family || 'N/A')));
        card.appendChild(pVxFam);

        card.appendChild(createEl('p', '', \`Multiscan-Ergebnis: \${json_data.multiscan_result || 'N/A'}\`));

        const pAdditionalInfo = createEl('p');
        pAdditionalInfo.appendChild(createEl('strong', '', 'Additional Information:'));
        card.appendChild(pAdditionalInfo);

        card.appendChild(createEl('p', '', \`Analysis start time: \${json_data.analysis_start_time || 'N/A'}\`));
        card.appendChild(createEl('p', '', \`Tags: \${json_data.tags ? json_data.tags.join(', ') : 'N/A'}\`));

        card.appendChild(createEl('div', 'head_line', 'Scannerergebnisse:'));

        if (virustotal_stats) {
            const pVT = createEl('p', 'ml-2');
            pVT.appendChild(createEl('strong', '', 'VirusTotal Ergebnisse:'));
            card.appendChild(pVT);

            card.appendChild(createEl('p', 'ml-4 text-warning', \`Malicious: \${virustotal_stats.malicious || 0}\`));
            card.appendChild(createEl('p', 'ml-4', \`Undetected: \${virustotal_stats.undetected || 0}\`));
            card.appendChild(createEl('p', 'ml-4', \`Suspicious: \${virustotal_stats.suspicious || 0}\`));
            card.appendChild(createEl('p', 'ml-4', \`Harmless: \${virustotal_stats.harmless || 0}\`));
        }

        if (json_data.scanners && json_data.scanners.length > 0) {
            for (const scanner of json_data.scanners) {
                card.appendChild(createEl('p', 'ml-2', \`Scanner: \${scanner.name}\`));
                card.appendChild(createEl('p', 'ml-4', \`Status: \${scanner.status}\`));
                if (scanner.anti_virus_results) {
                    card.appendChild(createEl('p', 'ml-4', 'AV-Ergebnisse:'));
                    for (const avResult of scanner.anti_virus_results) {
                        card.appendChild(createEl('p', 'ml-6', \`AV: \${avResult.product} - Urteil: \${avResult.verdict}\`));
                    }
                }
            }
        } else {
            card.appendChild(createEl('p', 'ml-2', 'Keine Scanner-Ergebnisse verfügbar.'));
        }

        card.appendChild(createEl('p', '', \`SHA-256-Hashwert: \${json_data.sha256}\`));
        card.appendChild(createEl('p', '', \`Letzter Dateiname: \${json_data.last_file_name || 'N/A'}\`));
        card.appendChild(createEl('p', '', \`Größe: \${json_data.size || 'N/A'} Bytes\`));
        card.appendChild(createEl('p', '', \`Typ: \${json_data.type || 'N/A'}\`));

        const rescanBtn = createEl('button', 'btn-success mt-2', 'Erneut scannen (Rescan)');
        rescanBtn.id = \`btn-rescan-\${hybrid_sha}\`;
        card.appendChild(rescanBtn);

        const rescanStatus = createEl('p', 'mt-2');
        rescanStatus.id = \`rescan-status-\${hybrid_sha}\`;
        rescanStatus.setAttribute('aria-live', 'polite');
        rescanStatus.setAttribute('role', 'status');
        card.appendChild(rescanStatus);

        if (attachmentName && (attachmentName.toLowerCase().endsWith('.html') || attachmentName.toLowerCase().endsWith('.htm'))) {
            const cdrBtn = createEl('button', 'btn-primary mt-2 ml-2', 'Bereinigen & Herunterladen (Lokales CDR)');
            cdrBtn.id = \`btn-cdr-\${hybrid_sha}\`;
            card.appendChild(cdrBtn);

            const cdrStatus = createEl('p', 'mt-2');
            cdrStatus.id = \`cdr-status-\${hybrid_sha}\`;
            cdrStatus.setAttribute('aria-live', 'polite');
            cdrStatus.setAttribute('role', 'status');
            card.appendChild(cdrStatus);
        }
    }
    return fragment;
}`;

const replaced = file.replace(regex, replacement);

fs.writeFileSync('api.js', replaced);
