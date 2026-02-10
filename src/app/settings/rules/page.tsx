'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  X,
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
import { useCategories } from '@/context/ExpenseContext';
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useToast } from '@/hooks/useToast';
import {
  TransactionRule,
  RuleCondition,
  RuleField,
  RuleMatchType,
  AmountMatchType,
  RuleLogicMode,
} from '@/types';
import {
  TEXT_MATCH_TYPES,
  AMOUNT_MATCH_TYPES,
  RULE_FIELDS,
  LOGIC_MODES,
  getMatchTypeLabel,
} from '@/lib/ruleEngine';
import { v4 as uuidv4 } from 'uuid';

interface ConditionEditorProps {
  condition: RuleCondition;
  onChange: (condition: RuleCondition) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ConditionEditor({ condition, onChange, onRemove, canRemove }: ConditionEditorProps) {
  const isAmountField = condition.field === 'amount';
  const isBetween = condition.matchType === 'between';

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl" style={{ background: 'var(--bg-grouped-tertiary)' }}>
      <Select
        value={condition.field}
        onValueChange={(value: RuleField) => {
          const newMatchType = value === 'amount' ? 'equals' : 'contains';
          onChange({ ...condition, field: value, matchType: newMatchType, value: '', value2: undefined });
        }}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RULE_FIELDS.map((field) => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.matchType}
        onValueChange={(value: RuleMatchType | AmountMatchType) => {
          onChange({ ...condition, matchType: value, value2: value === 'between' ? '' : undefined });
        }}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(isAmountField ? AMOUNT_MATCH_TYPES : TEXT_MATCH_TYPES).map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type={isAmountField ? 'number' : 'text'}
        value={condition.value}
        onChange={(e) => onChange({ ...condition, value: e.target.value })}
        placeholder={isAmountField ? '0.00' : 'Value...'}
        className="flex-1 min-w-[120px]"
      />

      {isBetween && (
        <>
          <span className="text-text-muted text-sm">and</span>
          <Input
            type="number"
            value={condition.value2 || ''}
            onChange={(e) => onChange({ ...condition, value2: e.target.value })}
            placeholder="0.00"
            className="w-24"
          />
        </>
      )}

      {canRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-text-muted hover:text-error h-8 w-8"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

interface RuleEditorProps {
  rule?: TransactionRule;
  onSave: (rule: Omit<TransactionRule, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}

function RuleEditor({ rule, onSave, onCancel }: RuleEditorProps) {
  const { categories } = useCategories();
  const [name, setName] = useState(rule?.name || '');
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions || [{ id: uuidv4(), field: 'description', matchType: 'contains', value: '' }]
  );
  const [logicMode, setLogicMode] = useState<RuleLogicMode>(rule?.logicMode || 'all');
  const [categoryId, setCategoryId] = useState(rule?.categoryId || '');
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: uuidv4(), field: 'description', matchType: 'contains', value: '' },
    ]);
  };

  const updateCondition = (index: number, updated: RuleCondition) => {
    const newConditions = [...conditions];
    newConditions[index] = updated;
    setConditions(newConditions);
  };

  const removeCondition = (index: number) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((_, i) => i !== index));
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !categoryId || conditions.some((c) => !c.value.trim())) {
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        conditions,
        logicMode,
        categoryId,
        enabled,
      });
    } finally {
      setSaving(false);
    }
  };

  const isValid = name.trim() && categoryId && conditions.every((c) => c.value.trim());

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">Rule Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Grocery Stores"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-text-secondary">Conditions</label>
          <Button variant="ghost" size="sm" onClick={addCondition} className="h-7">
            <Plus className="w-3 h-3 mr-1" /> Add Condition
          </Button>
        </div>

        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={condition.id}>
              {index > 0 && (
                <div className="flex items-center justify-center py-1">
                  <span className="text-xs text-text-muted font-medium px-2 py-0.5 bg-surface rounded">
                    {logicMode === 'all' ? 'AND' : 'OR'}
                  </span>
                </div>
              )}
              <ConditionEditor
                condition={condition}
                onChange={(updated) => updateCondition(index, updated)}
                onRemove={() => removeCondition(index)}
                canRemove={conditions.length > 1}
              />
            </div>
          ))}
        </div>

        {conditions.length > 1 && (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-sm text-text-secondary">Match when:</span>
            <Select value={logicMode} onValueChange={(v: RuleLogicMode) => setLogicMode(v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGIC_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-text-secondary">Assign Category</label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Select category">
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
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="rule-enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
        />
        <label htmlFor="rule-enabled" className="text-sm text-text-secondary">
          Rule enabled
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!isValid || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {rule ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: TransactionRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const { categories } = useCategories();
  const [expanded, setExpanded] = useState(false);
  const category = categories.find((c) => c.id === rule.categoryId);

  return (
    <div
      className={`glass-card overflow-hidden transition-colors ${
        rule.enabled ? '' : 'opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 p-4">
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={onToggle}
          className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${rule.enabled ? '' : 'text-text-muted'}`}>
              {rule.name}
            </span>
            {category && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: category.color + '30', color: category.color }}
              >
                {category.icon} {category.name}
              </span>
            )}
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
            {rule.conditions.length > 1 && ` (${rule.logicMode === 'all' ? 'all must match' : 'any can match'})`}
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)} className="h-8 w-8">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8">
          <Edit2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-text-muted hover:text-error"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-2 border-t border-border">
              <div className="pt-3 text-xs text-text-muted uppercase tracking-wider">Conditions</div>
              {rule.conditions.map((condition, index) => (
                <div key={condition.id}>
                  {index > 0 && (
                    <div className="text-xs text-text-muted text-center py-1">
                      {rule.logicMode === 'all' ? 'AND' : 'OR'}
                    </div>
                  )}
                  <div className="text-sm bg-surface-hover rounded px-3 py-2">
                    <span className="font-medium">{condition.field}</span>
                    <span className="text-text-muted mx-2">{getMatchTypeLabel(condition.matchType)}</span>
                    <span className="font-mono bg-background px-1.5 py-0.5 rounded">{condition.value}</span>
                    {condition.matchType === 'between' && condition.value2 && (
                      <>
                        <span className="text-text-muted mx-2">and</span>
                        <span className="font-mono bg-background px-1.5 py-0.5 rounded">{condition.value2}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RulesPage() {
  const router = useRouter();
  const { status } = useSession();
  const { toast } = useToast();
  const { rules, isLoading, addRule, updateRule, deleteRule } = usePendingTransactions();
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleCreateRule = async (ruleData: Omit<TransactionRule, 'id' | 'createdAt'>) => {
    try {
      await addRule(ruleData);
      setIsCreating(false);
      toast({ title: 'Rule created', description: 'New categorization rule has been added', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to create rule', variant: 'destructive' });
    }
  };

  const handleUpdateRule = async (ruleData: Omit<TransactionRule, 'id' | 'createdAt'>) => {
    if (!editingRule) return;
    try {
      await updateRule({ ...editingRule, ...ruleData });
      setEditingRule(null);
      toast({ title: 'Rule updated', description: 'Categorization rule has been updated', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (id: string) => {
    try {
      await deleteRule(id);
      setDeleteConfirmId(null);
      toast({ title: 'Rule deleted', description: 'Categorization rule has been removed', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    }
  };

  const handleToggleRule = async (rule: TransactionRule) => {
    try {
      await updateRule({ ...rule, enabled: !rule.enabled });
    } catch {
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="min-h-screen ios26-bg">
      <header className="">
        <div className="max-w-app mx-auto px-5 md:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/settings')}
                className="p-2 -ml-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </button>
              <h1 className="text-xl font-semibold text-text-primary">Categorization Rules</h1>
            </div>
            <Button onClick={() => setIsCreating(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" /> New Rule
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-app mx-auto px-4 md:px-6 py-6">
        <p className="text-text-secondary mb-6">
          Rules automatically categorize imported transactions based on conditions you define.
        </p>

        {rules.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
            <p className="mb-4">No rules created yet</p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Your First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => setEditingRule(rule)}
                onDelete={() => setDeleteConfirmId(rule.id)}
                onToggle={() => handleToggleRule(rule)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Rule Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Rule</DialogTitle>
          </DialogHeader>
          <RuleEditor onSave={handleCreateRule} onCancel={() => setIsCreating(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Rule Dialog */}
      <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rule</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <RuleEditor
              rule={editingRule}
              onSave={handleUpdateRule}
              onCancel={() => setEditingRule(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Rule?</DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary">
            This will remove the rule. Transactions already categorized by this rule will keep their category.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteRule(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
