import { describe, it, expect, beforeEach } from 'vitest';
import { syncToR2 } from './sync';
import { 
  createMockEnv, 
  createMockEnvWithR2, 
  createMockProcess, 
  createMockSandbox, 
  suppressConsole 
} from '../test-utils';

describe('syncToR2', () => {
  beforeEach(() => {
    suppressConsole();
  });

  describe('configuration checks', () => {
    it('returns error when R2 is not configured', async () => {
      const { sandbox } = createMockSandbox();
      const env = createMockEnv();

      const result = await syncToR2(sandbox, env);

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 storage is not configured');
    });

    it('returns error when R2_ACCESS_KEY_ID is missing', async () => {
      const { sandbox } = createMockSandbox();
      const env = {
        ...createMockEnv(),
        R2_SECRET_ACCESS_KEY: 'secret',
        CF_ACCOUNT_ID: 'account',
      };

      const result = await syncToR2(sandbox, env);

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 storage is not configured');
    });
  });

  describe('FUSE mount status', () => {
    it('returns success when tigrisfs mount is active', async () => {
      const { sandbox, startProcessMock } = createMockSandbox();
      startProcessMock.mockResolvedValueOnce(
        createMockProcess('tigrisfs on /data/moltbot type fuse.tigrisfs\n')
      );
      
      const env = createMockEnvWithR2();

      const result = await syncToR2(sandbox, env);

      expect(result.success).toBe(true);
      expect(result.lastSync).toBe('live (FUSE mount active)');
      expect(result.details).toContain('FUSE mount');
    });

    it('returns error when FUSE mount is not active', async () => {
      const { sandbox, startProcessMock } = createMockSandbox();
      // grep returns empty when mount not found
      startProcessMock.mockResolvedValueOnce(createMockProcess(''));
      
      const env = createMockEnvWithR2();

      const result = await syncToR2(sandbox, env);

      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 FUSE mount not active');
      expect(result.details).toContain('restart');
    });

    it('returns error when mount check command fails', async () => {
      const { sandbox, startProcessMock } = createMockSandbox();
      startProcessMock.mockRejectedValueOnce(new Error('Command failed'));
      
      const env = createMockEnvWithR2();

      const result = await syncToR2(sandbox, env);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to check mount status');
      expect(result.details).toBe('Command failed');
    });

    it('checks for tigrisfs specifically in mount output', async () => {
      const { sandbox, startProcessMock } = createMockSandbox();
      // Some other mount type, not tigrisfs
      startProcessMock.mockResolvedValueOnce(
        createMockProcess('s3fs on /data/moltbot type fuse.s3fs\n')
      );
      
      const env = createMockEnvWithR2();

      const result = await syncToR2(sandbox, env);

      // s3fs is not tigrisfs, should fail
      expect(result.success).toBe(false);
      expect(result.error).toBe('R2 FUSE mount not active');
    });
  });
});
