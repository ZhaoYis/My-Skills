import { describe, expect, it } from 'vitest';
import { HttpModelClient } from '../../src/agent/runtime/http-model-client.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('HttpModelClient', () => {
  it('sends an OpenAI-compatible JSON request and extracts message content', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const client = new HttpModelClient({
      endpoint: 'https://model.example/v1/chat/completions',
      model: 'planner-1',
      apiKey: 'secret',
      fetchImpl: async (url, init) => {
        request = { url: String(url), init: init as RequestInit };
        return response({ choices: [{ message: { content: '{"action":null}' } }] });
      },
    });

    await expect(client.complete({ prompt: 'plan', responseFormat: 'json' })).resolves.toBe(
      '{"action":null}',
    );
    expect(request?.url).toBe('https://model.example/v1/chat/completions');
    expect(request?.init.method).toBe('POST');
    expect(request?.init.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer secret',
    });
    expect(JSON.parse(String(request?.init.body))).toMatchObject({
      model: 'planner-1',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'plan' }],
    });
  });

  it('retries transient HTTP failures and supports content-part responses', async () => {
    let calls = 0;
    const client = new HttpModelClient({
      endpoint: 'https://model.example/chat',
      model: 'planner-1',
      maxRetries: 1,
      sleep: async () => undefined,
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return response({ error: 'busy' }, 503);
        return response({
          choices: [
            { message: { content: [{ type: 'text', text: '{' }, { text: '"action":null}' }] } },
          ],
        });
      },
    });

    await expect(client.complete({ prompt: 'plan', responseFormat: 'json' })).resolves.toBe(
      '{"action":null}',
    );
    expect(calls).toBe(2);
  });

  it('does not retry client errors and rejects malformed model responses', async () => {
    let calls = 0;
    const client = new HttpModelClient({
      endpoint: 'https://model.example/chat',
      model: 'planner-1',
      maxRetries: 2,
      fetchImpl: async () => {
        calls += 1;
        return response({ error: 'bad request' }, 400);
      },
    });
    await expect(client.complete({ prompt: 'plan', responseFormat: 'json' })).rejects.toThrow(
      'model-http-error: 400',
    );
    expect(calls).toBe(1);

    const malformed = new HttpModelClient({
      endpoint: 'https://model.example/chat',
      model: 'planner-1',
      fetchImpl: async () => response({ choices: [{ message: {} }] }),
    });
    await expect(malformed.complete({ prompt: 'plan', responseFormat: 'json' })).rejects.toThrow(
      'model-response-missing-content',
    );
  });

  it('turns an aborted request into an explicit timeout error', async () => {
    const client = new HttpModelClient({
      endpoint: 'https://model.example/chat',
      model: 'planner-1',
      timeoutMs: 1,
      fetchImpl: async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    });
    await expect(client.complete({ prompt: 'plan', responseFormat: 'json' })).rejects.toThrow(
      'model-request-timeout: 1ms',
    );
  });
});
