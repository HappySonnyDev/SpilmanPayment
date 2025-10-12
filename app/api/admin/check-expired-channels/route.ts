import { NextRequest, NextResponse } from 'next/server';
import { PaymentChannelRepository, ScheduledTaskLogRepository, PAYMENT_CHANNEL_STATUS } from '@/lib/server/database';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const taskLogRepo = new ScheduledTaskLogRepository();
  
  try {
    console.log('Starting expired channels check...');
    
    const paymentChannelRepo = new PaymentChannelRepository();
    
    // Get all expired active channels
    const expiredChannels = paymentChannelRepo.getExpiredActiveChannels();
    console.log(`Found ${expiredChannels.length} expired active channels`);
    
    let expiredCount = 0;
    
    if (expiredChannels.length > 0) {
      // Extract channel IDs for batch processing
      const channelIds = expiredChannels.map(channel => channel.channel_id);
      
      // Batch expire all channels
      expiredCount = paymentChannelRepo.expirePaymentChannels(channelIds);
      console.log(`Successfully expired ${expiredCount} channels`);
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log the task execution
    const taskLog = taskLogRepo.createTaskLog({
      task_name: 'check-expired-channels',
      task_type: 'scheduled',
      execution_status: 'success',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      duration_ms: duration,
      result_data: JSON.stringify({
        checked_count: expiredChannels.length,
        expired_count: expiredCount,
        expired_channel_ids: expiredChannels.map(c => c.channel_id)
      }),
      checked_count: expiredChannels.length,
      settled_count: expiredCount
    });

    return NextResponse.json({
      success: true,
      message: `Checked ${expiredChannels.length} channels, expired ${expiredCount} channels`,
      data: {
        checked_count: expiredChannels.length,
        expired_count: expiredCount,
        expired_channels: expiredChannels.map(channel => ({
          id: channel.id,
          channel_id: channel.channel_id,
          user_id: channel.user_id,
          duration_days: channel.duration_days,
          created_at: channel.created_at
        })),
        execution_time_ms: duration,
        task_log_id: taskLog.id
      }
    });

  } catch (error) {
    console.error('Error checking expired channels:', error);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Log the error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    taskLogRepo.createTaskLog({
      task_name: 'check-expired-channels',
      task_type: 'scheduled',
      execution_status: 'error',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date(endTime).toISOString(),
      duration_ms: duration,
      error_message: errorMessage,
      checked_count: 0,
      settled_count: 0
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check expired channels',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}