#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Simple Cron Job Script
 * 
 * This script calls dedicated API endpoints for automated tasks.
 * It keeps the cron logic minimal and delegates actual work to server APIs.
 * 
 * Usage:
 * node scripts/cron-auto-settle.js
 */

const http = require('http');
const https = require('https');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_ENDPOINT = '/api/admin/auto-settle-expiring';

/**
 * Make HTTP request to the auto-settlement API
 */
async function callAutoSettleAPI() {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE_URL}${API_ENDPOINT}`;
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    
    console.log(`[CRON] 🚀 Calling auto-settlement API: ${url}`);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CronJob/1.0'
      }
    };

    const req = client.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log(`[CRON] ✅ API call successful:`, {
              settledCount: response.settledCount,
              checkedCount: response.checkedCount,
              timestamp: response.timestamp
            });
            
            if (response.results && response.results.length > 0) {
              console.log(`[CRON] 📊 Settlement results:`);
              response.results.forEach(result => {
                const status = result.status === 'settled' ? '✅' : 
                             result.status === 'failed' ? '⚠️' : '❌';
                console.log(`  ${status} Channel ${result.channelId}: ${result.status}`);
                if (result.txHash) {
                  console.log(`    📝 TxHash: ${result.txHash}`);
                }
                if (result.error) {
                  console.log(`    ❌ Error: ${result.error}`);
                }
              });
            }
            
            resolve(response);
          } else {
            console.error(`[CRON] ❌ API call failed with status ${res.statusCode}:`, response);
            reject(new Error(`API returned ${res.statusCode}: ${response.error || 'Unknown error'}`));
          }
        } catch (error) {
          console.error(`[CRON] ❌ Failed to parse API response:`, error);
          console.error(`[CRON] Raw response:`, data);
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`[CRON] ❌ HTTP request failed:`, error);
      reject(error);
    });
    
    // Set timeout
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Main execution function
 */
async function main() {
  const startTime = new Date();
  console.log(`[CRON] 🕐 Starting auto-settlement cron job at ${startTime.toISOString()}`);
  
  try {
    await callAutoSettleAPI();
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    console.log(`[CRON] 🎯 Cron job completed successfully in ${duration}ms`);
    
  } catch (error) {
    console.error(`[CRON] ❌ Cron job failed:`, error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error(`[CRON] ❌ Unexpected error:`, error);
    process.exit(1);
  });
}

module.exports = { callAutoSettleAPI };