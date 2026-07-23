/**
 * Todo data model.
 */
export interface Todo {
  /** Unique identifier */
  id: string;
  /** Todo title */
  title: string;
  /** Whether the todo is completed */
  completed: boolean;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
}

/**
 * In-memory todo store for testing.
 * In a real app this would be a database.
 */
const todos: Map<string, Todo> = new Map();

export function getAllTodos(): Todo[] {
  return Array.from(todos.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function getTodoById(id: string): Todo | undefined {
  return todos.get(id);
}

export function createTodo(title: string): Todo {
  const todo: Todo = {
    id: generateId(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos.set(todo.id, todo);
  return todo;
}

export function updateTodo(
  id: string,
  updates: Partial<Pick<Todo, 'title' | 'completed'>>,
): Todo | undefined {
  const existing = todos.get(id);
  if (!existing) return undefined;

  const updated: Todo = { ...existing, ...updates };
  todos.set(id, updated);
  return updated;
}

export function deleteTodo(id: string): boolean {
  return todos.delete(id);
}

/**
 * Clear all todos (for test reset).
 */
export function clearTodos(): void {
  todos.clear();
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
