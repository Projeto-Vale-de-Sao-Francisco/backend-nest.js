import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('axios', () => ({ default: { get } }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

const originalArgv = process.argv;

beforeEach(() => {
  vi.resetModules();
  get.mockReset().mockResolvedValue({ data: 1 });
  process.argv = [...originalArgv, '--only-thingspeak', '--once'];
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Simulator ThingSpeak credentials', () => {
  it('does not contact ThingSpeak without an environment credential', async () => {
    vi.stubEnv('THINGSPEAK_WRITE_API_KEY', '');
    await import('./simulator.js');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(get).not.toHaveBeenCalled();
  });

  it('sends readings with the credential supplied through the environment', async () => {
    vi.stubEnv('THINGSPEAK_WRITE_API_KEY', 'ci-only-simulator-key');
    await import('./simulator.js');
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce());
    expect(get).toHaveBeenCalledWith(
      'https://api.thingspeak.com/update',
      expect.objectContaining({
        params: expect.objectContaining({ api_key: 'ci-only-simulator-key' }),
      }),
    );
  });
});
