'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
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
import { PendingTransaction } from '@/types';
import { smoothSpring } from '@/lib/animations';

const CATEGORY_COLORS = [
  '#86EFAC', '#93C5FD', '#FED7AA', '#C4B5FD', '#FBCFE8',
  '#FEF08A', '#99F6E4', '#FDA4AF', '#A5B4FC', '#D9F99D',
];

interface ImportWizardProps {
  open: boolean;
  onClose: () => void;
}

export function ImportWizard({ open, onClose }: ImportWizardProps) {
  const { categories, addCategory } = useCategories();
  const { addPendingTransactions } = usePendingTransactions();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState({
    date: -1,
    description: -1,
    amount: -1,
    category: -1,
  });

  // Category mapping
  const [csvCategories, setCsvCategories] = useState<string[]>([]);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, string>>({});
  const [creatingCategoryFor, setCreatingCategoryFor] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = useCallback(() => {
    setStep(1);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({ date: -1, description: -1, amount: -1, category: -1 });
    setCsvCategories([]);
    setCategoryMapping({});
    setCsvFileName('');
    setIsProcessing(false);
  }, []);

  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  const handleCsvSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    setCsvFileName(file.name.replace(/\.csv$/i, ''));
    try {
      const content = await file.text();
      const { headers, rows } = parseCSV(content);
      if (rows.length === 0) throw new Error('No data found in CSV');

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

      if (catIndex !== -1) {
        const uniqueCats = Array.from(new Set(
          rows.map(row => row[catIndex]?.trim()).filter(Boolean)
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
      setStep(2);
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
    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
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

  const handleImport = useCallback(async () => {
    if (columnMapping.description === -1 || columnMapping.amount === -1) {
      toast({ title: 'Required', description: 'Please map Description and Amount columns', variant: 'destructive' });
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
      const pendingTransactions: Omit<PendingTransaction, 'id' | 'createdAt'>[] = parsed.map(t => {
        let category: string | undefined;
        if (t.category) {
          const mappingKey = Object.keys(categoryMapping).find(
            k => k.toLowerCase() === t.category?.toLowerCase()
          );
          if (mappingKey && categoryMapping[mappingKey]) category = categoryMapping[mappingKey];
        }
        return {
          date: t.date,
          description: t.description,
          amount: t.amount,
          category,
          status: 'uncategorized' as const,
          source: csvFileName || undefined,
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
        description: err instanceof Error ? err.message : 'Failed to import',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [columnMapping, csvRows, categoryMapping, csvFileName, addPendingTransactions, toast, handleClose]);

  const columnFields = [
    { key: 'date', label: 'Date Column' },
    { key: 'description', label: 'Description Column *' },
    { key: 'amount', label: 'Amount Column *' },
    { key: 'category', label: 'Category Column', optional: true },
  ];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? 'Import Transactions' : 'Map Columns'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <motion.div
                whileTap={{ scale: 0.99 }}
                transition={smoothSpring}
                onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && handleFileSelect(e.dataTransfer.files[0]); }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => csvInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--glass-separator)] rounded-2xl p-10 text-center hover:border-accent/40 transition-colors cursor-pointer"
              >
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                {isProcessing ? (
                  <Loader2 className="w-8 h-8 mx-auto mb-3 text-text-muted animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-8 h-8 mx-auto mb-3 text-text-muted" />
                )}
                <p className="text-sm font-medium text-text-primary">
                  {isProcessing ? 'Processing...' : 'Drop CSV or click to browse'}
                </p>
                <p className="text-xs text-text-muted mt-1">Bank statement exports</p>
              </motion.div>
            </motion.div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* File info */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-pill text-sm">
                <FileSpreadsheet className="w-4 h-4 text-text-secondary flex-shrink-0" />
                <span className="text-text-primary font-medium truncate">{csvFileName}.csv</span>
                <span className="text-text-muted ml-auto flex-shrink-0">{csvRows.length} rows</span>
              </div>

              {/* Column mapping */}
              <div className="space-y-3">
                {columnFields.map(({ key, label, optional }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-sm text-text-secondary w-36 flex-shrink-0">{label}</label>
                    <Select
                      value={columnMapping[key as keyof typeof columnMapping].toString()}
                      onValueChange={(v) => handleColumnChange(key, parseInt(v))}
                    >
                      <SelectTrigger className="h-9 text-sm flex-1">
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
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary">Map CSV Categories</p>
                  <div className="glass-card divide-y divide-[var(--glass-separator)]">
                    {csvCategories.map(csvCat => (
                      <div key={csvCat} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-text-primary truncate mr-3">{csvCat}</span>
                        <Popover
                          open={creatingCategoryFor === csvCat}
                          onOpenChange={(o) => !o && setCreatingCategoryFor(null)}
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
                                <SelectTrigger className="h-7 w-28 text-xs">
                                  <SelectValue>
                                    {categoryMapping[csvCat]
                                      ? categories.find(c => c.id === categoryMapping[csvCat])?.name
                                      : <span className="text-text-muted">Skip</span>
                                    }
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_skip">Skip</SelectItem>
                                  <SelectItem value="_create">
                                    <span className="text-text-primary">+ Create new</span>
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

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isProcessing} className="flex-1">
                  Back
                </Button>
                <Button onClick={handleImport} disabled={isProcessing} className="flex-1">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import {csvRows.length} Rows
                    </>
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
