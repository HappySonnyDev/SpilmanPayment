#!/usr/bin/env node

/**
 * Script to clear all data from payment_channels table while keeping the table structure
 * Usage: npm run clear-channels
 * Or: node scripts/clear-payment-channels.js
 */

async function clearPaymentChannels() {
  try {
    console.log('🔄 Loading database...');
    
    // Use better-sqlite3 directly to avoid TypeScript import issues
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    
    // Find the database file
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database file not found at:', dbPath);
      process.exit(1);
    }
    
    console.log('🔄 Connecting to database...');
    const db = new Database(dbPath);
    
    // Get current count before deletion
    const beforeCountStmt = db.prepare('SELECT COUNT(*) as count FROM payment_channels');
    const beforeCount = beforeCountStmt.get();
    console.log(`📊 Current records in payment_channels: ${beforeCount.count}`);
    
    if (beforeCount.count === 0) {
      console.log('✅ Table is already empty, nothing to delete');
      db.close();
      return;
    }
    
    // Show confirmation info
    console.log('⚠️  This will delete ALL payment channel data!');
    console.log('   Table structure will be preserved');
    
    // Execute DELETE statement
    const deleteStmt = db.prepare('DELETE FROM payment_channels');
    const result = deleteStmt.run();
    
    console.log(`✅ Successfully cleared ${result.changes} records from payment_channels table`);
    
    // Verify table is empty
    const afterCountStmt = db.prepare('SELECT COUNT(*) as count FROM payment_channels');
    const afterCount = afterCountStmt.get();
    console.log(`🔍 Records remaining: ${afterCount.count}`);
    
    // Show table structure is preserved
    const tableInfoStmt = db.prepare('PRAGMA table_info(payment_channels)');
    const columns = tableInfoStmt.all();
    console.log('📋 Table structure preserved:');
    columns.forEach(col => {
      console.log(`   - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.pk ? ' PRIMARY KEY' : ''}`);
    });
    
    console.log('🎉 Operation completed successfully!');
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error clearing payment_channels table:', error);
    process.exit(1);
  }
}

// Run the script
clearPaymentChannels();