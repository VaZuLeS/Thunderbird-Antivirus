const fs = require('fs');

const file = fs.readFileSync('api.js', 'utf8');

let replaced = file.replace(/let safeHash/g, 'let safeHash'); // just checking

// Replace safeHash with hash where needed in renderManualUploadUI
replaced = replaced.replace(/btn-cdr-\$\{safeHash\}/g, 'btn-cdr-${hash}');
replaced = replaced.replace(/cdr-status-\$\{safeHash\}/g, 'cdr-status-${hash}');
replaced = replaced.replace(/btn-upload-\$\{safeHash\}/g, 'btn-upload-${hash}');
replaced = replaced.replace(/upload-status-\$\{safeHash\}/g, 'upload-status-${hash}');
replaced = replaced.replace(/upload-container-\$\{safeHash\}/g, 'upload-container-${hash}');

fs.writeFileSync('api.js', replaced);
