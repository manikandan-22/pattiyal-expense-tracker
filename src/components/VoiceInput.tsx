'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, AlertCircle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoice } from '@/hooks/useVoice';
import { useCategories } from '@/context/ExpenseContext';
import { useSettings } from '@/context/SettingsContext';
import { parseVoiceInput } from '@/lib/voice-parser';
import { ParsedVoiceExpense, Category } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';

interface VoiceInputProps {
  onResult: (result: ParsedVoiceExpense) => void;
  onCancel: () => void;
}

export function VoiceInput({ onResult, onCancel }: VoiceInputProps) {
  const { categories } = useCategories();
  const { settings } = useSettings();
  const [parsedResult, setParsedResult] = useState<ParsedVoiceExpense | null>(null);
  const [processing, setProcessing] = useState(false);

  const {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    error,
  } = useVoice({
    onResult: (text) => {
      setProcessing(true);
      // Small delay to show processing state
      setTimeout(() => {
        const result = parseVoiceInput(text, categories);
        setParsedResult(result);
        setProcessing(false);
      }, 500);
    },
    onError: () => {
      setProcessing(false);
    },
  });

  // Auto-start listening on mount
  useEffect(() => {
    if (isSupported) {
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupported]);

  const getCategoryById = (id: string | null): Category | undefined =>
    categories.find((c) => c.id === id);

  const handleConfirm = () => {
    if (parsedResult) {
      onResult(parsedResult);
    }
  };

  const handleRetry = () => {
    setParsedResult(null);
    startListening();
  };

  if (!isSupported) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
          <MicOff className="w-8 h-8 text-error" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Voice Input Not Supported
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          Your browser does not support voice input. Please use a modern browser like Chrome.
        </p>
        <Button variant="outline" onClick={onCancel}>
          Go Back
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Error
        </h3>
        <p className="text-sm text-text-secondary mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleRetry}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (parsedResult) {
    const category = getCategoryById(parsedResult.category);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">
            Got it!
          </h3>
          <p className="text-sm text-text-secondary">
            Here is what I understood
          </p>
        </div>

        {/* Parsed result preview */}
        <div className="bg-surface rounded-xl p-6 space-y-4">
          {/* Amount */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Amount</span>
            <span className="text-2xl font-semibold text-text-primary">
              {parsedResult.amount !== null
                ? formatCurrency(parsedResult.amount, settings.currency)
                : '—'}
            </span>
          </div>

          {/* Category */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Category</span>
            {category ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span>{category.icon}</span>
                <span className="font-medium">{category.name}</span>
              </div>
            ) : (
              <span className="text-text-muted">Not detected</span>
            )}
          </div>

          {/* Description */}
          {parsedResult.description && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-secondary">Description</span>
              <span className="font-medium text-right max-w-[200px] truncate">
                {parsedResult.description}
              </span>
            </div>
          )}

          {/* Confidence */}
          <div className="pt-2 border-t border-border">
            <div className="flex justify-between items-center text-xs text-text-muted">
              <span>Confidence</span>
              <span>{Math.round(parsedResult.confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-surface-hover rounded-full mt-1 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  parsedResult.confidence >= 0.7
                    ? 'bg-success'
                    : parsedResult.confidence >= 0.4
                    ? 'bg-warning'
                    : 'bg-error'
                )}
                style={{ width: `${parsedResult.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Original transcript */}
        <div className="text-center">
          <p className="text-xs text-text-muted">Original: &quot;{transcript}&quot;</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry} className="flex-1">
            Try Again
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            Use This
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-8"
    >
      {/* Mic animation */}
      <div className="relative w-32 h-32 mx-auto mb-8">
        <AnimatePresence>
          {isListening && (
            <>
              {/* Pulsing rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.5,
                  }}
                  className="absolute inset-0 rounded-full border-2 border-accent"
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* Main circle */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={isListening ? stopListening : startListening}
          className={cn(
            'absolute inset-4 rounded-full flex items-center justify-center transition-colors',
            isListening
              ? 'bg-accent text-white'
              : 'bg-surface-hover text-text-secondary hover:bg-border'
          )}
        >
          {processing ? (
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Mic className="w-10 h-10" />
          )}
        </motion.button>
      </div>

      {/* Status text */}
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        {processing
          ? 'Processing...'
          : isListening
          ? 'Listening...'
          : 'Tap to speak'}
      </h3>
      <p className="text-sm text-text-secondary mb-2">
        {isListening
          ? 'Say something like "Spent 50 dollars on groceries yesterday"'
          : 'Tap the microphone to start'}
      </p>

      {/* Transcript preview */}
      {transcript && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-surface rounded-lg"
        >
          <p className="text-sm text-text-secondary">&quot;{transcript}&quot;</p>
        </motion.div>
      )}

      {/* Cancel button */}
      <Button variant="ghost" onClick={onCancel} className="mt-6">
        <X className="w-4 h-4 mr-2" />
        Cancel
      </Button>
    </motion.div>
  );
}
