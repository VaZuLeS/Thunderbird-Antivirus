/**
 * Shared screenshot inventory for the store-readiness checks.
 *
 * Single source of truth for "which real PNG/JPEG screenshots exist in
 * docs/screenshots/ and how wide are they" — used by the pre-submit checks and
 * by the Submission-Gate (criterion C5) so both report the same numbers
 * (finding M2 of PROBLEMANALYSE_STORE_READINESS_1_23_0.md).
 *
 * The scan is recursive: real captures live in versioned subdirectories
 * (e.g. docs/screenshots/thunderbird-linux/), which a top-level-only scan
 * would miss (finding B3 of the same analysis).
 */
const fs = require('fs');
const path = require('path');

/**
 * Minimum width (in pixels) a real capture must have to count as a store
 * listing screenshot. Mirrors the documented rule in docs/STATUS.md
 * ("PNG, >= 1200 px breit"); 1280 x 800 is the recommended size.
 */
const MIN_LISTING_WIDTH = 1200;

function pngWidth(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return buffer.readUInt32BE(16);
}

function jpegWidth(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const isStandalone = marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9);
    if (isStandalone) {
      offset += 2;
      continue;
    }
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      if (offset + 9 > buffer.length) return null;
      return buffer.readUInt16BE(offset + 7);
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/** Width in pixels, or null when unknown/not an image we can parse. */
function imageWidth(filePath) {
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return pngWidth(buffer);
  if (extension === '.jpg' || extension === '.jpeg') return jpegWidth(buffer);
  return null;
}

/**
 * Recursively collects every PNG/JPEG below docs/screenshots/.
 * Returns a sorted list of { name, width } with repository-relative names
 * ("thunderbird-linux/native-popup.png"). width is null for unparsable files.
 */
function collectScreenshots(rootDir) {
  const dir = path.join(rootDir, 'docs', 'screenshots');
  const result = [];
  if (!fs.existsSync(dir)) return result;
  const walk = (current, relative) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const name = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        walk(absolute, name);
      } else if (/\.(png|jpe?g)$/i.test(entry.name)) {
        result.push({ name, width: imageWidth(absolute) });
      }
    }
  };
  walk(dir, '');
  return result;
}

module.exports = { collectScreenshots, imageWidth, MIN_LISTING_WIDTH };