/**
 * API client for the Todo backend.
 */
const BASE_URL = '/api';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface TodoUpdate {
  title?: string;
  completed?: boolean;
}

export async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch(`${BASE_URL}/todos`);
  if (!res.ok) throw new Error(`Failed to fetch todos: ${res.statusText}`);
  const body = await res.json();
  return body.data;
}

export async function createTodo(title: string): Promise<Todo> {
  const res = await fetch(`${BASE_URL}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Failed to create todo: ${res.statusText}`);
  const body = await res.json();
  return body.data;
}

export async function updateTodo(id: string, updates: TodoUpdate): Promise<Todo> {
  const res = await fetch(`${BASE_URL}/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update todo: ${res.statusText}`);
  const body = await res.json();
  return body.data;
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/todos/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete todo: ${res.statusText}`);
}
