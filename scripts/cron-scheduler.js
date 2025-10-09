#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Cron Scheduler Example
 * 
 * This demonstrates how to set up scheduled execution of the auto-settlement cron job.
 * It uses node-cron for scheduling and calls the simple cron script.
 * 
 * Usage:
 * node scripts/cron-scheduler.js
 * 
 * To use as a persistent service, you can:
 * 1. Use pm2: pm2 start scripts/cron-scheduler.js
 * 2. Use systemd service
 * 3. Use Docker with restart policy
 */

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');

// Configuration
const CRON_SCHEDULE = '* * * * *'; // Every minute
const SCRIPT_PATH = path.join(__dirname, 'cron-auto-settle.js');

console.log('[SCHEDULER] 🚀 Starting cron scheduler...');
console.log(`[SCHEDULER] Schedule: ${CRON_SCHEDULE} (every minute)`);
console.log(`[SCHEDULER] Script: ${SCRIPT_PATH}`);

// Schedule the auto-settlement job
const task = cron.schedule(CRON_SCHEDULE, () => {
  console.log(`[SCHEDULER] 🕐 Triggering auto-settlement at ${new Date().toISOString()}`);
  
  const child = spawn('node', [SCRIPT_PATH], {
    stdio: 'inherit'
  });
  
  child.on('close', (code) => {
    if (code === 0) {
      console.log(`[SCHEDULER] ✅ Auto-settlement completed successfully`);
    } else {
      console.error(`[SCHEDULER] ❌ Auto-settlement failed with exit code ${code}`);
    }
  });
  
  child.on('error', (error) => {
    console.error(`[SCHEDULER] ❌ Failed to start auto-settlement:`, error);
  });
}, {
  timezone: "Asia/Shanghai" // User's timezone preference
});

console.log('[SCHEDULER] ✅ Cron scheduler started successfully');
console.log('[SCHEDULER] Press Ctrl+C to stop the scheduler');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[SCHEDULER] 🛑 Stopping cron scheduler...');
  task.stop();
  console.log('[SCHEDULER] ✅ Cron scheduler stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[SCHEDULER] 🛑 Stopping cron scheduler...');
  task.stop();
  console.log('[SCHEDULER] ✅ Cron scheduler stopped');
  process.exit(0);
});