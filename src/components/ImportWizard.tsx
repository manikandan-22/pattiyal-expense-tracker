'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, Loader2, Check, Upload, Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useToast } from '@/hooks/useToast';
import { parseCSV, detectColumnMapping, parseCsvTransactions } from '@/lib/csvParser';
import { PendingTransaction, Category } from '@/types';
import { smoothSpring, bouncySpring } from '@/lib/animations';

const CATEGORY_COLORS = [
  '#86EFAC', '#93C5FD', '#FED7AA', '#C4B5FD', '#FBCFE8',
  '#FEF08A', '#99F6E4', '#FDA4AF', '#A5B4FC', '#D9F99D',
];

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
}

type WizardStep = 1 | 2;

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps = [
    { num: 1, label: 'Upload', icon: Upload },
    { num: 2, label: 'Map Columns', icon: Settings2 },
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
                  isActive ? 'text-white' : isComplete ? 'text-accent' : 'text-text-muted'
                }`}
              >
                {isComplete ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
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

export function ImportWizard({ open, onClose }: ImportWizardProps) {
  const { categories, addCategory } = useCategories();
  const { addPendingTransactions, rules } = usePendingTransactions();
  const { toast } = useToast();

  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState({
    date: -1,
    description: -1,
    amount: -1,
    category: -1,
  });

  // Category mapping state
  const [csvCategories, setCsvCategories] = useState<string[]>([]);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = useCallback(() => {
    setWizardStep(1);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({ date: -1, description: -1, amount: -1, category: -1 });
    setCsvCategories([]);
    setCategoryMapping({});
    setIsProcessing(false);
  }, []);

  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  // CSV file upload handler
  const handleCsvSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
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

        // Auto-map matching categories (by name only, not ID)
        const autoMapping: Record<string, string> = {};
        for (const csvCat of uniqueCats) {
          const match = categories.find(
            c => c.name.toLowerCase().trim() === csvCat.toLowerCase().trim()
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

  const handleFileSelect = useCallback(async (file: File) => {
    const isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
    if (isCsv) {
      await handleCsvSelect(file);
    } else {
      toast({ title: 'Invalid file', description: 'Please select a CSV file', variant: 'destructive' });
    }
  }, [handleCsvSelect, toast]);

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
            c => c.name.toLowerCase().trim() === csvCat.toLowerCase().trim()
          );
          if (match) autoMapping[csvCat] = match.id;
        }
        setCategoryMapping(autoMapping);
      }
    }
  }, [csvRows, categories]);

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

  // Final import - sends to pending transactions
  const handleImport = useCallback(async () => {
    if (columnMapping.description === -1 || columnMapping.amount === -1) {
      toast({ title: 'Required', description: 'Please select Description and Amount columns', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);

    try {
      const parsed = parseCsvTransactions(csvRows, {
        dateIndex: columnMapping.date,
        descriptionIndex: columnMapping.description,
        amountIndex: columnMapping.amount,
        categoryIndex: columnMapping.category !== -1 ? columnMapping.category : undefined,
      });

      if (parsed.length === 0) {
        toast({ title: 'No transactions', description: 'Could not parse any transactions', variant: 'destructive' });
        setIsProcessing(false);
        return;
      }

      // Convert to pending transactions
      const pendingTransactions: Omit<PendingTransaction, 'id' | 'createdAt'>[] = parsed.map(t => {
        // Apply category mapping from CSV
        let category: string | undefined;
        if (t.category) {
          const mappingKey = Object.keys(categoryMapping).find(
            k => k.toLowerCase() === t.category?.toLowerCase()
          );
          if (mappingKey && categoryMapping[mappingKey]) {
            category = categoryMapping[mappingKey];
          }
        }

        return {
          date: t.date,
          description: t.description,
          amount: t.amount,
          category,
          status: 'uncategorized' as const,
        };
      });

      await addPendingTransactions(pendingTransactions);

      toast({
        title: 'Import complete',
        description: `${pendingTransactions.length} transactions added for review`,
        variant: 'success'
      });

      handleClose();
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Failed to import transactions',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [columnMapping, csvRows, categoryMapping, addPendingTransactions, toast, handleClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
        </DialogHeader>

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
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-text-muted" />
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
              {/* Preview */}
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
                  <div className="space-y-2 max-h-32 overflow-y-auto">
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

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setWizardStep(1)} disabled={isProcessing} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleImport} disabled={isProcessing} className="flex-1">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${csvRows.length} Transactions`
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
