/**
 * Shared utility functions
 */

/**
 * Format CKB amount from Shannon to CKB
 */
export function formatCKB(shannon: number | bigint): string {
  const ckb = Number(shannon) / 100000000;
  return ckb.toFixed(2);
}

/**
 * Parse CKB amount from CKB to Shannon
 */
export function parseCKB(ckb: number): bigint {
  return BigInt(Math.floor(ckb * 100000000));
}

/**
 * Validate hex string
 */
export function isValidHex(hex: string): boolean {
  return /^(0x)?[0-9a-fA-F]+$/.test(hex);
}

/**
 * Ensure hex string has 0x prefix
 */
export function ensureHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex : `0x${hex}`;
}

/**
 * Remove 0x prefix from hex string
 */
export function removeHexPrefix(hex: string): string {
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}
