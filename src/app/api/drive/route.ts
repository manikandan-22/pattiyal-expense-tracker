import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getOrCreateSpreadsheet,
  getExpenses,
  getAllExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  addExpensesBatch,
  getPendingTransactions,
  addPendingTransactions,
  updatePendingTransaction,
  deletePendingTransaction,
  updateAllPendingTransactions,
  getRules,
  saveRules,
  moveTransactionsToExpenses,
} from '@/lib/google-sheets';
import { Expense, Category, PendingTransaction, TransactionRule } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { extractYearFromId } from '@/lib/id-utils';
import { callLLMNonStreaming } from '@/lib/ai-client';

// GET - Fetch expenses or categories
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type') || 'expenses';
  const year = searchParams.get('year');

  try {
    const spreadsheetId = await getOrCreateSpreadsheet(
      session.accessToken,
      year ? parseInt(year) : undefined
    );

    if (type === 'categories') {
      const categories = await getCategories(session.accessToken, spreadsheetId);
      return NextResponse.json({ categories, spreadsheetId });
    }

    if (type === 'pending') {
      const pendingTransactions = await getPendingTransactions(session.accessToken, spreadsheetId);
      return NextResponse.json({ pendingTransactions, spreadsheetId });
    }

    if (type === 'rules') {
      const rules = await getRules(session.accessToken, spreadsheetId);
      return NextResponse.json({ rules, spreadsheetId });
    }

    if (type === 'search') {
      const query = searchParams.get('q')?.toLowerCase() || '';
      if (!query) {
        return NextResponse.json({ expenses: [] });
      }
      const currentYear = new Date().getFullYear();
      const filterFn = (e: Expense) =>
        e.description?.toLowerCase().includes(query) ||
        String(e.amount).includes(query);

      let filtered = (await getExpenses(session.accessToken, spreadsheetId, currentYear)).filter(filterFn);
      if (filtered.length < 20) {
        const prev = (await getExpenses(session.accessToken, spreadsheetId, currentYear - 1)).filter(filterFn);
        filtered = [...filtered, ...prev];
      }
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return NextResponse.json({ expenses: filtered.slice(0, 50) });
    }

    // Get expenses from all year sheets
    const expenses = await getAllExpenses(session.accessToken, spreadsheetId);
    // Sort by date descending (most recent first)
    expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json({ expenses, spreadsheetId });
  } catch (error) {
    console.error('Error fetching data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

// POST - Add expense or category
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, data, year } = body;

    if (type === 'category') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      const category: Category = {
        id: uuidv4(),
        ...data,
      };
      await addCategory(session.accessToken, spreadsheetId, category);
      return NextResponse.json({ category });
    }

    if (type === 'expenses-batch') {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ error: 'No expenses data provided' }, { status: 400 });
      }
      try {
        const now = new Date().toISOString();
        const expenses: Expense[] = data.map((item: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => ({
          id: `${new Date(item.date).getFullYear()}-${uuidv4()}`,
          ...item,
          createdAt: now,
          updatedAt: now,
        }));
        await addExpensesBatch(session.accessToken, expenses);
        return NextResponse.json({ expenses });
      } catch (batchError) {
        console.error('Batch save error:', batchError);
        return NextResponse.json(
          { error: batchError instanceof Error ? batchError.message : 'Batch save failed' },
          { status: 500 }
        );
      }
    }

    if (type === 'pending-batch') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      const now = new Date().toISOString();
      const pendingTransactions: PendingTransaction[] = data.map((item: Omit<PendingTransaction, 'id' | 'createdAt'>) => ({
        id: `${new Date(item.date).getFullYear()}-${uuidv4()}`,
        ...item,
        // Ensure status is set correctly: has category = auto-mapped
        status: item.category ? 'auto-mapped' : (item.status || 'uncategorized'),
        createdAt: now,
      }));
      await addPendingTransactions(session.accessToken, spreadsheetId, pendingTransactions);
      return NextResponse.json({ pendingTransactions });
    }

    if (type === 'pending-update-all') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      await updateAllPendingTransactions(session.accessToken, spreadsheetId, data);
      return NextResponse.json({ success: true });
    }

    if (type === 'rule') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      const existingRules = await getRules(session.accessToken, spreadsheetId);
      const newRule: TransactionRule = {
        id: uuidv4(),
        ...data,
        createdAt: new Date().toISOString(),
      };
      await saveRules(session.accessToken, spreadsheetId, [...existingRules, newRule]);
      return NextResponse.json({ rule: newRule });
    }

    if (type === 'rules-save') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      await saveRules(session.accessToken, spreadsheetId, data);
      return NextResponse.json({ success: true });
    }

    if (type === 'ai-categorize') {
      const { transactions, recentExpenses, categories: catList } = data;
      const categoryList = (catList as Array<{ id: string; name: string }>)
        .map(c => `- "${c.id}": ${c.name}`).join('\n');
      const recentList = (recentExpenses as Array<{ description: string; amount: number; category: string }>)
        .slice(0, 50)
        .map(e => `- "${e.description}" → ${e.category} ($${e.amount})`)
        .join('\n');
      const transactionList = (transactions as Array<{ id: string; description: string; amount: number }>)
        .map((t, i) => `${i + 1}. [id: "${t.id}"] "${t.description}" - $${t.amount}`)
        .join('\n');

      const prompt = `You are an expense categorization assistant. Based on the user's recent spending patterns, suggest categories for uncategorized transactions.

Available categories:
${categoryList}

Recent expenses (for context):
${recentList || 'No recent expenses available.'}

Transactions to categorize:
${transactionList}

Respond with ONLY a JSON object containing a "suggestions" array. Each item must have "id" (the transaction ID exactly as shown in brackets) and "categoryId" (one of the available category IDs). Only include transactions you're confident about.
Example: {"suggestions": [{"id": "abc123", "categoryId": "groceries"}]}`;

      try {
        const content = await callLLMNonStreaming(prompt);
        const parsed = JSON.parse(content);
        // Map the response to expected format
        const suggestions = (parsed.suggestions || []).map((s: { id: string; categoryId: string }) => ({
          transactionId: s.id,
          categoryId: s.categoryId,
        }));
        return NextResponse.json({ suggestions });
      } catch (error) {
        console.error('AI categorize error:', error);
        return NextResponse.json({ suggestions: [] });
      }
    }

    if (type === 'move-to-expenses') {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
      }
      await moveTransactionsToExpenses(session.accessToken, data);
      return NextResponse.json({ success: true, count: data.length });
    }

    // Default: add single expense
    const now = new Date().toISOString();
    const expenseYear = new Date(data.date).getFullYear();
    const expense: Expense = {
      id: `${expenseYear}-${uuidv4()}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    await addExpense(session.accessToken, expense);
    return NextResponse.json({ expense });
  } catch (error) {
    console.error('Error adding data:', error);
    return NextResponse.json(
      { error: 'Failed to add data' },
      { status: 500 }
    );
  }
}

// PUT - Update expense or category
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, data, year } = body;

    if (type === 'category') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      await updateCategory(session.accessToken, spreadsheetId, data);
      return NextResponse.json({ category: data });
    }

    if (type === 'pending') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      await updatePendingTransaction(session.accessToken, spreadsheetId, data);
      return NextResponse.json({ pendingTransaction: data });
    }

    // Update expense
    const expense: Expense = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await updateExpense(session.accessToken, expense);
    return NextResponse.json({ expense });
  } catch (error) {
    console.error('Error updating data:', error);
    return NextResponse.json(
      { error: 'Failed to update data' },
      { status: 500 }
    );
  }
}

// DELETE - Delete expense or category
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'expense';
    const id = searchParams.get('id');
    const year = searchParams.get('year'); // Get year for category deletion

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    if (type === 'category') {
      if (!year) {
        return NextResponse.json({ error: 'Missing year for category deletion' }, { status: 400 });
      }
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, parseInt(year));
      await deleteCategory(session.accessToken, spreadsheetId, id);
      return NextResponse.json({ success: true });
    }

    if (type === 'pending') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year ? parseInt(year) : undefined);
      await deletePendingTransaction(session.accessToken, spreadsheetId, id);
      return NextResponse.json({ success: true });
    }

    // Extract year from ID or query param
    const targetYear = year ? parseInt(year) : extractYearFromId(id);
    const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken);
    await deleteExpense(session.accessToken, spreadsheetId, id, targetYear || undefined);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting data:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
