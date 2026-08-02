import type { ModelClient } from './model-planner.js';

export interface HttpModelClientOptions {
  endpoint: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof globalThis.fetch;
  sleep?: (delayMs: number) => Promise<void>;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  output_text?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_ERROR_BODY_LENGTH = 500;

/** ModelClient for providers implementing the OpenAI-compatible chat API. */
export class HttpModelClient implements ModelClient {
  private readonly endpoint: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly sleep: (delayMs: number) => Promise<void>;

  constructor(options: HttpModelClientOptions) {
    try {
      this.endpoint = new URL(options.endpoint).toString();
    } catch {
      throw new Error('model-endpoint-invalid');
    }
    if (!options.model.trim()) throw new Error('model-name-required');
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.timeoutMs = positiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    this.maxRetries = nonNegativeInteger(options.maxRetries, DEFAULT_MAX_RETRIES);
    this.headers = { ...options.headers };
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.sleep =
      options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async complete(input: { prompt: string; responseFormat: 'json' }): Promise<string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...this.headers,
    };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const body = JSON.stringify({
      model: this.model,
      messages: [{ role: 'user', content: input.prompt }],
      response_format: input.responseFormat === 'json' ? { type: 'json_object' } : undefined,
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.request(body, headers);
        if (response.ok) return await extractContent(response);
        const error = new Error(
          `model-http-error: ${response.status} ${await readErrorBody(response)}`,
        );
        if (!isRetryableStatus(response.status) || attempt === this.maxRetries) throw error;
        lastError = error;
      } catch (error) {
        if (isTimeoutError(error)) throw error;
        if (isAbortError(error) || !isRetryableError(error) || attempt === this.maxRetries) {
          throw error;
        }
        lastError = error;
      }
      await this.sleep(100 * 2 ** attempt);
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async request(body: string, headers: Record<string, string>): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      };
      return await this.fetchImpl(this.endpoint, requestInit);
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`model-request-timeout: ${this.timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function extractContent(response: Response): Promise<string> {
  let payload: ChatCompletionResponse;
  try {
    payload = (await response.json()) as ChatCompletionResponse;
  } catch {
    throw new Error('model-response-invalid-json');
  }

  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => (part.type === 'text' || !part.type ? (part.text ?? '') : ''))
      .join('');
    if (text) return text;
  }
  if (typeof payload.output_text === 'string' && payload.output_text) return payload.output_text;
  throw new Error('model-response-missing-content');
}

async function readErrorBody(response: Response): Promise<string> {
  const body = await response.text();
  return body.replace(/\s+/g, ' ').slice(0, MAX_ERROR_BODY_LENGTH) || 'empty-body';
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && error.name === 'FetchError');
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('model-request-timeout:');
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : fallback;
}
