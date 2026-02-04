import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getOrCreateSpreadsheet,
  getExpenses,
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
} from '@/lib/google-sheets';
import { Expense, Category, PendingTransaction, TransactionRule } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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

    const expenses = await getExpenses(session.accessToken, spreadsheetId);
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
      const now = new Date().toISOString();
      const expenses: Expense[] = data.map((item: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => ({
        id: uuidv4(),
        ...item,
        createdAt: now,
        updatedAt: now,
      }));
      await addExpensesBatch(session.accessToken, expenses);
      return NextResponse.json({ expenses });
    }

    if (type === 'pending-batch') {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, year);
      const now = new Date().toISOString();
      const pendingTransactions: PendingTransaction[] = data.map((item: Omit<PendingTransaction, 'id' | 'createdAt'>) => ({
        id: uuidv4(),
        ...item,
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

    // Default: add single expense
    const now = new Date().toISOString();
    const expense: Expense = {
      id: uuidv4(),
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

    // For expense deletion, if year is provided, use that spreadsheet
    if (year) {
      const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, parseInt(year));
      await deleteExpense(session.accessToken, spreadsheetId, id);
    } else {
      // If no year provided, we need to search for the expense across all yearly spreadsheets
      // This is a simplified approach - in a production app, you might want to store expense-year mapping
      const currentYear = new Date().getFullYear();
      const startYear = currentYear - 5; // Search last 5 years

      let deleted = false;
      for (let searchYear = currentYear; searchYear >= startYear; searchYear--) {
        try {
          const spreadsheetId = await getOrCreateSpreadsheet(session.accessToken, searchYear);
          // We need to check if the expense exists in this spreadsheet before deleting
          // For now, we'll just try to delete and catch any errors
          await deleteExpense(session.accessToken, spreadsheetId, id);
          deleted = true;
          break;
        } catch (error) {
          // Continue to next year if expense not found in this spreadsheet
          continue;
        }
      }

      if (!deleted) {
        return NextResponse.json({ error: 'Expense not found in any yearly spreadsheet' }, { status: 404 });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting data:', error);
    return NextResponse.json(
      { error: 'Failed to delete data' },
      { status: 500 }
    );
  }
}
