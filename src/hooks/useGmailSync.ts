'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/context/SettingsContext';
import { usePendingTransactions } from '@/context/TransactionsContext';
import { useToast } from '@/hooks/useToast';

const SYNC_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const LAST_SYNC_KEY = 'gmail-last-sync-date';

export interface SyncProgress {
  status: 'idle' | 'scanning' | 'processing' | 'done' | 'error';
  totalEmails: number;
  newEmails: number;
  chunk: number;
  totalChunks: number;
  totalSaved: number;
}

const IDLE_PROGRESS: SyncProgress = {
  status: 'idle',
  totalEmails: 0,
  newEmails: 0,
  chunk: 0,
  totalChunks: 0,
  totalSaved: 0,
};

export function useGmailSync() {
  const { status } = useSession();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { refreshPendingTransactions } = usePendingTransactions();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>(IDLE_PROGRESS);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const autoSyncTriggered = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    if (stored) setLastSync(stored);
  }, []);

  const doSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setProgress({ ...IDLE_PROGRESS, status: 'scanning' });

    try {
      const res = await fetch('/api/gmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sync' }),
      });

      if (!res.ok || !res.body) {
        let msg = 'Sync failed';
        try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
        toast({ title: 'Gmail Sync', description: msg, variant: 'destructive' });
        setProgress({ ...IDLE_PROGRESS, status: 'error' });
        return;
      }

      // Read NDJSON stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalSaved = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'scanning') {
              setProgress((p) => ({
                ...p,
                status: event.newEmails > 0 ? 'processing' : 'done',
                totalEmails: event.totalEmails,
                newEmails: event.newEmails,
                totalChunks: Math.ceil(event.newEmails / 50),
              }));
            } else if (event.type === 'progress') {
              finalSaved = event.totalSaved;
              setProgress((p) => ({
                ...p,
                status: 'processing',
                chunk: event.chunk,
                totalChunks: event.totalChunks,
                totalSaved: event.totalSaved,
              }));
            } else if (event.type === 'done') {
              finalSaved = event.totalSaved;
              setProgress((p) => ({ ...p, status: 'done', totalSaved: event.totalSaved }));
            } else if (event.type === 'error') {
              toast({ title: 'Gmail Sync', description: event.message, variant: 'destructive' });
              setProgress({ ...IDLE_PROGRESS, status: 'error' });
              return;
            }
          } catch { /* skip malformed lines */ }
        }
      }

      // Refresh context so new transactions appear in the list
      await refreshPendingTransactions();

      if (finalSaved > 0) {
        toast({
          title: 'Gmail Sync',
          description: `Synced ${finalSaved} new transactions from Gmail`,
          variant: 'success',
        });
      } else {
        toast({
          title: 'Gmail Sync',
          description: 'No new transactions found',
        });
      }

      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      setLastSync(now);
    } catch {
      toast({ title: 'Gmail Sync', description: 'Failed to sync Gmail', variant: 'destructive' });
      setProgress({ ...IDLE_PROGRESS, status: 'error' });
    } finally {
      setIsSyncing(false);
      // Reset to idle after a short delay so UI can show final state
      setTimeout(() => setProgress(IDLE_PROGRESS), 3000);
    }
  }, [isSyncing, refreshPendingTransactions, toast]);

  // Auto-sync on mount when enabled + cooldown passed
  useEffect(() => {
    if (autoSyncTriggered.current) return;
    if (settingsLoading || status !== 'authenticated') return;
    if (!settings.gmailSyncEnabled) return;

    const lastSyncTime = lastSync ? new Date(lastSync).getTime() : 0;
    if (Date.now() - lastSyncTime < SYNC_COOLDOWN_MS) return;

    autoSyncTriggered.current = true;
    doSync();
  }, [settingsLoading, status, settings.gmailSyncEnabled, lastSync, doSync]);

  const triggerSync = useCallback(() => {
    doSync();
  }, [doSync]);

  return { isSyncing, progress, lastSync, triggerSync };
}
