'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface InlineEditProps {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  inputClassName?: string;
  displayClassName?: string;
  placeholder?: string;
  type?: 'text' | 'number';
  formatDisplay?: (value: string) => string;
}

export function InlineEdit({
  value,
  onSave,
  className,
  inputClassName,
  displayClassName,
  placeholder = 'Click to edit',
  type = 'text',
  formatDisplay,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn(
          'bg-transparent border-b-2 border-accent outline-none',
          inputClassName,
          className
        )}
      />
    );
  }

  const displayValue = formatDisplay ? formatDisplay(value) : value;

  return (
    <span
      onClick={() => setIsEditing(true)}
      className={cn(
        'cursor-pointer hover:bg-surface-hover rounded px-1 -mx-1 transition-colors',
        !value && 'text-text-muted',
        displayClassName,
        className
      )}
    >
      {displayValue || placeholder}
    </span>
  );
}
