import { describe, it, expect, beforeEach } from 'vitest';
import { clearTodos, createTodo, getAllTodos, getTodoById, updateTodo, deleteTodo } from '../models/todo.js';

describe('Todo Model', () => {
  beforeEach(() => {
    clearTodos();
  });

  describe('createTodo', () => {
    it('should create a todo with the given title', () => {
      const todo = createTodo('Buy groceries');
      expect(todo.title).toBe('Buy groceries');
      expect(todo.completed).toBe(false);
      expect(todo.id).toBeTruthy();
      expect(todo.createdAt).toBeTruthy();
    });

    it('should assign unique IDs to different todos', () => {
      const todo1 = createTodo('Task 1');
      const todo2 = createTodo('Task 2');
      expect(todo1.id).not.toBe(todo2.id);
    });
  });

  describe('getAllTodos', () => {
    it('should return todos sorted by creation date', () => {
      createTodo('Task A');
      createTodo('Task B');
      const todos = getAllTodos();
      expect(todos).toHaveLength(2);
      expect(todos[0].title).toBe('Task A');
      expect(todos[1].title).toBe('Task B');
    });

    it('should return an empty array when no todos exist', () => {
      expect(getAllTodos()).toEqual([]);
    });
  });

  describe('updateTodo', () => {
    it('should update title and completed status', () => {
      const todo = createTodo('Original');
      const updated = updateTodo(todo.id, { title: 'Updated', completed: true });
      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated');
      expect(updated!.completed).toBe(true);
    });

    it('should return undefined for non-existent todo', () => {
      expect(updateTodo('nonexistent', { title: 'X' })).toBeUndefined();
    });
  });

  describe('deleteTodo', () => {
    it('should delete an existing todo', () => {
      const todo = createTodo('Delete me');
      expect(deleteTodo(todo.id)).toBe(true);
      expect(getTodoById(todo.id)).toBeUndefined();
    });

    it('should return false for non-existent todo', () => {
      expect(deleteTodo('nonexistent')).toBe(false);
    });
  });
});
