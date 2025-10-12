import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

// Enable plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

/**
 * Convert UTC datetime string from database to Asia/Shanghai timezone
 * @param dbTime - UTC datetime string from database (e.g., "2025-10-12 15:52:38")
 * @param format - Output format string (default: "YYYY-MM-DD HH:mm:ss")
 * @returns Formatted datetime string in Asia/Shanghai timezone
 */
export function formatDbTimeToLocal(dbTime: string | null, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!dbTime) return '';
  
  // Parse UTC time and convert to Asia/Shanghai timezone
  const utcTime = dayjs.utc(dbTime);
  const localTime = utcTime.tz('Asia/Shanghai');
  
  return localTime.format(format);
}

/**
 * Convert UTC datetime string to relative time (e.g., "2 hours ago") in Asia/Shanghai timezone
 * @param dbTime - UTC datetime string from database
 * @returns Relative time string in Asia/Shanghai timezone
 */
export function formatDbTimeToRelative(dbTime: string | null): string {
  if (!dbTime) return '';
  
  const utcTime = dayjs.utc(dbTime);
  const localTime = utcTime.tz('Asia/Shanghai');
  
  return localTime.fromNow();
}

/**
 * Calculate days remaining from verified_at + duration_days in Asia/Shanghai timezone
 * @param verifiedAt - UTC datetime string when channel was verified
 * @param durationDays - Channel duration in days
 * @returns Days remaining (negative if expired)
 */
export function calculateDaysRemaining(verifiedAt: string | null, durationDays: number): number {
  if (!verifiedAt) return 0;
  
  const utcVerifiedTime = dayjs.utc(verifiedAt);
  const localVerifiedTime = utcVerifiedTime.tz('Asia/Shanghai');
  const expirationTime = localVerifiedTime.add(durationDays, 'day');
  const now = dayjs().tz('Asia/Shanghai');
  
  return expirationTime.diff(now, 'day');
}

/**
 * Check if a channel has expired based on verified_at + duration_days
 * @param verifiedAt - UTC datetime string when channel was verified
 * @param durationDays - Channel duration in days
 * @returns True if expired, false otherwise
 */
export function isChannelExpired(verifiedAt: string | null, durationDays: number): boolean {
  return calculateDaysRemaining(verifiedAt, durationDays) < 0;
}