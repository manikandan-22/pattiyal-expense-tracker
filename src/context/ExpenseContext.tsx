'use client';

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useSession } from 'next-auth/react';
import {
  Expense,
  Category,
  ExpenseState,
  ExpenseAction,
  ExpenseContextType,
  CategoryContextType,
  DEFAULT_CATEGORIES,
} from '@/types';

// Cache keys for sessionStorage
const EXPENSES_CACHE_KEY = 'expense-tracker-expenses';
const CATEGORIES_CACHE_KEY = 'expense-tracker-categories';

// Cache helpers
const getCachedExpenses = (): Expense[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(EXPENSES_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const getCachedCategories = (): Category[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(CATEGORIES_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCacheData = (expenses: Expense[], categories: Category[]) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(expenses));
    sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(categories));
  } catch {
    // Ignore storage errors
  }
};

const updateExpensesCache = (expenses: Expense[]) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(EXPENSES_CACHE_KEY, JSON.stringify(expenses));
  } catch {
    // Ignore storage errors
  }
};

const updateCategoriesCache = (categories: Category[]) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(categories));
  } catch {
    // Ignore storage errors
  }
};

// Expense Reducer
function expenseReducer(state: ExpenseState, action: ExpenseAction): ExpenseState {
  switch (action.type) {
    case 'SET_EXPENSES':
      return { ...state, expenses: action.payload, loading: false };
    case 'ADD_EXPENSE':
      return {
        ...state,
        expenses: [action.payload, ...state.expenses].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      };
    case 'UPDATE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses
          .map((e) => (e.id === action.payload.id ? action.payload : e))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      };
    case 'DELETE_EXPENSE':
      return {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    default:
      return state;
  }
}

// Contexts
const ExpenseContext = createContext<ExpenseContextType | null>(null);
const CategoryContext = createContext<CategoryContextType | null>(null);

// Provider Component
interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { data: session, status } = useSession();
  const [categories, setCategories] = useState<Category[]>(() => getCachedCategories() || DEFAULT_CATEGORIES);

  const cachedExpenses = getCachedExpenses();
  const [state, dispatch] = useReducer(expenseReducer, {
    expenses: cachedExpenses || [],
    loading: !cachedExpenses, // Only show loading if no cache
    error: null,
  });

  const fetchData = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        dispatch({ type: 'SET_LOADING', payload: true });
      }

      // Fetch expenses and categories in parallel
      const currentYear = new Date().getFullYear();
      const [expenseRes, categoryRes] = await Promise.all([
        fetch(`/api/drive?type=expenses&year=${currentYear}`),
        fetch(`/api/drive?type=categories&year=${currentYear}`), // Pass year for categories too
      ]);

      const [expenseData, categoryData] = await Promise.all([
        expenseRes.json(),
        categoryRes.json(),
      ]);

      if (expenseData.error) {
        throw new Error(expenseData.error);
      }

      dispatch({ type: 'SET_EXPENSES', payload: expenseData.expenses });

      if (!categoryData.error) {
        setCategories(categoryData.categories);
      }

      // Cache all data for instant loads on navigation
      setCacheData(
        expenseData.expenses,
        categoryData.error ? categories : categoryData.categories,
      );
    } catch (error) {
      console.error('Error fetching data:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to fetch data',
      });
    }
  }, [categories, dispatch, session?.accessToken]);

  // Fetch initial data
  useEffect(() => {
    if (status === 'authenticated' && session?.accessToken) {
      // If we have cached data, fetch in background without blocking UI
      const hasCachedData = getCachedExpenses() !== null;
      fetchData(!hasCachedData);
    } else if (status === 'unauthenticated') {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [status, session?.accessToken, fetchData]);

  // Expense operations
  const addExpense = useCallback(
    async (expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
      const expenseYear = new Date(expenseData.date).getFullYear();

      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          data: expenseData,
          year: expenseYear,
        }),
      });

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      dispatch({ type: 'ADD_EXPENSE', payload: result.expense });
      // Update cache with new expense
      const updatedExpenses = [result.expense, ...state.expenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      updateExpensesCache(updatedExpenses);
    },
    [state.expenses]
  );

  const updateExpense = useCallback(
    async (expense: Expense) => {
      const expenseYear = new Date(expense.date).getFullYear();

      const res = await fetch('/api/drive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expense',
          data: expense,
          year: expenseYear,
        }),
      });

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      dispatch({ type: 'UPDATE_EXPENSE', payload: result.expense });
      // Update cache
      const updatedExpenses = state.expenses
        .map((e) => (e.id === result.expense.id ? result.expense : e))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      updateExpensesCache(updatedExpenses);
    },
    [state.expenses]
  );

  const deleteExpense = useCallback(
    async (id: string) => {
      const res = await fetch(
        `/api/drive?type=expense&id=${id}`,
        { method: 'DELETE' }
      );

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      dispatch({ type: 'DELETE_EXPENSE', payload: id });
      // Update cache
      const updatedExpenses = state.expenses.filter((e) => e.id !== id);
      updateExpensesCache(updatedExpenses);
    },
    [state.expenses]
  );

  const refreshExpenses = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Category operations
  const addCategory = useCallback(
    async (categoryData: Omit<Category, 'id'>): Promise<Category | undefined> => {
      const currentYear = new Date().getFullYear();

      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          data: categoryData,
          year: currentYear,
        }),
      });

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setCategories((prev) => {
        const updated = [...prev, result.category];
        updateCategoriesCache(updated);
        return updated;
      });

      return result.category as Category;
    },
    []
  );

  const updateCategory = useCallback(
    async (category: Category) => {
      const currentYear = new Date().getFullYear();

      const res = await fetch('/api/drive', {
        method: 'PUT',
        headers: { 'Content-Type': 'application' },
        body: JSON.stringify({
          type: 'category',
          data: category,
          year: currentYear,
        }),
      });

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setCategories((prev) => {
        const updated = prev.map((c) => (c.id === category.id ? result.category : c));
        updateCategoriesCache(updated);
        return updated;
      });
    },
    []
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const currentYear = new Date().getFullYear();

      const res = await fetch(
        `/api/drive?type=category&id=${id}&year=${currentYear}`,
        { method: 'DELETE' }
      );

      const result = await res.json();
      if (result.error) {
        throw new Error(result.error);
      }

      setCategories((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        updateCategoriesCache(updated);
        return updated;
      });
    },
    []
  );

  const refreshCategories = useCallback(async () => {
    const currentYear = new Date().getFullYear();

    const res = await fetch(`/api/drive?type=categories&year=${currentYear}`);
    const data = await res.json();

    if (!data.error) {
      setCategories(data.categories);
    }
  }, []);

  const expenseContextValue: ExpenseContextType = {
    state,
    dispatch,
    addExpense,
    updateExpense,
    deleteExpense,
    refreshExpenses,
  };

  const categoryContextValue: CategoryContextType = {
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    refreshCategories,
  };

  return (
    <ExpenseContext.Provider value={expenseContextValue}>
      <CategoryContext.Provider value={categoryContextValue}>
        {children}
      </CategoryContext.Provider>
    </ExpenseContext.Provider>
  );
}

// Hooks
export function useExpenses() {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within a DataProvider');
  }
  return context;
}

export function useCategories() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategories must be used within a DataProvider');
  }
  return context;
}
