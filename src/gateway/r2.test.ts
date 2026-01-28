import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountR2Storage, isR2Mounted } from './r2';
import { 
  createMockEnv, 
  createMockEnvWithR2, 
  createMockProcess, 
  createMockSandbox, 
  suppressConsole 
} from '../test-utils';

describe('mountR2Storage', () => {
  beforeEach(() => {
    suppressConsole();
  });

  describe('credential validation', () => {
    it('returns false when R2_ACCESS_KEY_ID is missing', async () => {
      const { sandbox } = createMockSandbox();
      const env = createMockEnv({
        R2_SECRET_ACCESS_KEY: 'secret',
        CF_ACCOUNT_ID: 'account123',
      });

      const result = await mountR2Storage(sandbox, env);

      expect(result).toBe(false);
    });

    it('returns false when R2_SECRET_ACCESS_KEY is missing', async () => {
      const { sandbox } = createMockSandbox();
      const env = createMockEnv({
        R2_ACCESS_KEY_ID: 'key123',
        CF_ACCOUNT_ID: 'account123',
      });

      const result = await mountR2Storage(sandbox, env);

      expect(result).toBe(false);
    });

    it('returns false when CF_ACCOUNT_ID is missing', async () => {
      const { sandbox } = createMockSandbox();
      const env = createMockEnv({
        R2_ACCESS_KEY_ID: 'key123',
        R2_SECRET_ACCESS_KEY: 'secret',
      });

      const result = await mountR2Storage(sandbox, env);

      expect(result).toBe(false);
    });

    it('returns false when all R2 credentials are missing', async () => {
      const { sandbox } = createMockSandbox();
      const env = createMockEnv();

      const result = await mountR2Storage(sandbox, env);

      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('R2 storage not configured')
      );
    });
  });

  describe('FUSE mount status checks', () => {
    it('returns true when tigrisfs mount is detected', async () => {
      const { sandbox, startProcessMock } = createMockSandbox();
      startProcessMock.mockResolvedValue(
        createMockProcess('tigrisfs on /data/moltbot type fuse (rw,nosuid,nodev)\n')
      );
      const env = createMockEnvWithR2();

      const result = await mountR2Storage(sandbox, env);

      expect(result).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        'R2 FUSE mount active at',
        '/data/moltbot'
      );
    });

    it('returns false when tigrisfs mount is not detected', async () => {
      const { sandbox, startProcessMock } = createMockSandbox();
      startProcessMock.mockResolvedValue(createMockProcess(''));
      const env = createMockEnvWithR2();

      const result = await mountR2Storage(sandbox, env);

      expect(result).toBe(false);
      expect(console.log).toHaveBeenCalledWith(
        'R2 FUSE mount not yet active - container may be starting'
      );
    });
  });
});

describe('isR2Mounted', () => {
  beforeEach(() => {
    suppressConsole();
  });

  it('returns true when tigrisfs is in mount output', async () => {
    const { sandbox, startProcessMock } = createMockSandbox();
    startProcessMock.mockResolvedValue(
      createMockProcess('tigrisfs on /data/moltbot type fuse (rw,nosuid,nodev)\n')
    );

    const result = await isR2Mounted(sandbox);

    expect(result).toBe(true);
  });

  it('returns false when tigrisfs is not in mount output', async () => {
    const { sandbox, startProcessMock } = createMockSandbox();
    startProcessMock.mockResolvedValue(createMockProcess(''));

    const result = await isR2Mounted(sandbox);

    expect(result).toBe(false);
  });

  it('returns false when process throws an error', async () => {
    const { sandbox, startProcessMock } = createMockSandbox();
    startProcessMock.mockRejectedValue(new Error('Process failed'));

    const result = await isR2Mounted(sandbox);

    expect(result).toBe(false);
  });
});
