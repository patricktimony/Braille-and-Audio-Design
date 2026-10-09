#!/usr/bin/env node
'use strict';
// Start the Library Access Network prototype:  npm start
const { createServer } = require('./src/app');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1'; // local only by default

createServer().listen(PORT, HOST, () => {
  console.log(`\nLibrary Access Network prototype is running.`);
  console.log(`Open http://localhost:${PORT} in your web browser.`);
  console.log('Demonstration data only. Do not enter real patron information.');
  console.log('Press Ctrl+C to stop.\n');
});
