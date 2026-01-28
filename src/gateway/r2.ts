import type { Sandbox } from '@cloudflare/sandbox';
import type { MoltbotEnv } from '../types';
import { R2_MOUNT_PATH } from '../config';

/**
 * Check if R2 is mounted via tigrisfs FUSE
 * 
 * With the FUSE approach, R2 is mounted by the container startup script.
 * This function just checks if the mount is active.
 */
export async function isR2Mounted(sandbox: Sandbox): Promise<boolean> {
  try {
    const proc = await sandbox.startProcess(`mount | grep "tigrisfs on ${R2_MOUNT_PATH}"`);
    // Wait for the command to complete
    let attempts = 0;
    while (proc.status === 'running' && attempts < 10) {
      await new Promise(r => setTimeout(r, 200));
      attempts++;
    }
    const logs = await proc.getLogs();
    // If stdout has content, the mount exists
    const mounted = !!(logs.stdout && logs.stdout.includes('tigrisfs'));
    console.log('isR2Mounted check:', mounted, 'stdout:', logs.stdout?.slice(0, 100));
    return mounted;
  } catch (err) {
    console.log('isR2Mounted error:', err);
    return false;
  }
}

/**
 * Check R2 storage configuration and mount status
 * 
 * With FUSE approach, the container mounts R2 at startup via tigrisfs.
 * The Worker passes credentials as environment variables to the container.
 * 
 * @param sandbox - The sandbox instance
 * @param env - Worker environment bindings
 * @returns true if R2 is configured and mounted, false otherwise
 */
export async function mountR2Storage(sandbox: Sandbox, env: MoltbotEnv): Promise<boolean> {
  // Skip if R2 credentials are not configured
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.CF_ACCOUNT_ID) {
    console.log('R2 storage not configured (missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or CF_ACCOUNT_ID)');
    return false;
  }

  // Check if mounted - with FUSE approach, container handles mounting
  const mounted = await isR2Mounted(sandbox);
  if (mounted) {
    console.log('R2 FUSE mount active at', R2_MOUNT_PATH);
    return true;
  }

  // Not mounted - this is expected if container just started
  // The container startup script will mount it
  console.log('R2 FUSE mount not yet active - container may be starting');
  return false;
}
