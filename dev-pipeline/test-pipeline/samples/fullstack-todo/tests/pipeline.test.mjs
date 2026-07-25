import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('due date is implemented in backend and frontend contracts', async () => {
  const backend = await readFile('backend/src/models/todo.ts', 'utf8');
  const frontend = await readFile('frontend/src/api/client.ts', 'utf8');

  assert.match(backend, /dueDate\?: string/);
  assert.match(frontend, /dueDate\?: string/);
});
