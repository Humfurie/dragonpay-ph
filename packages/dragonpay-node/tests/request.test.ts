import { describe, it, expect, vi, beforeEach } from 'vitest';
import { safeRequest } from '../src/request';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const baseOpts = {
  url: 'https://gw.dragonpay.ph/api/test',
  method: 'GET' as const,
  headers: { 'Content-Type': 'application/json' },
  timeoutMs: 30000,
  maxRetries: 2,
};

describe('safeRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RefNo: 'REF1', Status: 'S' }),
    });

    const { data, status } = await safeRequest(baseOpts);
    expect(status).toBe(200);
    expect(data).toEqual({ RefNo: 'REF1', Status: 'S' });
  });

  it('throws on non-JSON response (non-retryable status)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => '<html>Unauthorized</html>',
    });

    await expect(safeRequest(baseOpts)).rejects.toThrow('non-JSON');
  });

  it('retries on 502 and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Status: 'S' }),
      });

    const { data } = await safeRequest(baseOpts);
    expect(data).toEqual({ Status: 'S' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 503 JSON error and succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ Message: 'Service unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Status: 'S' }),
      });

    const { data } = await safeRequest(baseOpts);
    expect(data).toEqual({ Status: 'S' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 4xx errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ Message: 'Bad request' }),
    });

    // Should return the error response without retrying
    const { data, status } = await safeRequest(baseOpts);
    expect(status).toBe(400);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and throws', async () => {
    mockFetch
      .mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => '<html>Bad Gateway</html>',
      });

    await expect(safeRequest(baseOpts)).rejects.toThrow('non-JSON');
    expect(mockFetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('retries on network errors (TypeError)', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Status: 'S' }),
      });

    const { data } = await safeRequest(baseOpts);
    expect(data).toEqual({ Status: 'S' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('passes AbortSignal.timeout to fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({}),
    });

    await safeRequest({ ...baseOpts, timeoutMs: 5000 });

    const fetchCall = mockFetch.mock.calls[0][1];
    expect(fetchCall.signal).toBeDefined();
  });

  it('does not retry on timeout (AbortError)', async () => {
    const abortError = new DOMException('Signal timed out', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortError);

    await expect(safeRequest(baseOpts)).rejects.toThrow('timed out');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
