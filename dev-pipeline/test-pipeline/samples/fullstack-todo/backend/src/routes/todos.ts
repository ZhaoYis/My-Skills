import { Router, Request, Response } from 'express';
import {
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  type Todo,
} from '../models/todo.js';

const router = Router();

/**
 * GET /api/todos
 * Returns all todos sorted by creation date.
 */
router.get('/', (_req: Request, res: Response) => {
  const todos = getAllTodos();
  res.json({ data: todos, total: todos.length });
});

/**
 * GET /api/todos/:id
 * Returns a single todo by ID.
 */
router.get('/:id', (req: Request, res: Response) => {
  const todo = getTodoById(req.params.id);
  if (!todo) {
    res.status(404).json({ error: 'Todo not found' });
    return;
  }
  res.json({ data: todo });
});

/**
 * POST /api/todos
 * Creates a new todo.
 * Body: { title: string }
 */
router.post('/', (req: Request, res: Response) => {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    return;
  }

  const todo = createTodo(title.trim());
  res.status(201).json({ data: todo });
});

/**
 * PATCH /api/todos/:id
 * Updates an existing todo.
 * Body: { title?: string, completed?: boolean }
 */
router.patch('/:id', (req: Request, res: Response) => {
  const { title, completed } = req.body;
  const updates: Partial<Pick<Todo, 'title' | 'completed'>> = {};

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Title must be a non-empty string' });
      return;
    }
    updates.title = title.trim();
  }

  if (completed !== undefined) {
    if (typeof completed !== 'boolean') {
      res.status(400).json({ error: 'Completed must be a boolean' });
      return;
    }
    updates.completed = completed;
  }

  const updated = updateTodo(req.params.id, updates);
  if (!updated) {
    res.status(404).json({ error: 'Todo not found' });
    return;
  }

  res.json({ data: updated });
});

/**
 * DELETE /api/todos/:id
 * Deletes a todo by ID.
 */
router.delete('/:id', (req: Request, res: Response) => {
  const deleted = deleteTodo(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Todo not found' });
    return;
  }
  res.status(204).send();
});

export default router;
