'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCategories } from '@/context/ExpenseContext';
import { useToast } from '@/hooks/useToast';
import { Category } from '@/types';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#86EFAC', // Soft green
  '#93C5FD', // Soft blue
  '#FED7AA', // Soft orange
  '#C4B5FD', // Soft purple
  '#FBCFE8', // Soft pink
  '#FEF08A', // Soft yellow
  '#99F6E4', // Soft teal
  '#D4D4D4', // Neutral
  '#FDA4AF', // Soft red
  '#A5B4FC', // Soft indigo
];

const PRESET_EMOJIS = [
  '🛒', '🚗', '🍽️', '💡', '🎬', '🛍️', '💊', '📝',
  '🏠', '✈️', '☕', '🎮', '📚', '💰', '🎁', '🏋️',
];

interface CategoryManagerProps {
  categories: Category[];
}

export function CategoryManager({ categories }: CategoryManagerProps) {
  const { addCategory, updateCategory, deleteCategory } = useCategories();
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState('');
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setName('');
    setColor(PRESET_COLORS[0]);
    setIcon('');
    setEditingCategory(null);
    setIsAdding(false);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setName(category.name);
    setColor(category.color);
    setIcon(category.icon || '');
    setIsAdding(false);
  };

  const openAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a category name',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await updateCategory({
          ...editingCategory,
          name: name.trim(),
          color,
          icon: icon || undefined,
        });
        toast({ title: 'Category updated' });
      } else {
        await addCategory({
          name: name.trim(),
          color,
          icon: icon || undefined,
        });
        toast({ title: 'Category added' });
      }
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save category',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      toast({ title: 'Category deleted' });
      setDeleteConfirm(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete category',
        variant: 'destructive',
      });
    }
  };

  const showForm = isAdding || editingCategory;

  return (
    <div className="space-y-4">
      {/* Category List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.03 }}
              layout
              className="flex items-center gap-3 p-4 bg-surface rounded-lg"
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.icon && (
                <span className="text-lg">{category.icon}</span>
              )}
              <span className="flex-1 font-medium text-text-primary">
                {category.name}
              </span>

              {deleteConfirm === category.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-secondary">Delete?</span>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="p-1.5 rounded bg-error text-white hover:bg-error/90"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="p-1.5 rounded bg-surface-hover hover:bg-border"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(category)}
                    className="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text-secondary"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(category.id)}
                    className="p-2 rounded-lg hover:bg-surface-hover transition-colors text-text-secondary hover:text-error"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Button */}
      <Button
        onClick={openAdd}
        variant="outline"
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Category
      </Button>

      {/* Add/Edit Dialog */}
      <Dialog open={!!showForm} onOpenChange={() => resetForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                autoFocus
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-transform',
                      color === c && 'ring-2 ring-offset-2 ring-accent scale-110'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Icon (optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setIcon(icon === e ? '' : e)}
                    className={cn(
                      'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors',
                      icon === e
                        ? 'bg-accent-light ring-2 ring-accent'
                        : 'bg-surface-hover hover:bg-border'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Preview
              </label>
              <div className="flex items-center gap-3 p-4 bg-surface-hover rounded-lg">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {icon && <span className="text-lg">{icon}</span>}
                <span className="font-medium text-text-primary">
                  {name || 'Category Name'}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingCategory ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
