// src/hooks/useOfflineSync.ts
import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import {
  getSyncQueue,
  updateSyncQueueItem,
  removeSyncQueueItem,
  SyncQueueItem,
  base64ToFile
} from '@/lib/offline-storage';

/**
 * Hook to manage offline data synchronization
 */
export function useOfflineSync() {
  const isOnline = useNetworkStatus();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [pendingItems, setPendingItems] = useState<number>(0);
  
  // Count pending items
  const updatePendingCount = useCallback(() => {
    const queue = getSyncQueue();
    setPendingItems(queue.filter(item => item.status === 'PENDING').length);
  }, []);
  
  // Process a single sync queue item
  const processSyncItem = useCallback(async (item: SyncQueueItem): Promise<boolean> => {
    // Mark as in progress
    updateSyncQueueItem(item.id, { status: 'IN_PROGRESS' });
    
    try {
      // Handle different sync types
      switch (item.type) {
        case 'INSPECTION':
          if (item.action === 'CREATE' || item.action === 'UPDATE') {
            // Send to server
            const inspResponse = await fetch('/api/inspections', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(item.data),
            });
            
            if (!inspResponse.ok) throw new Error('Failed to sync inspection');
          }
          break;
          
        case 'ROOM':
          // Handle room update/create
          const roomResponse = await fetch(`/api/inspections/${item.data.inspectionId}/rooms/${item.data.roomInspection.roomId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              tasks: item.data.roomInspection.tasks,
              notes: item.data.roomInspection.notes 
            }),
          });
          
          if (!roomResponse.ok) throw new Error('Failed to sync room inspection');
          break;
          
        case 'PHOTO':
          if (item.action === 'DELETE') {
            // Handle photo deletion
            const deleteResponse = await fetch(`/api/inspections/${item.data.inspectionId}/rooms/${item.data.roomInspectionId}/photos/${item.data.photoId}`, {
              method: 'DELETE',
            });
            
            if (!deleteResponse.ok) throw new Error('Failed to delete photo');
          } else {
            // Handle photo creation/update
            const formData = new FormData();
            
            // Convert base64 back to file
            const photoFile = base64ToFile(
              item.data.photo.dataUrl,
              item.data.photo.fileName
            );
            
            formData.append('photos', photoFile);
            formData.append('photoIds', item.data.photo.id);
            
            const photoResponse = await fetch(`/api/inspections/${item.data.inspectionId}/rooms/${item.data.roomInspectionId}/photos`, {
              method: 'POST',
              body: formData,
            });
            
            if (!photoResponse.ok) throw new Error('Failed to sync photo');
          }
          break;
          
        default:
          throw new Error(`Unknown sync type: ${item.type}`);
      }
      
      // Successfully processed
      removeSyncQueueItem(item.id);
      return true;
    } catch (error) {
      console.error(`Error processing sync item ${item.id}:`, error);
      
      // Increment retry count and mark as failed
      updateSyncQueueItem(item.id, { 
        status: 'FAILED',
        retries: item.retries + 1 
      });
      
      return false;
    }
  }, []);
  
  // Process all pending items
  const syncAll = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    
    setIsSyncing(true);
    
    try {
      const queue = getSyncQueue();
      const pendingItems = queue.filter(item => 
        item.status === 'PENDING' || 
        (item.status === 'FAILED' && item.retries < 3)
      );
      
      if (pendingItems.length === 0) {
        setIsSyncing(false);
        return;
      }
      
      // Process items in order (oldest first)
      const sortedItems = pendingItems.sort((a, b) => a.timestamp - b.timestamp);
      
      for (const item of sortedItems) {
        if (!isOnline) {
          // Stop syncing if we go offline
          break;
        }
        
        await processSyncItem(item);
        
        // Update pending count after each item
        updatePendingCount();
      }
      
      // Set last sync time
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('dazzle-divas-last-sync', now.toString());
    } catch (error) {
      console.error('Error syncing offline data:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, processSyncItem, updatePendingCount]);
  
  // Get last sync time on mount
  useEffect(() => {
    const savedTime = localStorage.getItem('dazzle-divas-last-sync');
    if (savedTime) {
      setLastSyncTime(parseInt(savedTime, 10));
    }
    
    updatePendingCount();
  }, [updatePendingCount]);
  
  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingItems > 0) {
      syncAll();
    }
  }, [isOnline, pendingItems, syncAll]);
  
  return {
    isOnline,
    isSyncing,
    pendingItems,
    lastSyncTime,
    syncAll,
    updatePendingCount,
  };
}
