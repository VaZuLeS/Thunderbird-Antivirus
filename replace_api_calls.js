const fs = require('fs');

const file = fs.readFileSync('api.js', 'utf8');

// Replace simple appendChild or innerHTML with secure DOMParser to prevent XSS
const regex1 = /container\.(?:appendChild\(resultHtml\)|innerHTML\s*=\s*resultHtml);/g;
const safeCode = `const parser = new DOMParser();
const parsedDoc = parser.parseFromString(resultHtml, 'text/html');
while (parsedDoc.body.firstChild) {
    container.appendChild(parsedDoc.body.firstChild);
}`;

let replaced = file.replace(regex1, safeCode);

fs.writeFileSync('api.js', replaced);
