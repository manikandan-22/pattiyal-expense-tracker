'use client';

import { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { PendingTransaction, TransactionRule, PendingTransactionsContextType } from '@/types';
import { applyRulesToTransactions, applyNewRuleToTransactions } from '@/lib/ruleEngine';

const PENDING_CACHE_KEY = 'expense-tracker-pending';
const RULES_CACHE_KEY = 'expense-tracker-rules';

interface State {
  pendingTransactions: PendingTransaction[];
  rules: TransactionRule[];
  isLoading: boolean;
}

type Action =
  | { type: 'SET_PENDING'; payload: PendingTransaction[] }
  | { type: 'SET_RULES'; payload: TransactionRule[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_PENDING'; payload: PendingTransaction[] }
  | { type: 'UPDATE_PENDING'; payload: PendingTransaction }
  | { type: 'DELETE_PENDING'; payload: string }
  | { type: 'ADD_RULE'; payload: TransactionRule }
  | { type: 'UPDATE_RULE'; payload: TransactionRule }
  | { type: 'DELETE_RULE'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PENDING':
      return { ...state, pendingTransactions: action.payload };
    case 'SET_RULES':
      return { ...state, rules: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'ADD_PENDING':
      return { ...state, pendingTransactions: [...state.pendingTransactions, ...action.payload] };
    case 'UPDATE_PENDING':
      return {
        ...state,
        pendingTransactions: state.pendingTransactions.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    case 'DELETE_PENDING':
      return {
        ...state,
        pendingTransactions: state.pendingTransactions.filter((t) => t.id !== action.payload),
      };
    case 'ADD_RULE':
      return { ...state, rules: [...state.rules, action.payload] };
    case 'UPDATE_RULE':
      return {
        ...state,
        rules: state.rules.map((r) => (r.id === action.payload.id ? action.payload : r)),
      };
    case 'DELETE_RULE':
      return { ...state, rules: state.rules.filter((r) => r.id !== action.payload) };
    default:
      return state;
  }
}

const PendingTransactionsContext = createContext<PendingTransactionsContextType | null>(null);

export function PendingTransactionsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const [state, dispatch] = useReducer(reducer, {
    pendingTransactions: [],
    rules: [],
    isLoading: true,
  });

  // Load data on mount
  useEffect(() => {
    if (!session) return;

    const loadData = async () => {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Load from cache first
      const cachedPending = sessionStorage.getItem(PENDING_CACHE_KEY);
      const cachedRules = sessionStorage.getItem(RULES_CACHE_KEY);

      if (cachedPending) {
        dispatch({ type: 'SET_PENDING', payload: JSON.parse(cachedPending) });
      }
      if (cachedRules) {
        dispatch({ type: 'SET_RULES', payload: JSON.parse(cachedRules) });
      }

      try {
        const year = new Date().getFullYear();
        const [pendingRes, rulesRes] = await Promise.all([
          fetch(`/api/drive?type=pending&year=${year}`),
          fetch(`/api/drive?type=rules&year=${year}`),
        ]);

        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          if (pendingData.pendingTransactions) {
            dispatch({ type: 'SET_PENDING', payload: pendingData.pendingTransactions });
            sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(pendingData.pendingTransactions));
          }
        }

        if (rulesRes.ok) {
          const rulesData = await rulesRes.json();
          if (rulesData.rules) {
            dispatch({ type: 'SET_RULES', payload: rulesData.rules });
            sessionStorage.setItem(RULES_CACHE_KEY, JSON.stringify(rulesData.rules));
          }
        }
      } catch (error) {
        console.error('Error loading pending transactions/rules:', error);
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    loadData();
  }, [session]);

  const refreshPendingTransactions = useCallback(async () => {
    if (!session) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const year = new Date().getFullYear();
      const [pendingRes, rulesRes] = await Promise.all([
        fetch(`/api/drive?type=pending&year=${year}`),
        fetch(`/api/drive?type=rules&year=${year}`),
      ]);

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        if (pendingData.pendingTransactions) {
          dispatch({ type: 'SET_PENDING', payload: pendingData.pendingTransactions });
          sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(pendingData.pendingTransactions));
        }
      }

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        if (rulesData.rules) {
          dispatch({ type: 'SET_RULES', payload: rulesData.rules });
          sessionStorage.setItem(RULES_CACHE_KEY, JSON.stringify(rulesData.rules));
        }
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [session]);

  const addPendingTransactions = useCallback(
    async (transactions: Omit<PendingTransaction, 'id' | 'createdAt'>[]) => {
      if (!session) return;

      try {
        const year = new Date().getFullYear();
        const response = await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pending-batch', data: transactions, year }),
        });

        const result = await response.json();
        if (result.pendingTransactions) {
          // Apply rules to new transactions
          const withRules = applyRulesToTransactions(result.pendingTransactions, state.rules);
          dispatch({ type: 'ADD_PENDING', payload: withRules });

          // Update cache
          const newPending = [...state.pendingTransactions, ...withRules];
          sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(newPending));

          // Save updated transactions with rules applied
          await fetch('/api/drive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'pending-update-all', data: newPending, year }),
          });
        }
      } catch (error) {
        console.error('Error adding pending transactions:', error);
        throw error;
      }
    },
    [session, state.rules, state.pendingTransactions]
  );

  const confirmTransaction = useCallback(
    async (id: string) => {
      if (!session) return;

      const transaction = state.pendingTransactions.find((t) => t.id === id);
      if (!transaction || !transaction.category) return;

      try {
        // Add to expenses
        await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'expense',
            data: {
              amount: transaction.amount,
              date: transaction.date,
              category: transaction.category,
              description: transaction.description,
            },
          }),
        });

        // Delete from pending
        const year = new Date().getFullYear();
        await fetch(`/api/drive?type=pending&id=${id}&year=${year}`, {
          method: 'DELETE',
        });

        dispatch({ type: 'DELETE_PENDING', payload: id });

        // Update cache
        const newPending = state.pendingTransactions.filter((t) => t.id !== id);
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(newPending));
      } catch (error) {
        console.error('Error confirming transaction:', error);
        throw error;
      }
    },
    [session, state.pendingTransactions]
  );

  const confirmAllAutoMapped = useCallback(async () => {
    if (!session) return;

    const autoMapped = state.pendingTransactions.filter(
      (t) => t.status === 'auto-mapped' && t.category
    );
    if (autoMapped.length === 0) return;

    try {
      // Add all to expenses
      await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expenses-batch',
          data: autoMapped.map((t) => ({
            amount: t.amount,
            date: t.date,
            category: t.category,
            description: t.description,
          })),
        }),
      });

      // Update pending transactions (remove confirmed ones)
      const remaining = state.pendingTransactions.filter((t) => t.status !== 'auto-mapped');
      const year = new Date().getFullYear();

      await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pending-update-all', data: remaining, year }),
      });

      dispatch({ type: 'SET_PENDING', payload: remaining });
      sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(remaining));
    } catch (error) {
      console.error('Error confirming all auto-mapped:', error);
      throw error;
    }
  }, [session, state.pendingTransactions]);

  const updateTransactionCategory = useCallback(
    async (id: string, categoryId: string) => {
      if (!session) return;

      const transaction = state.pendingTransactions.find((t) => t.id === id);
      if (!transaction) return;

      const updated: PendingTransaction = {
        ...transaction,
        category: categoryId,
        status: 'auto-mapped', // Moves to auto-mapped once categorized
      };

      try {
        const year = new Date().getFullYear();
        await fetch('/api/drive', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pending', data: updated, year }),
        });

        dispatch({ type: 'UPDATE_PENDING', payload: updated });

        // Update cache
        const newPending = state.pendingTransactions.map((t) => (t.id === id ? updated : t));
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(newPending));
      } catch (error) {
        console.error('Error updating transaction category:', error);
        throw error;
      }
    },
    [session, state.pendingTransactions]
  );

  const ignoreTransaction = useCallback(
    async (id: string) => {
      if (!session) return;

      const transaction = state.pendingTransactions.find((t) => t.id === id);
      if (!transaction) return;

      const updated: PendingTransaction = {
        ...transaction,
        status: 'ignored',
      };

      try {
        const year = new Date().getFullYear();
        await fetch('/api/drive', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pending', data: updated, year }),
        });

        dispatch({ type: 'UPDATE_PENDING', payload: updated });

        // Update cache
        const newPending = state.pendingTransactions.map((t) => (t.id === id ? updated : t));
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(newPending));
      } catch (error) {
        console.error('Error ignoring transaction:', error);
        throw error;
      }
    },
    [session, state.pendingTransactions]
  );

  const unignoreTransaction = useCallback(
    async (id: string) => {
      if (!session) return;

      const transaction = state.pendingTransactions.find((t) => t.id === id);
      if (!transaction) return;

      const updated: PendingTransaction = {
        ...transaction,
        status: 'uncategorized',
        category: undefined,
        matchedRuleId: undefined,
      };

      try {
        const year = new Date().getFullYear();
        await fetch('/api/drive', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pending', data: updated, year }),
        });

        dispatch({ type: 'UPDATE_PENDING', payload: updated });

        // Update cache
        const newPending = state.pendingTransactions.map((t) => (t.id === id ? updated : t));
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(newPending));
      } catch (error) {
        console.error('Error unignoring transaction:', error);
        throw error;
      }
    },
    [session, state.pendingTransactions]
  );

  const deleteTransaction = useCallback(
    async (id: string) => {
      if (!session) return;

      try {
        const year = new Date().getFullYear();
        await fetch(`/api/drive?type=pending&id=${id}&year=${year}`, {
          method: 'DELETE',
        });

        dispatch({ type: 'DELETE_PENDING', payload: id });

        // Update cache
        const newPending = state.pendingTransactions.filter((t) => t.id !== id);
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(newPending));
      } catch (error) {
        console.error('Error deleting transaction:', error);
        throw error;
      }
    },
    [session, state.pendingTransactions]
  );

  const addRule = useCallback(
    async (rule: Omit<TransactionRule, 'id' | 'createdAt'>) => {
      if (!session) return undefined;

      try {
        const year = new Date().getFullYear();
        const response = await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'rule', data: rule, year }),
        });

        const result = await response.json();
        if (result.rule) {
          dispatch({ type: 'ADD_RULE', payload: result.rule });

          // Update rules cache
          const newRules = [...state.rules, result.rule];
          sessionStorage.setItem(RULES_CACHE_KEY, JSON.stringify(newRules));

          // Apply new rule to uncategorized transactions
          const updatedPending = applyNewRuleToTransactions(state.pendingTransactions, result.rule);
          dispatch({ type: 'SET_PENDING', payload: updatedPending });
          sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(updatedPending));

          // Save updated pending transactions
          await fetch('/api/drive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'pending-update-all', data: updatedPending, year }),
          });

          return result.rule;
        }
      } catch (error) {
        console.error('Error adding rule:', error);
        throw error;
      }
    },
    [session, state.rules, state.pendingTransactions]
  );

  const updateRule = useCallback(
    async (rule: TransactionRule) => {
      if (!session) return;

      try {
        const year = new Date().getFullYear();
        const newRules = state.rules.map((r) => (r.id === rule.id ? rule : r));

        await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'rules-save', data: newRules, year }),
        });

        dispatch({ type: 'UPDATE_RULE', payload: rule });
        sessionStorage.setItem(RULES_CACHE_KEY, JSON.stringify(newRules));

        // Re-apply all rules to pending transactions
        const updatedPending = applyRulesToTransactions(state.pendingTransactions, newRules);
        dispatch({ type: 'SET_PENDING', payload: updatedPending });
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(updatedPending));

        await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pending-update-all', data: updatedPending, year }),
        });
      } catch (error) {
        console.error('Error updating rule:', error);
        throw error;
      }
    },
    [session, state.rules, state.pendingTransactions]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      if (!session) return;

      try {
        const year = new Date().getFullYear();
        const newRules = state.rules.filter((r) => r.id !== id);

        await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'rules-save', data: newRules, year }),
        });

        dispatch({ type: 'DELETE_RULE', payload: id });
        sessionStorage.setItem(RULES_CACHE_KEY, JSON.stringify(newRules));

        // Re-apply remaining rules to pending transactions
        const updatedPending = applyRulesToTransactions(state.pendingTransactions, newRules);
        dispatch({ type: 'SET_PENDING', payload: updatedPending });
        sessionStorage.setItem(PENDING_CACHE_KEY, JSON.stringify(updatedPending));

        await fetch('/api/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'pending-update-all', data: updatedPending, year }),
        });
      } catch (error) {
        console.error('Error deleting rule:', error);
        throw error;
      }
    },
    [session, state.rules, state.pendingTransactions]
  );

  return (
    <PendingTransactionsContext.Provider
      value={{
        pendingTransactions: state.pendingTransactions,
        rules: state.rules,
        isLoading: state.isLoading,
        addPendingTransactions,
        confirmTransaction,
        confirmAllAutoMapped,
        updateTransactionCategory,
        ignoreTransaction,
        unignoreTransaction,
        deleteTransaction,
        addRule,
        updateRule,
        deleteRule,
        refreshPendingTransactions,
      }}
    >
      {children}
    </PendingTransactionsContext.Provider>
  );
}

export function usePendingTransactions() {
  const context = useContext(PendingTransactionsContext);
  if (!context) {
    throw new Error('usePendingTransactions must be used within PendingTransactionsProvider');
  }
  return context;
}
