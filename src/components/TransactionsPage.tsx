'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Check,
  X,
  MoreHorizontal,
  EyeOff,
  Eye,
  Trash2,
  Plus,
  Loader2,
  BookmarkPlus,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/context/ExpenseContext';
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import { ImportWizard } from '@/components/ImportWizard';
import { PendingTransaction, Category, RuleMatchType, CurrencyCode } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { smoothSpring, bouncySpring } from '@/lib/animations';
import { MATCH_TYPES } from '@/lib/ruleEngine';

type TabId = 'auto-mapped' | 'uncategorized' | 'ignored';

function TransactionRow({
  transaction,
  categories,
  currency,
  onConfirm,
  onCategoryChange,
  onIgnore,
  onUnignore,
  onDelete,
  onSaveAsRule,
  showConfirm,
  showCategoryPicker,
  showUnignore,
}: {
  transaction: PendingTransaction;
  categories: Category[];
  currency: CurrencyCode;
  onConfirm?: () => void;
  onCategoryChange?: (categoryId: string) => void;
  onIgnore?: () => void;
  onUnignore?: () => void;
  onDelete?: () => void;
  onSaveAsRule?: (description: string, categoryId: string) => void;
  showConfirm?: boolean;
  showCategoryPicker?: boolean;
  showUnignore?: boolean;
}) {
  const category = categories.find((c) => c.id === transaction.category);
  const [selectedCategory, setSelectedCategory] = useState(transaction.category || '');

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    onCategoryChange?.(categoryId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ backgroundColor: 'var(--surface-hover)' }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-b-0 text-sm"
    >
      <span className="text-text-muted w-20 flex-shrink-0">{transaction.date}</span>
      <span className="flex-1 text-text-primary break-words min-w-0">{transaction.description}</span>
      <span className="text-text-primary font-medium w-20 text-right flex-shrink-0">
        {formatCurrency(transaction.amount, currency)}
      </span>

      {showCategoryPicker ? (
        <Select value={selectedCategory || '_none'} onValueChange={handleCategorySelect}>
          <SelectTrigger className="h-7 w-28 text-xs flex-shrink-0">
            <SelectValue>
              {selectedCategory && categories.find((c) => c.id === selectedCategory) ? (
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: categories.find((c) => c.id === selectedCategory)?.color }}
                  />
                  <span className="truncate">{categories.find((c) => c.id === selectedCategory)?.name}</span>
                </div>
              ) : (
                <span className="text-text-muted">Select</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
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
        <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
          <span className="text-xs text-text-secondary truncate">{category.name}</span>
        </div>
      ) : (
        <span className="w-28 flex-shrink-0" />
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        {showConfirm && transaction.category && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onConfirm}
            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <Check className="w-4 h-4" />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {showCategoryPicker && selectedCategory && (
              <DropdownMenuItem onClick={() => onSaveAsRule?.(transaction.description, selectedCategory)}>
                <BookmarkPlus className="w-4 h-4 mr-2" />
                Save as Rule
              </DropdownMenuItem>
            )}
            {showUnignore ? (
              <DropdownMenuItem onClick={onUnignore}>
                <Eye className="w-4 h-4 mr-2" />
                Unignore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onIgnore}>
                <EyeOff className="w-4 h-4 mr-2" />
                Ignore
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

function RulesDialog({
  open,
  onClose,
  rules,
  categories,
  onDeleteRule,
  onToggleRule,
}: {
  open: boolean;
  onClose: () => void;
  rules: { id: string; pattern: string; matchType: RuleMatchType; categoryId: string; enabled: boolean }[];
  categories: Category[];
  onDeleteRule: (id: string) => void;
  onToggleRule: (rule: { id: string; pattern: string; matchType: RuleMatchType; categoryId: string; enabled: boolean; createdAt: string }) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Category Rules</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {rules.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">
              No rules yet. Create rules by categorizing transactions and clicking &quot;Save as Rule&quot;.
            </p>
          ) : (
            rules.map((rule) => {
              const category = categories.find((c) => c.id === rule.categoryId);
              return (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                    rule.enabled ? 'border-border bg-surface' : 'border-border/50 bg-surface/50 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">
                        {MATCH_TYPES.find((m) => m.value === rule.matchType)?.label}:
                      </span>
                      <span className="text-sm font-medium text-text-primary truncate">&quot;{rule.pattern}&quot;</span>
                    </div>
                    {category && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                        <span className="text-xs text-text-secondary">{category.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToggleRule({ ...rule, createdAt: '' })}
                      className="h-7 w-7 p-0"
                    >
                      {rule.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteRule(rule.id)}
                      className="h-7 w-7 p-0 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SaveRuleDialog({
  open,
  onClose,
  description,
  categoryId,
  categories,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  description: string;
  categoryId: string;
  categories: Category[];
  onSave: (pattern: string, matchType: RuleMatchType, categoryId: string) => void;
}) {
  const [pattern, setPattern] = useState(description);
  const [matchType, setMatchType] = useState<RuleMatchType>('contains');
  const [saving, setSaving] = useState(false);
  const category = categories.find((c) => c.id === categoryId);

  const handleSave = async () => {
    if (!pattern.trim()) return;
    setSaving(true);
    try {
      await onSave(pattern.trim(), matchType, categoryId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Save as Rule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Pattern to match</label>
            <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Enter pattern" />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Match type</label>
            <Select value={matchType} onValueChange={(v) => setMatchType(v as RuleMatchType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1 block">Category</label>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-surface">
              {category && (
                <>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="text-sm">{category.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !pattern.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TransactionsPage() {
  const { categories } = useCategories();
  const {
    pendingTransactions,
    rules,
    isLoading,
    confirmTransaction,
    confirmAllAutoMapped,
    updateTransactionCategory,
    ignoreTransaction,
    unignoreTransaction,
    deleteTransaction,
    addRule,
    updateRule,
    deleteRule,
  } = usePendingTransactions();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('uncategorized');
  const [importOpen, setImportOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [saveRuleData, setSaveRuleData] = useState<{ description: string; categoryId: string } | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  // Split transactions by status
  const { autoMapped, uncategorized, ignored } = useMemo(() => {
    const auto: PendingTransaction[] = [];
    const uncat: PendingTransaction[] = [];
    const ign: PendingTransaction[] = [];

    for (const t of pendingTransactions) {
      if (t.status === 'auto-mapped') auto.push(t);
      else if (t.status === 'ignored') ign.push(t);
      else uncat.push(t);
    }

    return { autoMapped: auto, uncategorized: uncat, ignored: ign };
  }, [pendingTransactions]);

  const currentList =
    activeTab === 'auto-mapped' ? autoMapped : activeTab === 'uncategorized' ? uncategorized : ignored;

  const handleConfirm = async (id: string) => {
    try {
      await confirmTransaction(id);
      toast({ title: 'Added', description: 'Transaction saved as expense', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to confirm transaction', variant: 'destructive' });
    }
  };

  const handleConfirmAll = async () => {
    if (autoMapped.length === 0) return;
    setConfirmingAll(true);
    try {
      await confirmAllAutoMapped();
      toast({ title: 'Added', description: `${autoMapped.length} transactions saved as expenses`, variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to confirm transactions', variant: 'destructive' });
    } finally {
      setConfirmingAll(false);
    }
  };

  const handleCategoryChange = async (id: string, categoryId: string) => {
    try {
      await updateTransactionCategory(id, categoryId);
    } catch {
      toast({ title: 'Error', description: 'Failed to update category', variant: 'destructive' });
    }
  };

  const handleIgnore = async (id: string) => {
    try {
      await ignoreTransaction(id);
      toast({ title: 'Ignored', description: 'Transaction moved to ignored', variant: 'default' });
    } catch {
      toast({ title: 'Error', description: 'Failed to ignore transaction', variant: 'destructive' });
    }
  };

  const handleUnignore = async (id: string) => {
    try {
      await unignoreTransaction(id);
      toast({ title: 'Restored', description: 'Transaction moved to uncategorized', variant: 'default' });
    } catch {
      toast({ title: 'Error', description: 'Failed to restore transaction', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast({ title: 'Deleted', description: 'Transaction removed', variant: 'default' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete transaction', variant: 'destructive' });
    }
  };

  const handleSaveRule = async (pattern: string, matchType: RuleMatchType, categoryId: string) => {
    try {
      await addRule({ pattern, matchType, categoryId, enabled: true });
      toast({ title: 'Rule saved', description: 'Future transactions will be auto-categorized', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save rule', variant: 'destructive' });
    }
  };

  const handleToggleRule = async (rule: { id: string; pattern: string; matchType: RuleMatchType; categoryId: string; enabled: boolean; createdAt: string }) => {
    try {
      await updateRule({ ...rule, enabled: !rule.enabled });
    } catch {
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id);
      toast({ title: 'Deleted', description: 'Rule removed', variant: 'default' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    }
  };

  const tabs = [
    { id: 'auto-mapped' as const, label: 'Auto-mapped', count: autoMapped.length },
    { id: 'uncategorized' as const, label: 'Uncategorized', count: uncategorized.length },
    { id: 'ignored' as const, label: 'Ignored', count: ignored.length },
  ];

  const totalAmount = currentList.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="max-w-app mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Transactions</h1>
          <p className="text-sm text-text-muted">
            {pendingTransactions.length} pending transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setRulesOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Rules ({rules.length})
          </Button>
          <Button size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface rounded-lg mb-4">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={bouncySpring}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <motion.span
                key={tab.count}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                className={`ml-1.5 text-xs ${activeTab === tab.id ? 'text-accent' : 'text-text-muted'}`}
              >
                {tab.count}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Summary & Actions */}
      {currentList.length > 0 && (
        <div className="flex items-center justify-between mb-4 p-3 bg-surface rounded-lg">
          <div>
            <span className="text-sm text-text-muted">Total: </span>
            <span className="text-sm font-medium text-text-primary">
              {formatCurrency(totalAmount, settings.currency)}
            </span>
          </div>
          {activeTab === 'auto-mapped' && autoMapped.length > 0 && (
            <Button size="sm" onClick={handleConfirmAll} disabled={confirmingAll}>
              {confirmingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Confirm All ({autoMapped.length})
            </Button>
          )}
        </div>
      )}

      {/* Transaction List */}
      <div className="border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-accent" />
          </div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted text-sm">
              {activeTab === 'auto-mapped'
                ? 'No auto-mapped transactions'
                : activeTab === 'uncategorized'
                ? 'No uncategorized transactions'
                : 'No ignored transactions'}
            </p>
            {pendingTransactions.length === 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setImportOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import CSV
              </Button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {currentList.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                categories={categories}
                currency={settings.currency}
                onConfirm={() => handleConfirm(transaction.id)}
                onCategoryChange={(catId) => handleCategoryChange(transaction.id, catId)}
                onIgnore={() => handleIgnore(transaction.id)}
                onUnignore={() => handleUnignore(transaction.id)}
                onDelete={() => handleDelete(transaction.id)}
                onSaveAsRule={(desc, catId) => setSaveRuleData({ description: desc, categoryId: catId })}
                showConfirm={activeTab === 'auto-mapped'}
                showCategoryPicker={activeTab === 'uncategorized'}
                showUnignore={activeTab === 'ignored'}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Dialogs */}
      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
      <RulesDialog
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        rules={rules}
        categories={categories}
        onDeleteRule={handleDeleteRule}
        onToggleRule={handleToggleRule}
      />
      {saveRuleData && (
        <SaveRuleDialog
          open={!!saveRuleData}
          onClose={() => setSaveRuleData(null)}
          description={saveRuleData.description}
          categoryId={saveRuleData.categoryId}
          categories={categories}
          onSave={handleSaveRule}
        />
      )}
    </div>
  );
}
