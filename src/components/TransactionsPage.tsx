'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Upload,
  Check,
  X,
  EyeOff,
  Eye,
  Trash2,
  Loader2,
  Settings2,
  CheckSquare,
  Square,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCategories, useExpenses } from '@/context/ExpenseContext';
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { ImportWizard } from '@/components/ImportWizard';
import { PendingTransaction, Category, CurrencyCode } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { bouncySpring } from '@/lib/animations';

type TabId = 'auto-mapped' | 'uncategorized' | 'ignored';

function TransactionRow({
  transaction,
  categories,
  currency,
  isSelected,
  onToggleSelect,
  onCategoryChange,
  onIgnore,
  onUnignore,
  onDelete,
  onConfirm,
  showCheckbox,
  showCategoryPicker,
  showUnignore,
  showConfirm,
}: {
  transaction: PendingTransaction;
  categories: Category[];
  currency: CurrencyCode;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCategoryChange?: (categoryId: string) => void;
  onIgnore?: () => void;
  onUnignore?: () => void;
  onDelete?: () => void;
  onConfirm?: () => void;
  showCheckbox?: boolean;
  showCategoryPicker?: boolean;
  showUnignore?: boolean;
  showConfirm?: boolean;
}) {
  const category = categories.find((c) => c.id === transaction.category);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 border-b border-border text-sm hover:bg-surface-hover ${
        isSelected ? 'bg-accent/5' : ''
      }`}
    >
      {showCheckbox && (
        <button onClick={onToggleSelect} className="p-1 hover:bg-surface rounded">
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-accent" />
          ) : (
            <Square className="w-4 h-4 text-text-muted" />
          )}
        </button>
      )}
      <span className="text-text-muted w-20 flex-shrink-0 text-xs">{formatDate(transaction.date)}</span>
      <span className="flex-1 text-text-primary truncate text-xs">{transaction.description}</span>
      <span className="text-text-primary font-medium w-16 text-right flex-shrink-0 text-xs">
        {formatCurrency(transaction.amount, currency)}
      </span>

      {showCategoryPicker ? (
        <Select
          value={transaction.category || '_none'}
          onValueChange={(v) => onCategoryChange?.(v === '_none' ? '' : v)}
        >
          <SelectTrigger className="h-7 w-24 text-xs flex-shrink-0">
            <SelectValue>
              {category ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="truncate text-xs">{category.name}</span>
                </div>
              ) : (
                <span className="text-text-muted text-xs">Select</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">None</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : category ? (
        <div className="flex items-center gap-1 w-24 flex-shrink-0">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="text-xs text-text-secondary truncate">{category.name}</span>
        </div>
      ) : (
        <span className="w-24 flex-shrink-0" />
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        {showConfirm && transaction.category && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onConfirm}
            className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Check className="w-3 h-3" />
          </Button>
        )}
        {showUnignore ? (
          <Button size="sm" variant="ghost" onClick={onUnignore} className="h-6 w-6 p-0">
            <Eye className="w-3 h-3" />
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={onIgnore} className="h-6 w-6 p-0">
            <EyeOff className="w-3 h-3" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// Bulk Category Dialog
function BulkCategoryDialog({
  open,
  onClose,
  selectedCount,
  categories,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  categories: Category[];
  onApply: (categoryId: string) => void;
}) {
  const [categoryId, setCategoryId] = useState('');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Categorize {selectedCount} Transactions</DialogTitle>
        </DialogHeader>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onApply(categoryId); onClose(); }} disabled={!categoryId}>
            Apply to {selectedCount}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionsPage() {
  const router = useRouter();
  const { categories } = useCategories();
  const { refreshExpenses } = useExpenses();
  const {
    pendingTransactions,
    rules,
    isLoading,
    confirmTransaction,
    confirmAllAutoMapped,
    ignoreTransaction,
    unignoreTransaction,
    deleteTransaction,
    refreshPendingTransactions,
  } = usePendingTransactions();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('uncategorized');
  const [importOpen, setImportOpen] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingMapped, setSavingMapped] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;

  // Local UI state for category selections (not saved until Save button clicked)
  const [localCategories, setLocalCategories] = useState<Map<string, string>>(new Map());

  // Split transactions by status
  const { autoMapped, uncategorized, ignored } = useMemo(() => {
    const auto: PendingTransaction[] = [];
    const uncat: PendingTransaction[] = [];
    const ign: PendingTransaction[] = [];

    for (const t of pendingTransactions) {
      if (t.status === 'ignored') {
        ign.push(t);
      } else if (t.status === 'auto-mapped') {
        auto.push(t);
      } else {
        uncat.push(t);
      }
    }

    return { autoMapped: auto, uncategorized: uncat, ignored: ign };
  }, [pendingTransactions]);

  // Count mapped in uncategorized (have local category selection)
  const mappedInUncategorized = useMemo(() => {
    return uncategorized.filter((t) => localCategories.has(t.id)).length;
  }, [uncategorized, localCategories]);

  const fullList =
    activeTab === 'auto-mapped' ? autoMapped : activeTab === 'uncategorized' ? uncategorized : ignored;

  // Pagination
  const totalPages = Math.ceil(fullList.length / PAGE_SIZE);
  const currentList = fullList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(currentList.map((t) => t.id)));
  }, [currentList]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleConfirm = async (id: string) => {
    try {
      await confirmTransaction(id);
      // Refresh expense list so home page shows the new expense
      await refreshExpenses();
      toast({ title: 'Added', description: 'Transaction saved as expense', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to confirm transaction', variant: 'destructive' });
    }
  };

  const handleConfirmAll = async () => {
    if (autoMapped.length === 0) return;
    setSavingMapped(true);
    try {
      await confirmAllAutoMapped();
      // Refresh expense list so home page shows the new expenses
      await refreshExpenses();
      toast({ title: 'Added', description: `${autoMapped.length} transactions saved as expenses`, variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to confirm transactions', variant: 'destructive' });
    } finally {
      setSavingMapped(false);
    }
  };

  // Save manually mapped uncategorized transactions directly to expenses
  const handleSaveMapped = async () => {
    const entries = Array.from(localCategories.entries());
    if (entries.length === 0) {
      toast({ title: 'Nothing to save', description: 'Select categories first', variant: 'destructive' });
      return;
    }

    // Get transactions that have local category selections
    const toSave = pendingTransactions.filter((t) => localCategories.has(t.id));
    if (toSave.length === 0) {
      toast({ title: 'Nothing to save', description: 'No matching transactions', variant: 'destructive' });
      return;
    }

    setSavingMapped(true);
    try {
      // Batch save to expenses API
      const expensesData = toSave.map((t) => ({
        amount: t.amount,
        date: t.date,
        category: localCategories.get(t.id) || '',
        description: t.description || '',
      }));

      // Validate data
      const invalidItems = expensesData.filter((e) => !e.date || !e.category || e.amount === undefined);
      if (invalidItems.length > 0) {
        toast({ title: 'Error', description: 'Some transactions have missing data', variant: 'destructive' });
        setSavingMapped(false);
        return;
      }

      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expenses-batch', data: expensesData }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save');
      }

      // Delete saved transactions from pending
      const year = new Date().getFullYear();
      const savedIds = new Set(toSave.map((t) => t.id));
      const remaining = pendingTransactions.filter((t) => !savedIds.has(t.id));

      await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'pending-update-all', data: remaining, year }),
      });

      // Clear local state and refresh from server
      setLocalCategories(new Map());
      // Refresh both pending transactions and expenses list
      await Promise.all([
        refreshPendingTransactions(),
        refreshExpenses(),
      ]);
      toast({ title: 'Saved', description: `${toSave.length} expenses saved`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to save expenses', variant: 'destructive' });
    } finally {
      setSavingMapped(false);
    }
  };

  // Update local state only - no API call until Save
  const handleCategoryChange = useCallback((id: string, categoryId: string) => {
    setLocalCategories((prev) => {
      const next = new Map(prev);
      if (categoryId) {
        next.set(id, categoryId);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  // Update local state only for bulk categorization
  const handleBulkCategory = (categoryId: string) => {
    const selectedArray = Array.from(selectedIds);
    setLocalCategories((prev) => {
      const next = new Map(prev);
      for (const id of selectedArray) {
        next.set(id, categoryId);
      }
      return next;
    });
    toast({ title: 'Updated', description: `${selectedArray.length} transactions categorized`, variant: 'success' });
    clearSelection();
  };

  const handleIgnore = async (id: string) => {
    try {
      await ignoreTransaction(id);
      // Clear local category for this transaction
      setLocalCategories((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to ignore transaction', variant: 'destructive' });
    }
  };

  const handleUnignore = async (id: string) => {
    try {
      await unignoreTransaction(id);
    } catch {
      toast({ title: 'Error', description: 'Failed to restore transaction', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      // Clear local category for this transaction
      setLocalCategories((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete transaction', variant: 'destructive' });
    }
  };

  const tabs = [
    { id: 'auto-mapped' as const, label: 'Auto-mapped', count: autoMapped.length },
    {
      id: 'uncategorized' as const,
      label: 'Uncategorized',
      count: uncategorized.length,
      badge: mappedInUncategorized > 0 ? `${mappedInUncategorized} Mapped` : undefined
    },
    { id: 'ignored' as const, label: 'Ignored', count: ignored.length },
  ];

  const totalAmount = fullList.reduce((sum, t) => sum + t.amount, 0);
  const selectedCount = selectedIds.size;

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="max-w-app mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Transactions</h1>
          <p className="text-sm text-text-muted">{pendingTransactions.length} pending</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings/rules')}>
            <Settings2 className="w-4 h-4 mr-1" />
            Rules ({rules.length})
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg mb-3">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            type="button"
            onClick={() => { setActiveTab(tab.id); clearSelection(); setCurrentPage(1); }}
            whileTap={{ scale: 0.98 }}
            transition={bouncySpring}
            className={`flex-1 py-2 px-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`ml-1 text-xs ${activeTab === tab.id ? 'text-accent' : ''}`}>
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="ml-1 text-xs text-green-600 font-medium">
                ({tab.badge})
              </span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Actions Bar */}
      {currentList.length > 0 && (
        <div className="flex items-center justify-between mb-3 p-2 bg-surface rounded-lg text-sm">
          <div className="flex items-center gap-3">
            <span className="text-text-muted">
              Total: <span className="font-medium text-text-primary">{formatCurrency(totalAmount, settings.currency)}</span>
            </span>
            {activeTab === 'uncategorized' && (
              <>
                <Button variant="ghost" size="sm" onClick={selectAll} className="h-7 text-xs">
                  Select All
                </Button>
                {selectedCount > 0 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={clearSelection} className="h-7 text-xs">
                      Clear ({selectedCount})
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setBulkCategoryOpen(true)} className="h-7 text-xs">
                      Categorize Selected
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'auto-mapped' && autoMapped.length > 0 && (
              <Button size="sm" onClick={handleConfirmAll} disabled={savingMapped} className="h-7">
                {savingMapped ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                Confirm All ({autoMapped.length})
              </Button>
            )}
            {activeTab === 'uncategorized' && mappedInUncategorized > 0 && (
              <Button size="sm" onClick={handleSaveMapped} disabled={savingMapped} className="h-7">
                {savingMapped ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                Save {mappedInUncategorized} Mapped
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="border border-border rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-surface px-3 py-2 border-b border-border flex items-center gap-2 text-xs text-text-muted font-medium">
          {activeTab === 'uncategorized' && <span className="w-6" />}
          <span className="w-20">Date</span>
          <span className="flex-1">Description</span>
          <span className="w-16 text-right">Amount</span>
          <span className="w-24">Category</span>
          <span className="w-20">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">
              {activeTab === 'auto-mapped'
                ? 'No auto-mapped transactions. Create rules to auto-categorize imports.'
                : activeTab === 'uncategorized'
                ? 'No uncategorized transactions'
                : 'No ignored transactions'}
            </p>
            {activeTab === 'auto-mapped' && rules.length === 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/settings/rules')}>
                <Settings2 className="w-4 h-4 mr-2" />
                Create Rules
              </Button>
            )}
            {pendingTransactions.length === 0 && activeTab !== 'auto-mapped' && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            )}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {currentList.map((transaction, index) => {
              const localCat = localCategories.get(transaction.id);
              const displayTransaction = localCat
                ? { ...transaction, category: localCat }
                : transaction;

              return (
                <TransactionRow
                  key={transaction.id}
                  transaction={displayTransaction}
                  categories={categories}
                  currency={settings.currency}
                  isSelected={selectedIds.has(transaction.id)}
                  onToggleSelect={() => toggleSelect(transaction.id)}
                  onCategoryChange={(catId) => handleCategoryChange(transaction.id, catId)}
                  onIgnore={() => handleIgnore(transaction.id)}
                  onUnignore={() => handleUnignore(transaction.id)}
                  onDelete={() => handleDelete(transaction.id)}
                  onConfirm={() => handleConfirm(transaction.id)}
                  showCheckbox={activeTab === 'uncategorized'}
                  showCategoryPicker={activeTab === 'uncategorized'}
                  showUnignore={activeTab === 'ignored'}
                  showConfirm={activeTab === 'auto-mapped'}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-8 px-2"
          >
            Prev
          </Button>
          {getPageNumbers().map((page, i) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-text-muted">...</span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className="h-8 w-8 p-0"
              >
                {page}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-8 px-2"
          >
            Next
          </Button>
          <span className="text-xs text-text-muted ml-2">
            {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, fullList.length)} of {fullList.length}
          </span>
        </div>
      )}

      {/* Dialogs */}
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkCategoryDialog
        open={bulkCategoryOpen}
        onClose={() => setBulkCategoryOpen(false)}
        selectedCount={selectedCount}
        categories={categories}
        onApply={handleBulkCategory}
      />
    </div>
  );
}
