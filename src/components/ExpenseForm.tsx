'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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

interface ExpenseFormProps {
  onSuccess?: () => void;
  initialValues?: {
    amount?: number;
    date?: string;
    category?: string;
    description?: string;
  };
}

export function ExpenseForm({ onSuccess, initialValues }: ExpenseFormProps) {
  const { addExpense } = useExpenses();
  const { categories } = useCategories();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [amount, setAmount] = useState(initialValues?.amount?.toString() || '');
  const [date, setDate] = useState(initialValues?.date || getToday());
  const [category, setCategory] = useState(initialValues?.category || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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

      // Reset form
      setAmount('');
      setDescription('');

      if (onSuccess) {
        onSuccess();
      }
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
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {/* Amount - Large, prominent input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-text-muted">
            {getCurrencySymbol(settings.currency)}
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full h-16 pl-12 pr-4 text-3xl font-semibold bg-surface border border-border rounded-xl focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background"
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

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={saving || !amount || !category}
      >
        {saving ? 'Adding...' : 'Add Expense'}
      </Button>
    </motion.form>
  );
}
