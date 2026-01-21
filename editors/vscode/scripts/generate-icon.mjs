#!/usr/bin/env node
/**
 * Generate IceType VS Code extension icon
 * Creates a 128x128 PNG icon with an ice crystal design
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Try to find sharp from the monorepo (pnpm structure)
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  // Try from pnpm node_modules structure
  const sharpPath = resolve(__dirname, '../../../node_modules/.pnpm/sharp@0.34.5/node_modules/sharp');
  sharp = require(sharpPath);
}

const SIZE = 128;

// Create SVG with ice crystal design
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 128 128">
  <defs>
    <!-- Ice crystal gradient -->
    <linearGradient id="iceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#56d4dd;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#79c0ff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#a5d6ff;stop-opacity:1" />
    </linearGradient>
    <!-- Background gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0d1117;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#161b22;stop-opacity:1" />
    </linearGradient>
    <!-- Glow effect -->
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="128" height="128" rx="20" fill="url(#bgGrad)"/>

  <!-- Ice crystal - hexagonal snowflake design -->
  <g transform="translate(64, 64)" filter="url(#glow)">
    <!-- Main crystal arms -->
    <g stroke="url(#iceGrad)" stroke-width="3" stroke-linecap="round" fill="none">
      <!-- Vertical arm -->
      <line x1="0" y1="-42" x2="0" y2="42"/>
      <!-- Top branches -->
      <line x1="0" y1="-42" x2="-12" y2="-30"/>
      <line x1="0" y1="-42" x2="12" y2="-30"/>
      <line x1="0" y1="-25" x2="-8" y2="-17"/>
      <line x1="0" y1="-25" x2="8" y2="-17"/>
      <!-- Bottom branches -->
      <line x1="0" y1="42" x2="-12" y2="30"/>
      <line x1="0" y1="42" x2="12" y2="30"/>
      <line x1="0" y1="25" x2="-8" y2="17"/>
      <line x1="0" y1="25" x2="8" y2="17"/>

      <!-- Diagonal arm 1 (top-right to bottom-left) -->
      <line x1="36" y1="-21" x2="-36" y2="21"/>
      <!-- Branches -->
      <line x1="36" y1="-21" x2="24" y2="-30"/>
      <line x1="36" y1="-21" x2="33" y2="-8"/>
      <line x1="21" y1="-12" x2="14" y2="-18"/>
      <line x1="21" y1="-12" x2="20" y2="-3"/>
      <line x1="-36" y1="21" x2="-24" y2="30"/>
      <line x1="-36" y1="21" x2="-33" y2="8"/>
      <line x1="-21" y1="12" x2="-14" y2="18"/>
      <line x1="-21" y1="12" x2="-20" y2="3"/>

      <!-- Diagonal arm 2 (top-left to bottom-right) -->
      <line x1="-36" y1="-21" x2="36" y2="21"/>
      <!-- Branches -->
      <line x1="-36" y1="-21" x2="-24" y2="-30"/>
      <line x1="-36" y1="-21" x2="-33" y2="-8"/>
      <line x1="-21" y1="-12" x2="-14" y2="-18"/>
      <line x1="-21" y1="-12" x2="-20" y2="-3"/>
      <line x1="36" y1="21" x2="24" y2="30"/>
      <line x1="36" y1="21" x2="33" y2="8"/>
      <line x1="21" y1="12" x2="14" y2="18"/>
      <line x1="21" y1="12" x2="20" y2="3"/>
    </g>

    <!-- Center hexagon -->
    <polygon points="0,-12 10,-6 10,6 0,12 -10,6 -10,-6"
             fill="url(#iceGrad)" opacity="0.8"/>

    <!-- Small decorative dots at tips -->
    <g fill="url(#iceGrad)">
      <circle cx="0" cy="-42" r="3"/>
      <circle cx="0" cy="42" r="3"/>
      <circle cx="36" cy="-21" r="3"/>
      <circle cx="-36" cy="21" r="3"/>
      <circle cx="-36" cy="-21" r="3"/>
      <circle cx="36" cy="21" r="3"/>
    </g>
  </g>
</svg>
`;

const outputPath = new URL('../images/icon.png', import.meta.url).pathname;

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log(`Icon generated successfully at ${outputPath}`);
  })
  .catch(err => {
    console.error('Error generating icon:', err);
    process.exit(1);
  });
