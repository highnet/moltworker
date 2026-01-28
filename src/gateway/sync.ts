import type { Sandbox } from '@cloudflare/sandbox';
import type { MoltbotEnv } from '../types';
import { R2_MOUNT_PATH } from '../config';
import { waitForProcess } from './utils';

export interface SyncResult {
  success: boolean;
  lastSync?: string;
  error?: string;
  details?: string;
}

/**
 * Check R2 FUSE mount status.
 * 
 * With tigrisfs FUSE mount, data is written directly to R2 - no sync needed.
 * This function just checks if the mount is active and reports status.
 * 
 * @param sandbox - The sandbox instance
 * @param env - Worker environment bindings
 * @returns SyncResult with mount status
 */
export async function syncToR2(sandbox: Sandbox, env: MoltbotEnv): Promise<SyncResult> {
  // Check if R2 is configured
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.CF_ACCOUNT_ID) {
    return { success: false, error: 'R2 storage is not configured' };
  }

  // Check if FUSE mount is active
  try {
    const proc = await sandbox.startProcess(`mount | grep "tigrisfs on ${R2_MOUNT_PATH}"`);
    await waitForProcess(proc, 5000);
    const logs = await proc.getLogs();
    
    if (logs.stdout && logs.stdout.includes('tigrisfs')) {
      // Mount is active - data is being persisted directly
      return { 
        success: true, 
        lastSync: 'live (FUSE mount active)',
        details: 'Data is written directly to R2 via FUSE mount'
      };
    } else {
      return { 
        success: false, 
        error: 'R2 FUSE mount not active',
        details: 'The container may need to be restarted to mount R2'
      };
    }
  } catch (err) {
    return { 
      success: false, 
      error: 'Failed to check mount status',
      details: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
