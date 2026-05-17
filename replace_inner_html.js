const fs = require('fs');
const file = fs.readFileSync('api.js', 'utf8');

let replaced = file;

// line 22
replaced = replaced.replace(
    /document\.getElementById\('hybrid_analysis_api_content'\)\.innerHTML = '<div class="alert-error"><strong>Warnung:<\/strong> Kein API-Schlüssel für Hybrid-Analysis gefunden\. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung\.<\/div>';/,
    `let container = document.getElementById('hybrid_analysis_api_content');
    container.textContent = '';
    let alertDiv = document.createElement('div');
    alertDiv.className = 'alert-error';
    let strong = document.createElement('strong');
    strong.textContent = 'Warnung:';
    alertDiv.appendChild(strong);
    alertDiv.appendChild(document.createTextNode(' Kein API-Schlüssel für Hybrid-Analysis gefunden. Bitte hinterlegen Sie diesen in den Einstellungen der Erweiterung.'));
    container.appendChild(alertDiv);`
);

// line 69
replaced = replaced.replace(
    /document\.getElementById\('hybrid_analysis_api_content'\)\.innerHTML = ''; \/\/ clear/,
    `document.getElementById('hybrid_analysis_api_content').textContent = ''; // clear`
);

// line 92
replaced = replaced.replace(
    /document\.getElementById\('hybrid_analysis_api_content'\)\.innerHTML = '<p>Keine Anhänge oder URLs für diese E-Mail gefunden\.<\/p>';/,
    `let p1 = document.createElement('p'); p1.textContent = 'Keine Anhänge oder URLs für diese E-Mail gefunden.'; document.getElementById('hybrid_analysis_api_content').appendChild(p1);`
);

// line 99
replaced = replaced.replace(
    /document\.getElementById\('hybrid_analysis_api_content'\)\.innerHTML = '<p>Keine Analyseergebnisse für diese E-Mail vorhanden\.<\/p>';/,
    `let p2 = document.createElement('p'); p2.textContent = 'Keine Analyseergebnisse für diese E-Mail vorhanden.'; document.getElementById('hybrid_analysis_api_content').appendChild(p2);`
);

// line 269
replaced = replaced.replace(
    /document\.getElementById\('hybrid_analysis_api_content'\)\.innerHTML \+= \`<div class="text-danger">API Error: \$\{response\.status\} für Element \$\{escapeHTML\(attachmentName\)\}<\/div>\`;/,
    `let errDiv1 = document.createElement('div'); errDiv1.className = 'text-danger'; errDiv1.textContent = \`API Error: \${response.status} für Element \${attachmentName}\`; document.getElementById('hybrid_analysis_api_content').appendChild(errDiv1);`
);

// line 273
replaced = replaced.replace(
    /document\.getElementById\('hybrid_analysis_api_content'\)\.innerHTML \+= \`<div class="text-danger">Netzwerkfehler: \$\{escapeHTML\(error\.message\)\} für Element \$\{escapeHTML\(attachmentName\)\}<\/div>\`;/,
    `let errDiv2 = document.createElement('div'); errDiv2.className = 'text-danger'; errDiv2.textContent = \`Netzwerkfehler: \${error.message} für Element \${attachmentName}\`; document.getElementById('hybrid_analysis_api_content').appendChild(errDiv2);`
);

fs.writeFileSync('api.js', replaced);
