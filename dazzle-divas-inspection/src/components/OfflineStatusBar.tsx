// src/components/OfflineStatusBar.tsx
import React from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export default function OfflineStatusBar() {
  const isOnline = useNetworkStatus();
  const { isSyncing, pendingItems, syncAll } = useOfflineSync();
  
  if (isOnline && pendingItems === 0) {
    return null; // Don't show when online and no pending items
  }
  
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 py-2 px-4 text-sm font-medium ${
      isOnline ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {isOnline ? (
            <>
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse mr-2"></div>
              <span>
                {isSyncing 
                  ? 'Syncing data...' 
                  : `${pendingItems} pending changes to sync`
                }
              </span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span>You're offline. Changes will sync when connection is restored.</span>
            </>
          )}
        </div>
        
        {isOnline && pendingItems > 0 && !isSyncing && (
          <button
            onClick={syncAll}
            className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 px-3 py-1 rounded-full text-xs"
          >
            Sync Now
          </button>
        )}
      </div>
    </div>
  );
}
