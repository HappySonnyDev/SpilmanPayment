/**
 * Deployment configurations
 * These files are automatically copied from contracts package during build
 * 
 * Usage:
 * import { systemScripts, scripts } from 'shared/deployment';
 */

// Re-export deployment configurations
// These will be available after running: pnpm build:contracts
export { default as systemScripts } from './system-scripts.json';
export { default as scripts } from './scripts.json';
