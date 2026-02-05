import { v4 as uuidv4 } from 'uuid';
import { Category, Expense, PendingTransaction } from '@/types';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  addCategory,
  addExpensesBatch,
  addPendingTransactions,
} from '@/lib/google-sheets';
import { extractYearFromId } from '@/lib/id-utils';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CurrencyCode } from '@/types';

// OpenAI-compatible tool definitions
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'add_expense',
      description: 'Add a new expense. Use this when the user wants to record a new expense.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', description: 'The expense amount' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format. Defaults to today.' },
          category: { type: 'string', description: 'Category ID (e.g. "groceries", "transport", "dining")' },
          description: { type: 'string', description: 'Description of the expense' },
        },
        required: ['amount', 'description', 'category'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_expenses',
      description: 'Search expenses by description or amount. Use this when the user asks to find specific expenses.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query to match against descriptions or amounts' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_recent_expenses',
      description: 'List the most recent expenses. Use when user asks to see recent spending or latest expenses.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of expenses to return (default 10, max 50)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_expense',
      description: 'Update an existing expense. The user must provide the expense ID (from a search or list result).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The expense ID to update' },
          amount: { type: 'number', description: 'New amount' },
          date: { type: 'string', description: 'New date in YYYY-MM-DD format' },
          category: { type: 'string', description: 'New category ID' },
          description: { type: 'string', description: 'New description' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_expense',
      description: 'Delete an expense by ID. Always confirm with the user before deleting.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The expense ID to delete' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_categories',
      description: 'List all available expense categories.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'add_category',
      description: 'Create a new expense category.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Category name' },
          color: { type: 'string', description: 'Hex color code (e.g. "#86EFAC")' },
          icon: { type: 'string', description: 'Emoji icon for the category' },
        },
        required: ['name', 'color'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'import_expenses_batch',
      description: 'Import multiple expenses at once. Use when the user provides a list of expenses or a bank statement.',
      parameters: {
        type: 'object',
        properties: {
          expenses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                amount: { type: 'number' },
                date: { type: 'string', description: 'YYYY-MM-DD' },
                category: { type: 'string' },
                description: { type: 'string' },
              },
              required: ['amount', 'date', 'description', 'category'],
            },
            description: 'Array of expenses to import',
          },
        },
        required: ['expenses'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'import_pending_transactions',
      description: 'Import transactions from a bank statement as pending transactions for user review. Use this when the user uploads a PDF/image bank statement. Transactions go to the pending review page, not directly to expenses.',
      parameters: {
        type: 'object',
        properties: {
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                amount: { type: 'number', description: 'Transaction amount (positive number)' },
                date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                description: { type: 'string', description: 'Transaction description' },
                category: { type: 'string', description: 'Category ID if it can be determined, otherwise omit' },
              },
              required: ['amount', 'date', 'description'],
            },
            description: 'Array of transactions extracted from the statement',
          },
        },
        required: ['transactions'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_monthly_summary',
      description: 'Get a spending summary for a specific month, or the current month if not specified.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'Month in YYYY-MM format. Defaults to current month.' },
        },
      },
    },
  },
];

// Context passed to avoid redundant API calls within a single chat request
export interface ToolContext {
  accessToken: string;
  spreadsheetId: string;
  categories: Category[];
  currency: CurrencyCode;
}

// Execute a tool call and return results
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ success: boolean; data: unknown; summary: string }> {
  try {
    const { accessToken, spreadsheetId, categories, currency } = ctx;

    switch (toolName) {
      case 'add_expense': {
        const now = new Date().toISOString();
        const date = (args.date as string) || now.split('T')[0];
        const year = new Date(date).getFullYear();
        const expense: Expense = {
          id: `${year}-${uuidv4()}`,
          amount: args.amount as number,
          date,
          category: args.category as string,
          description: args.description as string,
          createdAt: now,
          updatedAt: now,
        };
        await addExpense(accessToken, expense);
        return {
          success: true,
          data: expense,
          summary: `Added ${formatCurrency(expense.amount, currency)} for "${expense.description}"`,
        };
      }

      case 'search_expenses': {
        const query = (args.query as string).toLowerCase();
        const currentYear = new Date().getFullYear();
        const filterFn = (e: Expense) =>
          e.description?.toLowerCase().includes(query) ||
          String(e.amount).includes(query);

        // Search current year first
        let expenses = await getExpenses(accessToken, spreadsheetId, currentYear);
        let filtered = expenses.filter(filterFn);

        // If few results, also search previous year
        if (filtered.length < 10) {
          const prevYear = await getExpenses(accessToken, spreadsheetId, currentYear - 1);
          filtered = [...filtered, ...prevYear.filter(filterFn)];
        }

        filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const results = filtered.slice(0, 20);
        return {
          success: true,
          data: results,
          summary: `Found ${results.length} expense(s) matching "${args.query}"`,
        };
      }

      case 'list_recent_expenses': {
        const limit = Math.min((args.limit as number) || 10, 50);
        const currentYear = new Date().getFullYear();

        let expenses = await getExpenses(accessToken, spreadsheetId, currentYear);
        // If current year has fewer than requested, also fetch previous year
        if (expenses.length < limit) {
          const prevYear = await getExpenses(accessToken, spreadsheetId, currentYear - 1);
          expenses = [...expenses, ...prevYear];
        }

        expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const results = expenses.slice(0, limit);
        return {
          success: true,
          data: results,
          summary: `Retrieved ${results.length} recent expense(s)`,
        };
      }

      case 'update_expense': {
        const expYear = extractYearFromId(args.id as string) || new Date().getFullYear();
        const yearExpenses = await getExpenses(accessToken, spreadsheetId, expYear);
        const existing = yearExpenses.find((e) => e.id === args.id);
        if (!existing) {
          return { success: false, data: null, summary: `Expense with ID "${args.id}" not found` };
        }
        const updated: Expense = {
          ...existing,
          amount: (args.amount as number) ?? existing.amount,
          date: (args.date as string) ?? existing.date,
          category: (args.category as string) ?? existing.category,
          description: (args.description as string) ?? existing.description,
          updatedAt: new Date().toISOString(),
        };
        await updateExpense(accessToken, updated);
        return {
          success: true,
          data: updated,
          summary: `Updated expense "${updated.description}"`,
        };
      }

      case 'delete_expense': {
        await deleteExpense(accessToken, spreadsheetId, args.id as string);
        return {
          success: true,
          data: { id: args.id },
          summary: `Deleted expense`,
        };
      }

      case 'list_categories': {
        // Use cached categories from context
        return {
          success: true,
          data: categories,
          summary: `Found ${categories.length} categories`,
        };
      }

      case 'add_category': {
        const cat: Category = {
          id: uuidv4(),
          name: args.name as string,
          color: args.color as string,
          icon: (args.icon as string) || undefined,
        };
        await addCategory(accessToken, spreadsheetId, cat);
        return {
          success: true,
          data: cat,
          summary: `Created category "${cat.name}"`,
        };
      }

      case 'import_expenses_batch': {
        const items = args.expenses as Array<{
          amount: number;
          date: string;
          category: string;
          description: string;
        }>;
        const now = new Date().toISOString();
        const expenses: Expense[] = items.map((item) => ({
          id: `${new Date(item.date).getFullYear()}-${uuidv4()}`,
          amount: item.amount,
          date: item.date,
          category: item.category,
          description: item.description,
          createdAt: now,
          updatedAt: now,
        }));
        await addExpensesBatch(accessToken, expenses);
        const total = expenses.reduce((s, e) => s + e.amount, 0);
        return {
          success: true,
          data: { count: expenses.length, total },
          summary: `Imported ${expenses.length} expenses totaling ${formatCurrency(total, currency)}`,
        };
      }

      case 'import_pending_transactions': {
        const items = args.transactions as Array<{
          amount: number;
          date: string;
          description: string;
          category?: string;
        }>;
        const now = new Date().toISOString();
        const pending: PendingTransaction[] = items.map((item) => ({
          id: `${new Date(item.date).getFullYear()}-${uuidv4()}`,
          amount: item.amount,
          date: item.date,
          description: item.description,
          category: item.category || undefined,
          status: item.category ? 'auto-mapped' as const : 'uncategorized' as const,
          createdAt: now,
        }));
        await addPendingTransactions(accessToken, spreadsheetId, pending);
        const total = pending.reduce((s, t) => s + t.amount, 0);
        return {
          success: true,
          data: { count: pending.length, total },
          summary: `Imported ${pending.length} transactions (${formatCurrency(total, currency)}) to pending review`,
        };
      }

      case 'get_monthly_summary': {
        const targetMonth =
          (args.month as string) || new Date().toISOString().slice(0, 7);
        const year = parseInt(targetMonth.split('-')[0], 10);
        const yearExpenses = await getExpenses(accessToken, spreadsheetId, year);
        const monthExpenses = yearExpenses.filter((e) => e.date.startsWith(targetMonth));
        const total = monthExpenses.reduce((s, e) => s + e.amount, 0);

        // Category breakdown
        const catMap = new Map(categories.map((c) => [c.id, c.name]));
        const byCategory: Record<string, number> = {};
        for (const e of monthExpenses) {
          const name = catMap.get(e.category) || e.category;
          byCategory[name] = (byCategory[name] || 0) + e.amount;
        }

        return {
          success: true,
          data: {
            month: targetMonth,
            total,
            count: monthExpenses.length,
            byCategory,
          },
          summary: `${targetMonth}: ${formatCurrency(total, currency)} across ${monthExpenses.length} expenses`,
        };
      }

      default:
        return { success: false, data: null, summary: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return { success: false, data: null, summary: message };
  }
}

// Build system prompt with user's context
export function buildSystemPrompt(categories: Category[], currency: string): string {
  const categoryList = categories
    .map((c) => `${c.name} (id: "${c.id}"${c.icon ? ', icon: ' + c.icon : ''})`)
    .join(', ');

  return `You are Pattiyal AI, a helpful expense tracking assistant. You help users manage their personal expenses through natural conversation.

Available expense categories: ${categoryList}

User's currency: ${currency}
Today's date: ${formatDate(new Date().toISOString())}

Guidelines:
- When adding expenses, extract amount, description, category (match to available categories by name), and date (default: today).
- For ambiguous categories, pick the closest match and mention which one you chose.
- When showing expenses, format amounts with the user's currency.
- When the user uploads a bank statement image/PDF, extract all visible transactions and use import_pending_transactions to add them for review. Try to match categories intelligently. The user can review and confirm them on the Import page.
- Always confirm what action you performed after completing it.
- If the user's request is unclear, ask for clarification.
- Keep responses concise and friendly.
- When listing expenses, include the ID so the user can reference them for edits/deletes.
- Before deleting, confirm with the user unless they explicitly said to delete.`;
}
