'use client';

import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SyncProgress } from '@/hooks/useGmailSync';

interface GmailSyncButtonProps {
  isSyncing: boolean;
  progress: SyncProgress;
  onTrigger: () => void;
}

function getLabel(isSyncing: boolean, progress: SyncProgress): string {
  if (!isSyncing) return 'Sync Gmail';

  switch (progress.status) {
    case 'scanning':
      return 'Scanning...';
    case 'processing':
      if (progress.totalChunks > 1) {
        return `Syncing ${progress.totalSaved}... (${progress.chunk}/${progress.totalChunks})`;
      }
      return `Syncing ${progress.totalSaved}...`;
    case 'done':
      return progress.totalSaved > 0
        ? `Synced ${progress.totalSaved}`
        : 'No new transactions';
    default:
      return 'Syncing...';
  }
}

export function GmailSyncButton({ isSyncing, progress, onTrigger }: GmailSyncButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onTrigger}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <Loader2 className="w-4 h-4 animate-spin mr-1" />
      ) : (
        <Mail className="w-4 h-4 mr-1" />
      )}
      {getLabel(isSyncing, progress)}
    </Button>
  );
}
