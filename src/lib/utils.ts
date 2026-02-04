import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CurrencyCode, SUPPORTED_CURRENCIES } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode: CurrencyCode = 'USD'): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode) || SUPPORTED_CURRENCIES[0];

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.code === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency.code === 'JPY' ? 0 : 2,
  }).format(amount);
}

export function getCurrencySymbol(currencyCode: CurrencyCode = 'USD'): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || '$';
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatMonthYear(monthString: string): string {
  // monthString format: YYYY-MM
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

export function getMonthKey(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getDayKey(dateString: string): string {
  return dateString.split('T')[0];
}

export function formatDayTitle(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset time for comparison
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

  if (dateDay.getTime() === todayDay.getTime()) {
    return 'Today';
  }
  if (dateDay.getTime() === yesterdayDay.getTime()) {
    return 'Yesterday';
  }

  // Check if same year
  if (date.getFullYear() === today.getFullYear()) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function groupExpensesByDay<T extends { date: string }>(
  expenses: T[]
): { day: string; dayTitle: string; expenses: T[] }[] {
  const grouped = new Map<string, T[]>();

  for (const expense of expenses) {
    const dayKey = getDayKey(expense.date);
    if (!grouped.has(dayKey)) {
      grouped.set(dayKey, []);
    }
    grouped.get(dayKey)!.push(expense);
  }

  // Convert to array and sort by day descending
  return Array.from(grouped.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, dayExpenses]) => ({
      day,
      dayTitle: formatDayTitle(day),
      expenses: dayExpenses,
    }));
}

export function parseAmount(value: string): number {
  // Remove currency symbols and commas
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return parseFloat(cleaned) || 0;
}

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function groupExpensesByMonth(
  expenses: { date: string; amount: number; category: string }[]
): Map<string, typeof expenses> {
  const grouped = new Map<string, typeof expenses>();

  for (const expense of expenses) {
    const monthKey = getMonthKey(expense.date);
    if (!grouped.has(monthKey)) {
      grouped.set(monthKey, []);
    }
    grouped.get(monthKey)!.push(expense);
  }

  return grouped;
}

export function calculateCategoryBreakdown(
  expenses: { amount: number; category: string }[],
  categories: { id: string; name: string; color: string }[]
) {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const expense of expenses) {
    const current = totals.get(expense.category) || 0;
    totals.set(expense.category, current + expense.amount);
    grandTotal += expense.amount;
  }

  return categories
    .map((cat) => {
      const total = totals.get(cat.id) || 0;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        color: cat.color,
        total,
        percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
        count: expenses.filter((e) => e.category === cat.id).length,
      };
    })
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total);
}
