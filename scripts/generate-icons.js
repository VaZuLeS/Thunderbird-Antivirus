#!/usr/bin/env node
/**
 * Generates the add-on icons reproducibly (no external dependencies).
 *
 * Usage: node scripts/generate-icons.js
 *
 * Draws a shield with an exclamation mark - the visual language of the add-on
 * ("attachment/link scanner") - and writes PNG files for the sizes referenced in
 * manifest.json. Rendering is done with 4x supersampling for smooth edges.
 *
 * Since 1.7 it additionally renders the threat-level indicator set
 * (img/levels/level-<level>-<size>px.png) that background.js uses for the
 * message_display_action icon: green shield with a check for a harmless message,
 * amber/orange/red shields with an exclamation mark for rising risk. The
 * palettes are duplicated nowhere else, so the toolbar indicator, the banners and
 * the popup stay visually consistent (see docs/plan_1.7_threat_indicator_link_gate.md).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZES = [16, 32, 48, 64, 128];
const LEVEL_SIZES = [16, 32, 64];
const LEVELS = ['clean', 'low', 'medium', 'high', 'critical'];
const SUPERSAMPLE = 4;

const SHIELD_POLYGON = [
  [0.5, 0.03],
  [0.94, 0.16],
  [0.94, 0.5],
  [0.5, 0.97],
  [0.06, 0.5],
  [0.06, 0.16]
];
const SHIELD_FILL = [11, 95, 165, 255];
const SHIELD_EDGE = [7, 61, 107, 255];
const MARK_FILL = [255, 255, 255, 255];

// Threat-level palettes: [fill, edge, mark shape]
const LEVEL_PALETTES = {
  clean: { fill: [34, 139, 34, 255], edge: [20, 92, 20, 255], mark: 'check' },
  low: { fill: [142, 190, 45, 255], edge: [92, 126, 26, 255], mark: 'check' },
  medium: { fill: [240, 165, 0, 255], edge: [163, 111, 0, 255], mark: 'exclamation' },
  high: { fill: [232, 98, 12, 255], edge: [158, 62, 4, 255], mark: 'exclamation' },
  critical: { fill: [200, 30, 30, 255], edge: [132, 16, 16, 255], mark: 'exclamation' }
};

const DEFAULT_PALETTE = { fill: SHIELD_FILL, edge: SHIELD_EDGE, mark: 'exclamation' };

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToPolygonEdge(x, y, polygon) {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x1, y1] = polygon[j];
    const [x2, y2] = polygon[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    let t = lengthSquared === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function isExclamationMark(x, y) {
  const bar = x > 0.45 && x < 0.555 && y > 0.28 && y < 0.62;
  const dot = Math.hypot(x - 0.502, y - 0.75) < 0.062 && y > 0.66;
  return bar || dot;
}

function isCheckMark(x, y) {
  const thickness = 0.055;
  return distanceToSegment(x, y, 0.28, 0.53, 0.44, 0.70) < thickness ||
    distanceToSegment(x, y, 0.44, 0.70, 0.74, 0.31) < thickness;
}

function sampleColor(x, y, palette) {
  const colors = palette || DEFAULT_PALETTE;
  const inShield = pointInPolygon(x, y, SHIELD_POLYGON);
  if (!inShield) return [0, 0, 0, 0];

  const edgeDistance = distanceToPolygonEdge(x, y, SHIELD_POLYGON);
  const edgeWidth = 0.035;

  // Risk mark: exclamation mark (attention) or check (harmless).
  const hasMark = colors.mark === 'check' ? isCheckMark(x, y) : isExclamationMark(x, y);
  if (hasMark) return MARK_FILL;

  return edgeDistance < edgeWidth ? colors.edge : colors.fill;
}

function renderIcon(size, palette) {
  const colors = palette || DEFAULT_PALETTE;
  const big = size * SUPERSAMPLE;
  const data = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px * SUPERSAMPLE + sx + 0.5) / big;
          const y = (py * SUPERSAMPLE + sy + 0.5) / big;
          const [cr, cg, cb, ca] = sampleColor(x, y, colors);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const alpha = a / samples;
      const offset = (py * size + px) * 4;
      if (alpha === 0) {
        data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0; data[offset + 3] = 0;
      } else {
        data[offset] = Math.round(r / a);
        data[offset + 1] = Math.round(g / a);
        data[offset + 2] = Math.round(b / a);
        data[offset + 3] = Math.round(alpha);
      }
    }
  }
  return data;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, payload])), 0);
  return Buffer.concat([length, typeBuffer, payload, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter type 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function writeIcon(targetDir, name, size, palette) {
  const png = encodePng(size, renderIcon(size, palette));
  const target = path.join(targetDir, name);
  fs.writeFileSync(target, png);
  console.log('wrote ' + path.relative(process.cwd(), target) + ' (' + png.length + ' bytes)');
}

function main() {
  const targetDir = path.resolve(__dirname, '..', 'img');
  fs.mkdirSync(targetDir, { recursive: true });
  for (const size of SIZES) {
    writeIcon(targetDir, `icon-${size}px.png`, size, DEFAULT_PALETTE);
  }

  // Threat-level indicator set for the message_display_action icon (1.7).
  const levelDir = path.join(targetDir, 'levels');
  fs.mkdirSync(levelDir, { recursive: true });
  for (const level of LEVELS) {
    for (const size of LEVEL_SIZES) {
      writeIcon(levelDir, `level-${level}-${size}px.png`, size, LEVEL_PALETTES[level]);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { renderIcon, encodePng, SIZES, LEVELS, LEVEL_SIZES, LEVEL_PALETTES, DEFAULT_PALETTE };
