/**
 * Script to modify a payment channel's duration for testing expired channels functionality
 * Usage: node scripts/modify-channel-duration.js [channel_id] [duration_seconds]
 * Example: node scripts/modify-channel-duration.js channel_3_1759975206007_tg5mao0w97 60
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node scripts/modify-channel-duration.js [channel_id] [duration_seconds]');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/modify-channel-duration.js channel_3_1759975206007_tg5mao0w97 60  # Set to 60 seconds');
  console.log('  node scripts/modify-channel-duration.js channel_3_1759975206007_tg5mao0w97 86400  # Set to 1 day');
  console.log('  node scripts/modify-channel-duration.js list  # List all active channels');
  console.log('');
  process.exit(1);
}

const channelId = args[0];
const durationSeconds = args[1] ? parseInt(args[1]) : 60; // Default to 60 seconds

async function modifyChannelDuration() {
  try {
    console.log('🔄 Loading database...');
    
    // Find the database file
    const dbPath = path.join(process.cwd(), 'database.sqlite');
    
    if (!fs.existsSync(dbPath)) {
      console.error('❌ Database file not found at:', dbPath);
      process.exit(1);
    }
    
    console.log('🔄 Connecting to database...');
    const db = new Database(dbPath);
    
    // Payment channel status constants
    const PAYMENT_CHANNEL_STATUS = {
      INACTIVE: 1,
      ACTIVE: 2,
      INVALID: 3,
      SETTLED: 4,
      EXPIRED: 5
    };
    
    // If user wants to list channels
    if (channelId === 'list') {
      console.log('📋 Listing all active payment channels:');
      console.log('');
      
      const listStmt = db.prepare(`
        SELECT id, channel_id, user_id, amount, duration_days, duration_seconds, status, created_at, verified_at
        FROM payment_channels 
        WHERE status = ?
        ORDER BY created_at DESC
      `);
      
      const activeChannels = listStmt.all(PAYMENT_CHANNEL_STATUS.ACTIVE);
      
      if (activeChannels.length === 0) {
        console.log('   No active payment channels found.');
      } else {
        console.log('   ID  | Channel ID                          | User | Amount | Duration           | Created At');
        console.log('   ----|-------------------------------------|------|--------|--------------------|-----------------');
        
        activeChannels.forEach(channel => {
          const createdAt = new Date(channel.created_at).toLocaleString('en-US', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Format duration based on available data
          let durationStr;
          if (channel.duration_seconds) {
            if (channel.duration_seconds < 60) {
              durationStr = `${channel.duration_seconds}s`;
            } else if (channel.duration_seconds < 3600) {
              durationStr = `${Math.floor(channel.duration_seconds / 60)}m`;
            } else if (channel.duration_seconds < 86400) {
              durationStr = `${Math.floor(channel.duration_seconds / 3600)}h`;
            } else {
              const days = Math.floor(channel.duration_seconds / 86400);
              durationStr = `${days}d`;
            }
          } else {
            durationStr = `${channel.duration_days}d`;
          }
          
          console.log(`   ${channel.id.toString().padEnd(3)} | ${channel.channel_id.padEnd(35)} | ${channel.user_id.toString().padEnd(4)} | ${channel.amount.toString().padEnd(6)} | ${durationStr.padEnd(18)} | ${createdAt}`);
        });
      }
      
      console.log('');
      console.log('💡 To modify a channel duration, use:');
      console.log('   node scripts/modify-channel-duration.js <channel_id> <duration_seconds>');
      
      db.close();
      return;
    }
    
    // Validate duration
    if (isNaN(durationSeconds) || durationSeconds < 1) {
      console.error('❌ Invalid duration. Must be a positive number in seconds.');
      process.exit(1);
    }
    
    // Check if channel exists
    const checkStmt = db.prepare('SELECT * FROM payment_channels WHERE channel_id = ?');
    const existingChannel = checkStmt.get(channelId);
    
    if (!existingChannel) {
      console.error('❌ Payment channel not found:', channelId);
      console.log('');
      console.log('💡 Use "node scripts/modify-channel-duration.js list" to see available channels');
      process.exit(1);
    }
    
    // Show current channel info
    console.log('📋 Current channel information:');
    console.log(`   Channel ID: ${existingChannel.channel_id}`);
    console.log(`   User ID: ${existingChannel.user_id}`);
    console.log(`   Amount: ${existingChannel.amount} CKB`);
    
    // Show duration based on available data
    if (existingChannel.duration_seconds) {
      console.log(`   Current Duration: ${existingChannel.duration_seconds} seconds (${existingChannel.duration_days} days)`);
    } else {
      console.log(`   Current Duration: ${existingChannel.duration_days} days`);
    }
    
    console.log(`   Status: ${existingChannel.status} (${getStatusText(existingChannel.status)})`);
    console.log(`   Created At: ${new Date(existingChannel.created_at).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}`);
    
    // Show verified_at if available
    if (existingChannel.verified_at) {
      console.log(`   Verified At: ${new Date(existingChannel.verified_at).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}`);
    } else {
      console.log(`   Verified At: Not yet verified`);
    }
    
    console.log('');
    
    // Calculate expiration time with new duration
    const createdAt = new Date(existingChannel.created_at);
    const newExpirationTime = new Date(createdAt.getTime() + (durationSeconds * 1000));
    const currentTime = new Date();
    
    console.log('⏰ Time calculation:');
    console.log(`   Created At: ${createdAt.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}`);
    console.log(`   New Duration: ${durationSeconds} second(s)`);
    console.log(`   Will Expire At: ${newExpirationTime.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}`);
    console.log(`   Current Time: ${currentTime.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })}`);
    
    const isAlreadyExpired = newExpirationTime < currentTime;
    console.log(`   Status: ${isAlreadyExpired ? '🔴 Already expired' : '🟢 Will expire in the future'}`);
    console.log('');
    
    // Convert seconds to fractional days for backward compatibility with duration_days
    const durationDays = durationSeconds / (24 * 60 * 60); // Convert seconds to days
    
    // Update the channel duration with both seconds and days
    console.log(`🔄 Updating channel duration to ${durationSeconds} second(s) (${durationDays.toFixed(6)} days)...`);
    
    const updateStmt = db.prepare(`
      UPDATE payment_channels 
      SET duration_days = ?, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE channel_id = ?
    `);
    
    const result = updateStmt.run(durationDays, durationSeconds, channelId);
    
    if (result.changes > 0) {
      console.log('✅ Channel duration updated successfully!');
      console.log('');
      
      if (isAlreadyExpired) {
        console.log('🎯 This channel should now be detected as expired by the check-expired-channels task.');
        console.log('');
        console.log('🔧 To test the expired channels task, run:');
        console.log('   curl -X POST http://localhost:3000/api/admin/check-expired-channels');
        console.log('');
        console.log('📊 Or use the admin interface to execute the task manually:');
        console.log('   http://localhost:3000/admin/tasks');
      } else {
        const waitTime = Math.ceil((newExpirationTime - currentTime) / 1000);
        if (waitTime < 60) {
          console.log(`⏳ Channel will expire in approximately ${waitTime} second(s).`);
        } else if (waitTime < 3600) {
          console.log(`⏳ Channel will expire in approximately ${Math.ceil(waitTime / 60)} minute(s).`);
        } else {
          console.log(`⏳ Channel will expire in approximately ${Math.ceil(waitTime / 3600)} hour(s).`);
        }
        console.log('   Wait for the expiration time to pass, then test the task.');
      }
    } else {
      console.error('❌ Failed to update channel duration');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function getStatusText(status) {
  const statusMap = {
    1: 'Inactive',
    2: 'Active', 
    3: 'Invalid',
    4: 'Settled',
    5: 'Expired'
  };
  return statusMap[status] || 'Unknown';
}

// Run the script
modifyChannelDuration();