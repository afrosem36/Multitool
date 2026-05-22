/**
 * Auto-install guard for whatsapp-service.
 * Runs `npm install` inside this directory if node_modules is missing,
 * then hands off to server.js. This lets `npm run dev` work out-of-the-box
 * without a separate setup step.
 *
 * NOTE: First run downloads Puppeteer/Chromium (~130 MB). This is normal
 * and only happens once. Subsequent starts are instant.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const dir          = __dirname;
const nodeModules  = path.join(dir, 'node_modules');
const waWebJsEntry = path.join(nodeModules, 'whatsapp-web.js');

const LINE = '─'.repeat(60);

if (!fs.existsSync(nodeModules) || !fs.existsSync(waWebJsEntry)) {
  console.log(`\n${LINE}`);
  console.log(' WhatsApp Service — First-time setup');
  console.log(LINE);
  console.log(' Installing dependencies (includes Puppeteer/Chromium ~130 MB)');
  console.log(' This only happens once. Please wait…');
  console.log(`${LINE}\n`);

  try {
    execSync('npm install', { cwd: dir, stdio: 'inherit' });
    console.log(`\n${LINE}`);
    console.log(' ✓  Dependencies installed successfully!');
    console.log(' ✓  Starting WhatsApp service…');
    console.log(`${LINE}\n`);
  } catch (err) {
    console.error(`\n${LINE}`);
    console.error(' ✗  npm install failed:', err.message);
    console.error(' →  Fix the error above, then re-run: npm run dev');
    console.error(`${LINE}\n`);
    process.exit(1);
  }
} else {
  console.log('[whatsapp-service] Dependencies OK — starting server…');
}

require('./src/server');
