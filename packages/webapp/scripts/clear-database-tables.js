#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Flexible script to clear data from database tables while keeping table structure
 * 
 * Supported tables:
 * - payment_channels: Payment channel records
 * - chunk_payments: Chunk payment tracking records  
 * - users: User accounts (use with caution)
 * - sessions: User session data
 * - all: Clear all supported tables
 * 
 * Usage examples:
 * npm run clear-tables chunk_payments
 * npm run clear-tables payment_channels
 * npm run clear-tables users,sessions  
 * npm run clear-tables all
 * node scripts/clear-database-tables.js chunk_payments
 * node scripts/clear-database-tables.js payment_channels,chunk_payments
 */

const SUPPORTED_TABLES = {
  'payment_channels': {
    description: 'Payment channel records',
    warning: 'This will delete all payment channel data!'
  },
  'chunk_payments': {
    description: 'Chunk payment tracking records',
    warning: 'This will delete all chunk payment tracking data!'
  },
  'users': {
    description: 'User accounts',
    warning: '⚠️  DANGER: This will delete all user accounts and related data!'
  },
  'sessions': {
    description: 'User session data', 
    warning: 'This will delete all active user sessions!'
  }
};

async function clearDatabaseTables(tablesToClear) {
  try {
    console.log('🔄 Loading database...');
    
    // Use better-sqlite3 directly to avoid TypeScript import issues
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    
    // Find the database file
    // In monorepo: database is in packages/webapp/
    // Script location: packages/webapp/scripts/clear-database-tables.js
    const scriptDir = __dirname; // packages/webapp/scripts
    const webappDir = path.dirname(scriptDir); // packages/webapp
    const dbPath = path.join(webappDir, 'database.sqlite');
    const resolvedDbPath = path.resolve(dbPath);
    
    if (!fs.existsSync(resolvedDbPath)) {
      console.error('❌ Database file not found at:', resolvedDbPath);
      console.log('💡 Expected location: packages/webapp/database.sqlite');
      process.exit(1);
    }
    
    console.log('📂 Database location:', resolvedDbPath);
    console.log('🔄 Connecting to database...');
    const db = new Database(resolvedDbPath);
    
    // Validate and process table list
    const tables = tablesToClear.includes('all') 
      ? Object.keys(SUPPORTED_TABLES)
      : tablesToClear;
    
    const invalidTables = tables.filter(table => !SUPPORTED_TABLES[table]);
    if (invalidTables.length > 0) {
      console.error('❌ Unsupported tables:', invalidTables.join(', '));
      console.log('✅ Supported tables:', Object.keys(SUPPORTED_TABLES).join(', '));
      process.exit(1);
    }
    
    // Show what will be cleared
    console.log('📋 Tables to be cleared:');
    tables.forEach(table => {
      console.log(`   - ${table}: ${SUPPORTED_TABLES[table].description}`);
    });
    console.log('');
    
    // Show warnings
    tables.forEach(table => {
      console.log(`⚠️  ${SUPPORTED_TABLES[table].warning}`);
    });
    console.log('   Table structures will be preserved');
    console.log('');
    
    // Process each table
    const results = {};
    
    for (const table of tables) {
      try {
        // Get current count before deletion
        const beforeCountStmt = db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        const beforeCount = beforeCountStmt.get();
        console.log(`📊 Current records in ${table}: ${beforeCount.count}`);
        
        if (beforeCount.count === 0) {
          console.log(`✅ Table ${table} is already empty, skipping`);
          results[table] = { cleared: 0, skipped: true };
          continue;
        }
        
        // Execute DELETE statement
        const deleteStmt = db.prepare(`DELETE FROM ${table}`);
        const result = deleteStmt.run();
        
        console.log(`✅ Successfully cleared ${result.changes} records from ${table} table`);
        
        // Verify table is empty
        const afterCountStmt = db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        const afterCount = afterCountStmt.get();
        
        if (afterCount.count > 0) {
          console.warn(`⚠️  Warning: ${afterCount.count} records remaining in ${table}`);
        }
        
        results[table] = { 
          cleared: result.changes, 
          remaining: afterCount.count,
          skipped: false
        };
        
      } catch (error) {
        console.error(`❌ Error clearing table ${table}:`, error.message);
        results[table] = { error: error.message };
      }
    }
    
    // Show summary
    console.log('\\n📊 Summary:');
    Object.entries(results).forEach(([table, result]) => {
      if (result.error) {
        console.log(`   ${table}: ❌ Error - ${result.error}`);
      } else if (result.skipped) {
        console.log(`   ${table}: ⏭️  Skipped (already empty)`);
      } else {
        console.log(`   ${table}: ✅ Cleared ${result.cleared} records`);
      }
    });
    
    // Show table structures are preserved for cleared tables
    const clearedTables = Object.entries(results)
      .filter(([, result]) => !result.error && !result.skipped)
      .map(([table]) => table);
      
    if (clearedTables.length > 0) {
      console.log('\\n📋 Table structures preserved:');
      clearedTables.forEach(table => {
        try {
          const tableInfoStmt = db.prepare(`PRAGMA table_info(${table})`);
          const columns = tableInfoStmt.all();
          console.log(`\\n   ${table}:`);
          columns.forEach(col => {
            const nullable = col.notnull ? ' NOT NULL' : '';
            const primaryKey = col.pk ? ' PRIMARY KEY' : '';
            console.log(`     - ${col.name}: ${col.type}${nullable}${primaryKey}`);
          });
        } catch (error) {
          console.log(`     Error getting structure: ${error.message}`);
        }
      });
    }
    
    console.log('\\n🎉 Operation completed successfully!');
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error in clear operation:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArguments() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('📖 Usage: node scripts/clear-database-tables.js <table_names>');
    console.log('');
    console.log('Available tables:');
    Object.entries(SUPPORTED_TABLES).forEach(([table, info]) => {
      console.log(`   ${table} - ${info.description}`);
    });
    console.log('   all - Clear all supported tables');
    console.log('');
    console.log('Examples:');
    console.log('   node scripts/clear-database-tables.js chunk_payments');
    console.log('   node scripts/clear-database-tables.js payment_channels,chunk_payments');
    console.log('   node scripts/clear-database-tables.js all');
    process.exit(0);
  }
  
  const tablesToClear = args[0].split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  if (tablesToClear.length === 0) {
    console.error('❌ No valid table names provided');
    process.exit(1);
  }
  
  return tablesToClear;
}

// Run the script
const tablesToClear = parseArguments();
clearDatabaseTables(tablesToClear);