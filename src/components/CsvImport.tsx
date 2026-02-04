'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, X, Loader2, Check, Upload, Settings2, ListChecks } from 'lucide-react';
// FileText removed - PDF support disabled
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCategories } from '@/context/ExpenseContext';
import { useSettings } from '@/context/SettingsContext';
import { useToast } from '@/hooks/useToast';
import {
  parseCSV,
  detectColumnMapping,
  parseCsvTransactions,
} from '@/lib/csvParser';
import { CsvTransaction, Category, CurrencyCode } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { smoothSpring, bouncySpring } from '@/lib/animations';

const CATEGORY_COLORS = [
  '#86EFAC', '#93C5FD', '#FED7AA', '#C4B5FD', '#FBCFE8',
  '#FEF08A', '#99F6E4', '#FDA4AF', '#A5B4FC', '#D9F99D',
];

interface CsvImportProps {
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep = 1 | 2 | 3;
type ReviewTab = 'categorized' | 'uncategorized' | 'manual';

// Wizard Step Indicator
function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps = [
    { num: 1, label: 'Upload', icon: Upload },
    { num: 2, label: 'Map Columns', icon: Settings2 },
    { num: 3, label: 'Review', icon: ListChecks },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = currentStep === step.num;
        const isComplete = currentStep > step.num;

        return (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isActive ? 'var(--accent)' : isComplete ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--surface)',
                }}
                transition={bouncySpring}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'text-white'
                    : isComplete
                    ? 'text-accent'
                    : 'text-text-muted'
                }`}
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: isComplete ? 360 : 0 }}
                  transition={{ duration: 0.4 }}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </motion.div>
              </motion.div>
              <span className={`text-xs mt-1 ${isActive ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <motion.div
                initial={false}
                animate={{
                  scaleX: isComplete ? 1 : 0.3,
                  backgroundColor: isComplete ? 'var(--accent)' : 'var(--border)'
                }}
                transition={smoothSpring}
                className="w-12 h-0.5 mx-2 mb-4 origin-left"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Skeleton loader
function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
          <div className="h-4 w-20 bg-surface rounded" />
          <div className="h-4 flex-1 bg-surface rounded" />
          <div className="h-4 w-16 bg-surface rounded" />
          <div className="h-6 w-24 bg-surface rounded" />
        </div>
      ))}
    </div>
  );
}

// Transaction row
function TransactionRow({
  transaction,
  categories,
  currency,
  onCategoryChange,
  showCategoryPicker = false,
}: {
  transaction: CsvTransaction;
  categories: Category[];
  currency: CurrencyCode;
  onCategoryChange?: (categoryId: string) => void;
  showCategoryPicker?: boolean;
}) {
  const category = categories.find(c => c.id === transaction.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ backgroundColor: 'var(--surface-hover)' }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 px-3 py-3 border-b border-border last:border-b-0 text-sm">
      <span className="text-text-muted w-20 flex-shrink-0">{transaction.date}</span>
      <span className="flex-1 text-text-primary break-words">{transaction.description}</span>
      <span className="text-text-primary font-medium w-20 text-right flex-shrink-0">
        {formatCurrency(transaction.amount, currency)}
      </span>
      {showCategoryPicker && onCategoryChange ? (
        <Select
          value={transaction.category || '_none'}
          onValueChange={(v) => onCategoryChange(v === '_none' ? '' : v)}
        >
          <SelectTrigger className="h-7 w-28 text-xs flex-shrink-0">
            <SelectValue>
              {category ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                  <span className="truncate">{category.name}</span>
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
    </motion.div>
  );
}

export function CsvImport({ onComplete, onCancel }: CsvImportProps) {
  const { categories, addCategory } = useCategories();
  const { settings } = useSettings();
  const { toast } = useToast();

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  // PDF disabled: const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv');

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState({
    date: -1,
    description: -1,
    amount: -1,
    category: -1,
  });

  // Transaction state
  const [transactions, setTransactions] = useState<CsvTransaction[]>([]);
  const [manuallyAssigned, setManuallyAssigned] = useState<Set<string>>(() => new Set());

  // Category mapping state
  const [csvCategories, setCsvCategories] = useState<string[]>([]);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  // Review tab state
  const [activeTab, setActiveTab] = useState<ReviewTab>('uncategorized');
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);

  // Computed transaction lists
  const categorizedList = useMemo(() => {
    return transactions.filter(t => {
      if (manuallyAssigned.has(t.id)) return false;
      return t.category && categories.some(c => c.id === t.category);
    });
  }, [transactions, manuallyAssigned, categories]);

  const uncategorizedList = useMemo(() => {
    return transactions.filter(t => {
      if (manuallyAssigned.has(t.id)) return false;
      return !t.category || !categories.some(c => c.id === t.category);
    });
  }, [transactions, manuallyAssigned, categories]);

  const manualList = useMemo(() => {
    return transactions.filter(t => manuallyAssigned.has(t.id));
  }, [transactions, manuallyAssigned]);

  // CSV file upload handler
  const handleCsvSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    // PDF disabled: setFileType('csv');
    try {
      const content = await file.text();
      const { headers, rows } = parseCSV(content);

      if (rows.length === 0) {
        throw new Error('No data found in CSV');
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      const mapping = detectColumnMapping(headers);
      const catIndex = mapping?.categoryIndex ?? -1;

      setColumnMapping({
        date: mapping?.dateIndex ?? 0,
        description: mapping?.descriptionIndex ?? Math.min(1, headers.length - 1),
        amount: mapping?.amountIndex ?? Math.min(2, headers.length - 1),
        category: catIndex,
      });

      // Extract categories if detected
      if (catIndex !== -1) {
        const uniqueCats = Array.from(new Set(
          rows.map(row => row[catIndex]?.trim()).filter(Boolean)
        ));
        setCsvCategories(uniqueCats);

        // Auto-map matching categories
        const autoMapping: Record<string, string> = {};
        for (const csvCat of uniqueCats) {
          const match = categories.find(
            c => c.id.toLowerCase() === csvCat.toLowerCase() ||
                 c.name.toLowerCase() === csvCat.toLowerCase()
          );
          if (match) autoMapping[csvCat] = match.id;
        }
        setCategoryMapping(autoMapping);
      }

      setWizardStep(2);
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to parse CSV',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast, categories]);

  // File upload handler (CSV only - PDF disabled)
  const handleFileSelect = useCallback(async (file: File) => {
    const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
    if (isCsv) {
      await handleCsvSelect(file);
    } else {
      toast({ title: 'Invalid file', description: 'Please select a CSV file', variant: 'destructive' });
    }
  }, [handleCsvSelect, toast]);

  // Column change handler
  const handleColumnChange = useCallback((key: string, value: number) => {
    setColumnMapping(prev => ({ ...prev, [key]: value }));

    if (key === 'category') {
      if (value === -1) {
        setCsvCategories([]);
        setCategoryMapping({});
      } else {
        const uniqueCats = Array.from(new Set(
          csvRows.map(row => row[value]?.trim()).filter(Boolean)
        ));
        setCsvCategories(uniqueCats);

        const autoMapping: Record<string, string> = {};
        for (const csvCat of uniqueCats) {
          const match = categories.find(
            c => c.id.toLowerCase() === csvCat.toLowerCase() ||
                 c.name.toLowerCase() === csvCat.toLowerCase()
          );
          if (match) autoMapping[csvCat] = match.id;
        }
        setCategoryMapping(autoMapping);
      }
    }
  }, [csvRows, categories]);

  // Process and go to review
  const handleContinueToReview = useCallback(() => {
    if (columnMapping.description === -1 || columnMapping.amount === -1) {
      toast({ title: 'Required', description: 'Please select Description and Amount columns', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setIsLoadingReview(true);

    // Use setTimeout to allow UI to update before heavy processing
    setTimeout(() => {
      const parsed = parseCsvTransactions(csvRows, {
        dateIndex: columnMapping.date,
        descriptionIndex: columnMapping.description,
        amountIndex: columnMapping.amount,
        categoryIndex: columnMapping.category !== -1 ? columnMapping.category : undefined,
      });

      if (parsed.length === 0) {
        setIsProcessing(false);
        setIsLoadingReview(false);
        toast({ title: 'No transactions', description: 'Could not parse any transactions', variant: 'destructive' });
        return;
      }

      // Apply category mapping
      const mappedTransactions = parsed.map(t => {
        if (t.category) {
          const mappingKey = Object.keys(categoryMapping).find(
            k => k.toLowerCase() === t.category?.toLowerCase()
          );
          if (mappingKey && categoryMapping[mappingKey]) {
            return { ...t, category: categoryMapping[mappingKey] };
          }
        }
        return { ...t, category: undefined };
      });

      setTransactions(mappedTransactions);
      setManuallyAssigned(new Set());
      setIsProcessing(false);
      setWizardStep(3);
      setTimeout(() => setIsLoadingReview(false), 300);
    }, 50);
  }, [columnMapping, csvRows, categoryMapping, toast]);

  // Category assignment in review
  const handleCategoryAssign = useCallback((transactionId: string, categoryId: string) => {
    setTransactions(prev =>
      prev.map(t => t.id === transactionId ? { ...t, category: categoryId || undefined } : t)
    );
    if (categoryId) {
      setManuallyAssigned(prev => {
        const next = new Set(prev);
        next.add(transactionId);
        return next;
      });
    }
  }, []);

  // Create category
  const handleCreateCategory = useCallback(async () => {
    if (!newCategoryName.trim() || !creatingCategoryFor) return;

    setIsCreatingCategory(true);
    try {
      const newCategory = await addCategory({ name: newCategoryName.trim(), color: newCategoryColor });
      if (newCategory) {
        setCategoryMapping(prev => ({ ...prev, [creatingCategoryFor]: newCategory.id }));
        toast({ title: 'Created', description: `"${newCategoryName}" added`, variant: 'success' });
        setCreatingCategoryFor(null);
        setNewCategoryName('');
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create category', variant: 'destructive' });
    } finally {
      setIsCreatingCategory(false);
    }
  }, [newCategoryName, newCategoryColor, creatingCategoryFor, addCategory, toast]);

  // Import
  const handleImport = useCallback(async () => {
    setIsImporting(true);
    try {
      const toImport = transactions.filter(t => t.selected);
      const response = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'expenses-batch',
          data: toImport.map(t => ({
            amount: t.amount,
            date: t.date,
            category: t.category || 'other',
            description: t.description,
          })),
        }),
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      toast({ title: 'Success', description: `${toImport.length} expenses imported`, variant: 'success' });
      onComplete();
    } catch (err) {
      toast({ title: 'Failed', description: err instanceof Error ? err.message : 'Import failed', variant: 'destructive' });
      setIsImporting(false);
    }
  }, [transactions, toast, onComplete]);

  const selectedCount = transactions.filter(t => t.selected).length;

  return (
    <div className="space-y-4">
      <StepIndicator currentStep={wizardStep} />

      <AnimatePresence mode="wait">
        {/* Step 1: Upload */}
        {wizardStep === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              whileHover={{ scale: 1.01, borderColor: 'var(--accent)' }}
              whileTap={{ scale: 0.99 }}
              transition={smoothSpring}
              onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFileSelect(e.dataTransfer.files[0]); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => csvInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:bg-accent/5 transition-colors cursor-pointer"
            >
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              <motion.div
                animate={isProcessing ? { rotate: 360 } : { rotate: 0 }}
                transition={isProcessing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
              >
                {isProcessing ? (
                  <Loader2 className="w-10 h-10 mx-auto mb-3 text-accent" />
                ) : (
                  <motion.div
                    whileHover={{ y: -3 }}
                    transition={bouncySpring}
                  >
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-text-muted" />
                  </motion.div>
                )}
              </motion.div>
              <p className="text-sm font-medium text-text-primary">
                {isProcessing ? 'Processing...' : 'Drop CSV file here or click to browse'}
              </p>
              <p className="text-xs text-text-muted mt-1">Supports bank statement exports</p>
            </motion.div>
          </motion.div>
        )}

        {/* Step 2: Column Mapping */}
        {wizardStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Loading overlay */}
            {isProcessing && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                <p className="text-sm text-text-muted">Processing transactions...</p>
              </div>
            )}

            {/* Preview */}
            {!isProcessing && (
            <>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-surface px-3 py-2 border-b border-border">
                <span className="text-xs text-text-muted">Preview ({csvRows.length} rows)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface/50">
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left text-text-secondary font-medium whitespace-nowrap">
                          {h || `Col ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className="border-t border-border">
                        {csvHeaders.map((_, ci) => (
                          <td key={ci} className="px-3 py-2 text-text-primary">
                            {row[ci] || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Column selectors */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'date', label: 'Date' },
                { key: 'description', label: 'Description *' },
                { key: 'amount', label: 'Amount *' },
                { key: 'category', label: 'Category', optional: true },
              ].map(({ key, label, optional }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-text-secondary mb-1 block">{label}</label>
                  <Select
                    value={columnMapping[key as keyof typeof columnMapping].toString()}
                    onValueChange={(v) => handleColumnChange(key, parseInt(v))}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={optional ? 'None' : 'Select'} />
                    </SelectTrigger>
                    <SelectContent>
                      {optional && <SelectItem value="-1">None</SelectItem>}
                      {csvHeaders.map((h, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {h || `Column ${i + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Category mapping */}
            {csvCategories.length > 0 && (
              <div className="border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-text-secondary mb-2">Map CSV categories</p>
                <div className="space-y-2">
                  {csvCategories.map(csvCat => (
                    <div key={csvCat} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-text-primary truncate">{csvCat}</span>
                      <Popover
                        open={creatingCategoryFor === csvCat}
                        onOpenChange={(open) => !open && setCreatingCategoryFor(null)}
                      >
                        <PopoverTrigger asChild>
                          <div>
                            <Select
                              value={categoryMapping[csvCat] || '_skip'}
                              onValueChange={(v) => {
                                if (v === '_create') {
                                  setCreatingCategoryFor(csvCat);
                                  setNewCategoryName(csvCat);
                                  setNewCategoryColor(CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)]);
                                } else {
                                  setCategoryMapping(prev => ({ ...prev, [csvCat]: v === '_skip' ? '' : v }));
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue>
                                  {categoryMapping[csvCat] ? (
                                    <span>{categories.find(c => c.id === categoryMapping[csvCat])?.name}</span>
                                  ) : (
                                    <span className="text-text-muted">Skip</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_skip">Skip</SelectItem>
                                <SelectItem value="_create">
                                  <span className="text-accent">+ Create new</span>
                                </SelectItem>
                                {categories.map(c => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-56 p-3">
                          <p className="text-sm font-medium mb-2">New Category</p>
                          <Input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Name"
                            className="h-8 text-sm mb-2"
                            autoFocus
                          />
                          <div className="flex gap-1 mb-3">
                            {CATEGORY_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setNewCategoryColor(c)}
                                className={`w-5 h-5 rounded-full ${newCategoryColor === c ? 'ring-2 ring-accent ring-offset-1' : ''}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setCreatingCategoryFor(null)} className="flex-1 h-7">
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleCreateCategory} disabled={isCreatingCategory} className="flex-1 h-7">
                              {isCreatingCategory ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </>
            )}

            <div className="flex gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button variant="outline" onClick={() => setWizardStep(1)} disabled={isProcessing} className="w-full">
                  Back
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button onClick={handleContinueToReview} disabled={isProcessing} className="w-full">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {wizardStep === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Summary */}
            <div className="flex gap-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="flex-1 bg-surface rounded-lg p-3 text-center"
              >
                <motion.p
                  key={transactions.length}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-semibold text-text-primary"
                >
                  {transactions.length}
                </motion.p>
                <p className="text-xs text-text-muted">Transactions</p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02, y: -2 }}
                className="flex-1 bg-surface rounded-lg p-3 text-center"
              >
                <p className="text-2xl font-semibold text-text-primary">
                  {formatCurrency(transactions.reduce((s, t) => s + t.amount, 0), settings.currency)}
                </p>
                <p className="text-xs text-text-muted">Total</p>
              </motion.div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-surface rounded-lg relative">
              {[
                { id: 'categorized' as const, label: 'Categorized', count: categorizedList.length },
                { id: 'uncategorized' as const, label: 'Needs Review', count: uncategorizedList.length },
                { id: 'manual' as const, label: 'Manual', count: manualList.length },
              ].map(tab => (
                <motion.button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={bouncySpring}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors relative ${
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

            {/* Transaction Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-surface px-3 py-2 border-b border-border flex items-center gap-3 text-xs text-text-muted font-medium">
                <span className="w-20">Date</span>
                <span className="flex-1">Description</span>
                <span className="w-20 text-right">Amount</span>
                <span className="w-28">Category</span>
              </div>

              <div>
                {isLoadingReview ? (
                  <TableSkeleton rows={6} />
                ) : activeTab === 'categorized' ? (
                  categorizedList.length > 0 ? (
                    categorizedList.map(t => (
                      <TransactionRow
                        key={t.id}
                        transaction={t}
                        categories={categories}
                        currency={settings.currency}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-text-muted text-sm">No categorized transactions</div>
                  )
                ) : activeTab === 'uncategorized' ? (
                  uncategorizedList.length > 0 ? (
                    uncategorizedList.map(t => (
                      <TransactionRow
                        key={t.id}
                        transaction={t}
                        categories={categories}
                        currency={settings.currency}
                        showCategoryPicker
                        onCategoryChange={(catId) => handleCategoryAssign(t.id, catId)}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-text-muted text-sm">All transactions categorized!</div>
                  )
                ) : manualList.length > 0 ? (
                  manualList.map(t => (
                    <TransactionRow
                      key={t.id}
                      transaction={t}
                      categories={categories}
                      currency={settings.currency}
                    />
                  ))
                ) : (
                  <div className="p-8 text-center text-text-muted text-sm">No manually assigned categories yet</div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button variant="outline" onClick={() => setWizardStep(2)} className="w-full">
                  Back
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button onClick={handleImport} disabled={isImporting} className="w-full">
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${selectedCount} Expenses`
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isImporting && (
        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
          <Button variant="ghost" onClick={onCancel} className="w-full text-text-muted">
            <motion.span
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
              className="inline-flex"
            >
              <X className="w-4 h-4 mr-2" />
            </motion.span>
            Cancel
          </Button>
        </motion.div>
      )}
    </div>
  );
}
