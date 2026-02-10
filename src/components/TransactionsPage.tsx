'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Upload,
  Check,
  EyeOff,
  Eye,
  Trash2,
  Loader2,
  Settings2,
  CheckSquare,
  Square,
  Sparkles,
  ArrowLeft,
  Pencil,
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
import { GmailSyncButton } from '@/components/GmailSyncButton';
import { useGmailSync } from '@/hooks/useGmailSync';
import { PendingTransaction, Category, CurrencyCode, CategorySource } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { bouncySpring } from '@/lib/animations';

function CategoryBadge({ source }: { source?: CategorySource }) {
  if (!source) return null;
  const config: Record<string, { bg: string; text: string; label: string }> = {
    rule: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', label: 'Rule' },
    ai: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', label: 'AI' },
    manual: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', label: 'Manual' },
  };
  const c = config[source];
  if (!c) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function InlineEditDescription({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    } else {
      setDraft(value);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className="text-xs text-text-primary bg-transparent border-b border-[var(--accent)] outline-none w-full py-0.5"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className="flex items-center gap-1 group text-left w-full min-w-0"
    >
      <span className="text-xs text-text-primary truncate block">{value}</span>
      <Pencil className="w-2.5 h-2.5 text-text-muted opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
    </button>
  );
}

function TransactionRow({
  transaction,
  categories,
  currency,
  localCategory,
  localDescription,
  isSelected,
  onToggleSelect,
  onCategoryChange,
  onDescriptionChange,
  onIgnore,
  onUnignore,
  onDelete,
  isIgnoredView,
}: {
  transaction: PendingTransaction;
  categories: Category[];
  currency: CurrencyCode;
  localCategory?: string;
  localDescription?: string;
  isSelected: boolean;
  onToggleSelect: () => void;
  onCategoryChange: (categoryId: string) => void;
  onDescriptionChange: (desc: string) => void;
  onIgnore: () => void;
  onUnignore: () => void;
  onDelete: () => void;
  isIgnoredView: boolean;
}) {
  const finalCategory = localCategory || transaction.category;
  const category = categories.find((c) => c.id === finalCategory);
  const effectiveSource: CategorySource | undefined = localCategory
    ? 'manual'
    : transaction.categorySource;
  const displayDescription = localDescription ?? transaction.description;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 border-b border-glass-separator text-sm hover:bg-black/[0.04] transition-colors ${
        isSelected ? 'bg-white/[0.04]' : ''
      }`}
    >
      {!isIgnoredView && (
        <button onClick={onToggleSelect} className="p-1 hover:bg-surface rounded">
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-text-primary" />
          ) : (
            <Square className="w-4 h-4 text-text-muted" />
          )}
        </button>
      )}
      <span className="text-text-muted w-20 flex-shrink-0 text-xs">
        {formatDate(transaction.date)}
      </span>
      <div className="flex-1 min-w-0">
        {isIgnoredView ? (
          <span className="text-xs text-text-primary truncate block">
            {displayDescription}
          </span>
        ) : (
          <InlineEditDescription
            value={displayDescription}
            onChange={onDescriptionChange}
          />
        )}
        {transaction.source && (
          <span className="text-[10px] text-text-muted truncate block">
            {transaction.source}
          </span>
        )}
      </div>
      <span className="text-text-primary font-medium w-16 text-right flex-shrink-0 text-xs font-mono">
        {formatCurrency(transaction.amount, currency)}
      </span>

      {isIgnoredView ? (
        <div className="w-28 flex-shrink-0">
          {category ? (
            <div className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: category.color }}
              />
              <span className="text-xs text-text-secondary truncate">{category.name}</span>
            </div>
          ) : (
            <span className="text-xs text-text-muted">&mdash;</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Select
            value={finalCategory || '_none'}
            onValueChange={(v) => onCategoryChange(v === '_none' ? '' : v)}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue>
                {category ? (
                  <div className="flex items-center gap-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: category.color }}
                    />
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
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {effectiveSource && <CategoryBadge source={effectiveSource} />}
        </div>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        {isIgnoredView ? (
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
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(categoryId);
              onClose();
            }}
            disabled={!categoryId}
          >
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
  const { state: expenseState, refreshExpenses } = useExpenses();
  const {
    pendingTransactions,
    rules,
    isLoading,
    ignoreTransaction,
    unignoreTransaction,
    deleteTransaction,
    aiCategorize,
    refreshPendingTransactions,
  } = usePendingTransactions();
  const { settings } = useSettings();
  const { toast } = useToast();
  const { isSyncing, progress, triggerSync } = useGmailSync();

  const [showIgnored, setShowIgnored] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;

  // Local overrides (not persisted until Confirm)
  const [localCategories, setLocalCategories] = useState<Map<string, string>>(new Map());
  const [localDescriptions, setLocalDescriptions] = useState<Map<string, string>>(new Map());

  // Split transactions into active (pending) and ignored
  const { active, ignored } = useMemo(() => {
    const act: PendingTransaction[] = [];
    const ign: PendingTransaction[] = [];
    for (const t of pendingTransactions) {
      if (t.status === 'ignored') ign.push(t);
      else act.push(t);
    }
    return { active: act, ignored: ign };
  }, [pendingTransactions]);

  const fullList = showIgnored ? ignored : active;
  const totalPages = Math.ceil(fullList.length / PAGE_SIZE);
  const currentList = fullList.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Count categorized (from any source or local override)
  const categorizedCount = useMemo(() => {
    return active.filter((t) => localCategories.get(t.id) || t.category).length;
  }, [active, localCategories]);

  const uncategorizedCount = active.length - categorizedCount;
  const totalAmount = fullList.reduce((sum, t) => sum + t.amount, 0);

  // Selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    () => setSelectedIds(new Set(currentList.map((t) => t.id))),
    [currentList]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Local category change
  const handleCategoryChange = useCallback((id: string, categoryId: string) => {
    setLocalCategories((prev) => {
      const next = new Map(prev);
      if (categoryId) next.set(id, categoryId);
      else next.delete(id);
      return next;
    });
  }, []);

  // Local description change
  const handleDescriptionChange = useCallback((id: string, desc: string) => {
    setLocalDescriptions((prev) => {
      const next = new Map(prev);
      next.set(id, desc);
      return next;
    });
  }, []);

  // Bulk category
  const handleBulkCategory = (categoryId: string) => {
    setLocalCategories((prev) => {
      const next = new Map(prev);
      Array.from(selectedIds).forEach(id => next.set(id, categoryId));
      return next;
    });
    toast({
      title: 'Updated',
      description: `${selectedIds.size} transactions categorized`,
      variant: 'success',
    });
    clearSelection();
  };

  // AI Suggest
  const handleAiSuggest = async () => {
    const toSuggest = active.filter(
      (t) => !t.category && !localCategories.has(t.id) && t.categorySource !== 'rule'
    );
    if (toSuggest.length === 0) {
      toast({
        title: 'All categorized',
        description: 'No uncategorized transactions to suggest for',
      });
      return;
    }

    setAiSuggesting(true);
    try {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const recentExpenses = expenseState.expenses
        .filter((e) => new Date(e.date) >= twoMonthsAgo)
        .slice(0, 50)
        .map((e) => ({
          description: e.description,
          amount: e.amount,
          category: e.category,
        }));

      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ai-categorize',
          data: {
            transactions: toSuggest.map((t) => ({
              id: t.id,
              description: t.description,
              amount: t.amount,
            })),
            recentExpenses,
            categories: categories.map((c) => ({ id: c.id, name: c.name })),
          },
        }),
      });

      if (!response.ok) throw new Error('AI categorization failed');
      const result = await response.json();

      if (result.suggestions?.length > 0) {
        await aiCategorize(result.suggestions);
        toast({
          title: 'AI Suggestions',
          description: `Categorized ${result.suggestions.length} transactions`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'No suggestions',
          description: 'AI could not categorize these transactions',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'AI categorization failed',
        variant: 'destructive',
      });
    } finally {
      setAiSuggesting(false);
    }
  };

  // Confirm All categorized
  const handleConfirmAll = async () => {
    const toConfirm = active.filter((t) => {
      const finalCat = localCategories.get(t.id) || t.category;
      return !!finalCat;
    });
    if (toConfirm.length === 0) return;

    setSaving(true);
    try {
      const expensesData = toConfirm.map((t) => ({
        amount: t.amount,
        date: t.date,
        category: localCategories.get(t.id) || t.category!,
        description: localDescriptions.get(t.id) || t.description,
      }));

      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expenses-batch', data: expensesData }),
      });
      if (!response.ok) throw new Error('Failed to save');

      const confirmedIds = new Set(toConfirm.map((t) => t.id));
      const remaining = pendingTransactions.filter((t) => !confirmedIds.has(t.id));
      await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'pending-update-all',
          data: remaining,
          year: new Date().getFullYear(),
        }),
      });

      setLocalCategories(new Map());
      setLocalDescriptions(new Map());
      await Promise.all([refreshPendingTransactions(), refreshExpenses()]);
      toast({
        title: 'Confirmed',
        description: `${toConfirm.length} expenses saved`,
        variant: 'success',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to confirm transactions',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Ignore / Unignore / Delete
  const handleIgnore = async (id: string) => {
    try {
      await ignoreTransaction(id);
      setLocalCategories((prev) => { const n = new Map(prev); n.delete(id); return n; });
      setLocalDescriptions((prev) => { const n = new Map(prev); n.delete(id); return n; });
    } catch {
      toast({ title: 'Error', description: 'Failed to ignore', variant: 'destructive' });
    }
  };

  const handleUnignore = async (id: string) => {
    try {
      await unignoreTransaction(id);
    } catch {
      toast({ title: 'Error', description: 'Failed to restore', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      setLocalCategories((prev) => { const n = new Map(prev); n.delete(id); return n; });
      setLocalDescriptions((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  // Pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(totalPages - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="max-w-app mx-auto px-4 md:px-6 py-6">
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {showIgnored ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIgnored(false)}
                className="-ml-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h2 className="text-lg font-semibold text-text-primary">Ignored</h2>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {active.length} pending
              {uncategorizedCount > 0 ? ` · ${uncategorizedCount} uncategorized` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!showIgnored && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowIgnored(true);
                clearSelection();
              }}
            >
              <EyeOff className="w-4 h-4 mr-1" />
              Ignored ({ignored.length})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/settings/rules')}
          >
            <Settings2 className="w-4 h-4 mr-1" />
            Rules ({rules.length})
          </Button>
          {settings.gmailSyncEnabled && (
            <GmailSyncButton isSyncing={isSyncing} progress={progress} onTrigger={triggerSync} />
          )}
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
        </div>
      </div>

      {/* Actions Bar */}
      {currentList.length > 0 && (
        <div className="flex items-center justify-between mb-3 p-2.5 glass-tab-bar text-sm">
          <div className="flex items-center gap-3">
            <span className="text-text-muted">
              Total:{' '}
              <span className="font-medium text-text-primary font-mono">
                {formatCurrency(totalAmount, settings.currency)}
              </span>
            </span>
            {!showIgnored && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="h-7 text-xs"
                >
                  Select All
                </Button>
                {selectedIds.size > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="h-7 text-xs"
                    >
                      Clear ({selectedIds.size})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkCategoryOpen(true)}
                      className="h-7 text-xs"
                    >
                      Categorize Selected
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          {!showIgnored && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAiSuggest}
                disabled={aiSuggesting || uncategorizedCount === 0}
                className="h-7"
              >
                {aiSuggesting ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="w-3 h-3 mr-1" />
                )}
                AI Suggest
              </Button>
              {categorizedCount > 0 && (
                <Button
                  size="sm"
                  onClick={handleConfirmAll}
                  disabled={saving}
                  className="h-7"
                >
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Check className="w-3 h-3 mr-1" />
                  )}
                  Confirm All ({categorizedCount})
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Transaction Table */}
      <div className="glass-card overflow-hidden">
        {/* Table Header */}
        <div className="px-3 py-2 border-b border-[var(--glass-separator)] flex items-center gap-2 text-xs text-text-muted font-medium">
          {!showIgnored && <span className="w-6" />}
          <span className="w-20">Date</span>
          <span className="flex-1">Description</span>
          <span className="w-16 text-right">Amount</span>
          <span className={showIgnored ? 'w-28' : 'w-32'}>Category</span>
          <span className="w-16">Actions</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">
              {showIgnored ? 'No ignored transactions' : 'No pending transactions'}
            </p>
            {!showIgnored && pendingTransactions.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            )}
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {currentList.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                currency={settings.currency}
                localCategory={localCategories.get(transaction.id)}
                localDescription={localDescriptions.get(transaction.id)}
                isSelected={selectedIds.has(transaction.id)}
                onToggleSelect={() => toggleSelect(transaction.id)}
                onCategoryChange={(catId) =>
                  handleCategoryChange(transaction.id, catId)
                }
                onDescriptionChange={(desc) =>
                  handleDescriptionChange(transaction.id, desc)
                }
                onIgnore={() => handleIgnore(transaction.id)}
                onUnignore={() => handleUnignore(transaction.id)}
                onDelete={() => handleDelete(transaction.id)}
                isIgnoredView={showIgnored}
              />
            ))}
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
              <span key={`ellipsis-${i}`} className="px-2 text-text-muted">
                ...
              </span>
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
            {(currentPage - 1) * PAGE_SIZE + 1}-
            {Math.min(currentPage * PAGE_SIZE, fullList.length)} of {fullList.length}
          </span>
        </div>
      )}

      {/* Dialogs */}
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
      <BulkCategoryDialog
        open={bulkCategoryOpen}
        onClose={() => setBulkCategoryOpen(false)}
        selectedCount={selectedIds.size}
        categories={categories}
        onApply={handleBulkCategory}
      />
    </div>
  );
}
