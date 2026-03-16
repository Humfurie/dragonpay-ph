import { DragonPayError } from './errors';

export interface RequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxRetries: number;
}

const RETRYABLE_STATUS_CODES = new Set([502, 503, 504, 408, 429]);
const BASE_DELAY_MS = 500;

function isRetryable(error: unknown, status?: number): boolean {
  if (status && RETRYABLE_STATUS_CODES.has(status)) return true;
  if (error instanceof TypeError) return true; // fetch network errors
  if (error instanceof DOMException && error.name === 'AbortError') return false; // timeout — don't retry
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safeRequest<T = unknown>(options: RequestOptions): Promise<{ data: T; status: number }> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 100;
      await sleep(delay);
    }

    let response: Response;
    try {
      response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
    } catch (error) {
      lastError = error;
      if (isRetryable(error)) continue;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new DragonPayError(
          `Request timed out after ${options.timeoutMs}ms: ${options.method} ${options.url}`,
        );
      }
      throw new DragonPayError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Read raw text first — never call response.json() directly
    const raw = await response.text();

    let data: T;
    try {
      data = JSON.parse(raw);
    } catch {
      // If it's a retryable status with non-JSON body (e.g. 502 HTML page), retry
      if (isRetryable(null, response.status)) {
        lastError = new DragonPayError(
          `DragonPay returned non-JSON (HTTP ${response.status}): ${raw.slice(0, 200)}`,
          response.status,
        );
        continue;
      }
      throw new DragonPayError(
        `DragonPay returned non-JSON (HTTP ${response.status}): ${raw.slice(0, 200)}`,
        response.status,
      );
    }

    // Successful parse — check if we should retry on status
    if (!response.ok && isRetryable(null, response.status)) {
      lastError = new DragonPayError(
        (data as Record<string, string>).Message || `HTTP ${response.status}`,
        response.status,
        (data as Record<string, string>).Message,
      );
      continue;
    }

    return { data, status: response.status };
  }

  // All retries exhausted
  if (lastError instanceof DragonPayError) throw lastError;
  throw new DragonPayError(
    `Request failed after ${options.maxRetries + 1} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
