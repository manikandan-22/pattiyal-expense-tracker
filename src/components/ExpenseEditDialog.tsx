'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useExpenses } from '@/context/ExpenseContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { Expense, Category } from '@/types';
import { formatCurrency, parseAmount, getCurrencySymbol } from '@/lib/utils';

interface ExpenseEditDialogProps {
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
}

export function ExpenseEditDialog({
  expense,
  categories,
  onClose,
}: ExpenseEditDialogProps) {
  const { updateExpense, deleteExpense } = useExpenses();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when expense changes
  useEffect(() => {
    if (expense) {
      setAmount(expense.amount.toString());
      setDate(expense.date);
      setCategory(expense.category);
      setDescription(expense.description);
    }
  }, [expense]);

  const handleSave = async () => {
    if (!expense) return;

    const parsedAmount = parseAmount(amount);
    if (parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await updateExpense({
        ...expense,
        amount: parsedAmount,
        date,
        category,
        description,
      });

      toast({
        title: 'Expense updated',
        description: `${formatCurrency(parsedAmount, settings.currency)} saved`,
        variant: 'success',
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update expense',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!expense) return;

    setDeleting(true);
    try {
      await deleteExpense(expense.id);

      toast({
        title: 'Expense deleted',
        variant: 'default',
      });

      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete expense',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === category);

  return (
    <Dialog open={!!expense} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                {getCurrencySymbol(settings.currency)}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8 text-2xl font-semibold"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Date
            </label>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category">
                  {selectedCategory && (
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedCategory.color }}
                      />
                      <span>{selectedCategory.icon}</span>
                      <span>{selectedCategory.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Description
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this expense for?"
            />
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="text-error hover:text-error hover:bg-error/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
