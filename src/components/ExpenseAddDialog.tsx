'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useExpenses, useCategories } from '@/context/ExpenseContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { formatCurrency, parseAmount, getToday, getCurrencySymbol } from '@/lib/utils';

interface ExpenseAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseAddDialog({ open, onOpenChange }: ExpenseAddDialogProps) {
  const { addExpense } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getToday());
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setAmount('');
      setDate(getToday());
      setCategory('');
      setDescription('');
    }
  }, [open]);

  const handleSave = async () => {
    const parsedAmount = parseAmount(amount);
    if (parsedAmount <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    if (!category) {
      toast({
        title: 'Category required',
        description: 'Please select a category',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await addExpense({
        amount: parsedAmount,
        date,
        category,
        description,
      });

      toast({
        title: 'Expense added',
        description: `${formatCurrency(parsedAmount, settings.currency)} saved`,
        variant: 'success',
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add expense',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-text-muted">
                {getCurrencySymbol(settings.currency)}
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 text-2xl font-semibold h-14 font-mono"
                placeholder="0.00"
                autoFocus
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
              Description <span className="text-text-muted">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this expense for?"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !amount || !category}
            className="flex-1"
          >
            {saving ? 'Adding...' : 'Add Expense'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
