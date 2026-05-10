const fs = require('fs');

// 1. Remove escapeHTML from content_script.js
let contentScript = fs.readFileSync('content_script.js', 'utf8');
contentScript = contentScript.replace(/function escapeHTML\(str\) \{[\s\S]*?\}\n\n/m, '');
fs.writeFileSync('content_script.js', contentScript);
console.log('Fixed content_script.js');

// 2. Fix sender.tab.id in background.js
let bgScript = fs.readFileSync('background.js', 'utf8');
bgScript = bgScript.replace(
    'browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {\n            if (tabs.length > 0) {\n                return browser.messageDisplay.getDisplayedMessage(tabs[0].id);\n            }\n            throw new Error("No active tab");\n        })',
    'browser.messageDisplay.getDisplayedMessage(sender.tab.id)'
);
fs.writeFileSync('background.js', bgScript);
console.log('Fixed background.js');
