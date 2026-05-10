const fs = require('fs');

let content = fs.readFileSync('content_script.js', 'utf8');

// The reviewer mentioned "url === request.url" in background.js might have a problem with trailing slashes,
// so let's fix it there as well.

let bgScript = fs.readFileSync('background.js', 'utf8');
bgScript = bgScript.replace('l.url === request.url', 'l.url.replace(/\\/$/, "") === request.url.replace(/\\/$/, "")');
fs.writeFileSync('background.js', bgScript);
