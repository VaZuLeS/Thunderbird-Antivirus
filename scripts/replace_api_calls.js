const fs = require('fs');

const file = fs.readFileSync('api.js', 'utf8');

// Replace the DOMParser stuff with simple appendChild
const regex1 = /const parser = new DOMParser\(\);\s*const parsedDoc = parser\.parseFromString\(resultHtml, 'text\/html'\);\s*while \(parsedDoc\.body\.firstChild\) \{\s*container\.appendChild\(parsedDoc\.body\.firstChild\);\s*\}/g;

let replaced = file.replace(regex1, 'container.appendChild(resultHtml);');

fs.writeFileSync('api.js', replaced);
