import React, { useState } from 'react';

interface AddTodoProps {
  onAdd: (title: string) => void;
}

function AddTodo({ onAdd }: AddTodoProps) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} className="add-todo" data-testid="add-todo-form">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs to be done?"
        data-testid="add-todo-input"
      />
      <button type="submit" data-testid="add-todo-btn">
        Add
      </button>
    </form>
  );
}

export default AddTodo;
