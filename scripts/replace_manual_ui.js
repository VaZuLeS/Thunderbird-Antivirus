const fs = require('fs');

const file = fs.readFileSync('api.js', 'utf8');

const regex1 = /function renderManualUrlScanUI\([\s\S]*?container\.appendChild\(resultHtml\);/m;
const replacement1 = `function renderManualUrlScanUI(url, headerMessageId) {
    let container = document.getElementById('hybrid_analysis_api_content');

    // Erzeuge eine sichere, eindeutige ID für die URL
    let urlId = Array.from(new TextEncoder().encode(url))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.id = \`upload-container-\${urlId}\`;

    const title = document.createElement('h2');
    title.textContent = \`URL: \${url}\`;
    card.appendChild(title);

    const pInfo = document.createElement('p');
    pInfo.className = 'text-info';
    pInfo.appendChild(document.createTextNode('Diese URL wurde in der E-Mail gefunden. Aus Datenschutzgründen wurde sie '));
    const strong = document.createElement('strong');
    strong.textContent = 'nicht automatisch hochgeladen';
    pInfo.appendChild(strong);
    pInfo.appendChild(document.createTextNode('.'));
    card.appendChild(pInfo);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-primary mt-2';
    btnUpload.id = \`btn-upload-\${urlId}\`;
    btnUpload.textContent = 'URL jetzt scannen';
    card.appendChild(btnUpload);

    const pStatus = document.createElement('p');
    pStatus.className = 'mt-2';
    pStatus.id = \`upload-status-\${urlId}\`;
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    container.appendChild(card);`;


const regex2 = /function renderManualUploadUI\([\s\S]*?container\.appendChild\(resultHtml\);/m;
const replacement2 = `function renderManualUploadUI(hash, attachmentName, messageId, partName, headerMessageId) {
    let container = document.getElementById('hybrid_analysis_api_content');

    const card = document.createElement('div');
    card.className = 'card card-info mb-3';
    card.id = \`upload-container-\${hash}\`;

    const title = document.createElement('h2');
    title.textContent = \`Anhang: \${attachmentName || 'Unbekannt'}\`;
    card.appendChild(title);

    const pHash = document.createElement('p');
    pHash.textContent = \`SHA-256: \${hash}\`;
    card.appendChild(pHash);

    const pInfo = document.createElement('p');
    pInfo.className = 'text-info';
    pInfo.appendChild(document.createTextNode('Diese Datei ist der Datenbank von Hybrid Analysis unbekannt. Aus Datenschutzgründen wurde sie '));
    const strong = document.createElement('strong');
    strong.textContent = 'nicht automatisch hochgeladen';
    pInfo.appendChild(strong);
    pInfo.appendChild(document.createTextNode('.'));
    card.appendChild(pInfo);

    const btnUpload = document.createElement('button');
    btnUpload.className = 'btn-primary mt-2';
    btnUpload.id = \`btn-upload-\${hash}\`;
    btnUpload.textContent = 'Datei jetzt scannen (Upload)';
    card.appendChild(btnUpload);

    const pStatus = document.createElement('p');
    pStatus.className = 'mt-2';
    pStatus.id = \`upload-status-\${hash}\`;
    pStatus.setAttribute('aria-live', 'polite');
    pStatus.setAttribute('role', 'status');
    card.appendChild(pStatus);

    if (attachmentName && (attachmentName.toLowerCase().endsWith('.html') || attachmentName.toLowerCase().endsWith('.htm'))) {
        const cdrBtn = document.createElement('button');
        cdrBtn.className = 'btn-primary mt-2 ml-2';
        cdrBtn.id = \`btn-cdr-\${hash}\`;
        cdrBtn.textContent = 'Bereinigen & Herunterladen (Lokales CDR)';
        card.appendChild(cdrBtn);

        const cdrStatus = document.createElement('p');
        cdrStatus.className = 'mt-2';
        cdrStatus.id = \`cdr-status-\${hash}\`;
        cdrStatus.setAttribute('aria-live', 'polite');
        cdrStatus.setAttribute('role', 'status');
        card.appendChild(cdrStatus);
    }

    container.appendChild(card);`;

let replaced = file.replace(regex1, replacement1);
replaced = replaced.replace(regex2, replacement2);

fs.writeFileSync('api.js', replaced);
