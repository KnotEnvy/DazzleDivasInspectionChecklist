// src/lib/offline-storage.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Types for offline storage
 */
export interface OfflineTask {
  id: string;
  description: string;
  completed: boolean;
}

export interface OfflinePhoto {
  id: string;
  dataUrl: string; // Base64 encoded image
  fileName: string;
  timestamp: number;
}

export interface OfflineRoomInspection {
  id: string;
  roomId: string;
  roomName: string;
  tasks: OfflineTask[];
  photos: OfflinePhoto[];
  notes?: string;
  status: 'PENDING' | 'COMPLETED';
  lastModified: number;
}

export interface OfflineInspection {
  id: string;
  propertyId?: string;
  propertyName: string;
  roomInspections: OfflineRoomInspection[];
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PENDING_SYNC';
  createdAt: number;
  lastModified: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'INSPECTION' | 'ROOM' | 'TASK' | 'PHOTO';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  data: any;
  timestamp: number;
  retries: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'FAILED';
}

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  INSPECTIONS: 'dazzle-divas-offline-inspections',
  SYNC_QUEUE: 'dazzle-divas-sync-queue',
  USER_DATA: 'dazzle-divas-user-data',
};

/**
 * Save inspections to local storage
 */
export const saveInspectionsOffline = (inspections: OfflineInspection[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));
  } catch (error) {
    console.error('Failed to save inspections offline:', error);
  }
};

/**
 * Get inspections from local storage
 */
export const getOfflineInspections = (): OfflineInspection[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get offline inspections:', error);
    return [];
  }
};

/**
 * Save a single inspection to local storage
 */
export const saveInspectionOffline = (inspection: OfflineInspection): void => {
  try {
    const inspections = getOfflineInspections();
    const existingIndex = inspections.findIndex(i => i.id === inspection.id);
    
    if (existingIndex >= 0) {
      inspections[existingIndex] = {
        ...inspection,
        lastModified: Date.now(),
      };
    } else {
      inspections.push({
        ...inspection,
        createdAt: Date.now(),
        lastModified: Date.now(),
      });
    }
    
    saveInspectionsOffline(inspections);
    addToSyncQueue({
      id: uuidv4(),
      type: 'INSPECTION',
      action: existingIndex >= 0 ? 'UPDATE' : 'CREATE',
      data: inspection,
      timestamp: Date.now(),
      retries: 0,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Failed to save inspection offline:', error);
  }
};

/**
 * Update a room inspection in offline storage
 */
export const updateRoomInspectionOffline = (
  inspectionId: string,
  roomInspection: OfflineRoomInspection
): boolean => {
  try {
    const inspections = getOfflineInspections();
    const inspectionIndex = inspections.findIndex(i => i.id === inspectionId);
    
    if (inspectionIndex < 0) return false;
    
    const roomIndex = inspections[inspectionIndex].roomInspections.findIndex(
      r => r.id === roomInspection.id
    );
    
    if (roomIndex >= 0) {
      inspections[inspectionIndex].roomInspections[roomIndex] = {
        ...roomInspection,
        lastModified: Date.now(),
      };
    } else {
      inspections[inspectionIndex].roomInspections.push({
        ...roomInspection,
        lastModified: Date.now(),
      });
    }
    
    inspections[inspectionIndex].lastModified = Date.now();
    saveInspectionsOffline(inspections);
    
    addToSyncQueue({
      id: uuidv4(),
      type: 'ROOM',
      action: roomIndex >= 0 ? 'UPDATE' : 'CREATE',
      data: {
        inspectionId,
        roomInspection,
      },
      timestamp: Date.now(),
      retries: 0,
      status: 'PENDING',
    });
    
    return true;
  } catch (error) {
    console.error('Failed to update room inspection offline:', error);
    return false;
  }
};

/**
 * Save photos to offline storage
 */
export const savePhotosOffline = (
  inspectionId: string,
  roomInspectionId: string,
  photos: OfflinePhoto[]
): boolean => {
  try {
    const inspections = getOfflineInspections();
    const inspectionIndex = inspections.findIndex(i => i.id === inspectionId);
    
    if (inspectionIndex < 0) return false;
    
    const roomIndex = inspections[inspectionIndex].roomInspections.findIndex(
      r => r.id === roomInspectionId
    );
    
    if (roomIndex < 0) return false;
    
    // Add or update photos
    photos.forEach(photo => {
      const photoIndex = inspections[inspectionIndex].roomInspections[roomIndex].photos.findIndex(
        p => p.id === photo.id
      );
      
      if (photoIndex >= 0) {
        inspections[inspectionIndex].roomInspections[roomIndex].photos[photoIndex] = photo;
      } else {
        inspections[inspectionIndex].roomInspections[roomIndex].photos.push(photo);
      }
      
      // Add to sync queue for later upload
      addToSyncQueue({
        id: uuidv4(),
        type: 'PHOTO',
        action: photoIndex >= 0 ? 'UPDATE' : 'CREATE',
        data: {
          inspectionId,
          roomInspectionId,
          photo,
        },
        timestamp: Date.now(),
        retries: 0,
        status: 'PENDING',
      });
    });
    
    inspections[inspectionIndex].roomInspections[roomIndex].lastModified = Date.now();
    inspections[inspectionIndex].lastModified = Date.now();
    saveInspectionsOffline(inspections);
    
    return true;
  } catch (error) {
    console.error('Failed to save photos offline:', error);
    return false;
  }
};

/**
 * Delete a photo from offline storage
 */
export const deletePhotoOffline = (
  inspectionId: string,
  roomInspectionId: string,
  photoId: string
): boolean => {
  try {
    const inspections = getOfflineInspections();
    const inspectionIndex = inspections.findIndex(i => i.id === inspectionId);
    
    if (inspectionIndex < 0) return false;
    
    const roomIndex = inspections[inspectionIndex].roomInspections.findIndex(
      r => r.id === roomInspectionId
    );
    
    if (roomIndex < 0) return false;
    
    // Filter out the deleted photo
    inspections[inspectionIndex].roomInspections[roomIndex].photos = 
      inspections[inspectionIndex].roomInspections[roomIndex].photos.filter(
        p => p.id !== photoId
      );
    
    inspections[inspectionIndex].roomInspections[roomIndex].lastModified = Date.now();
    inspections[inspectionIndex].lastModified = Date.now();
    saveInspectionsOffline(inspections);
    
    // Add to sync queue for deletion
    addToSyncQueue({
      id: uuidv4(),
      type: 'PHOTO',
      action: 'DELETE',
      data: {
        inspectionId,
        roomInspectionId,
        photoId,
      },
      timestamp: Date.now(),
      retries: 0,
      status: 'PENDING',
    });
    
    return true;
  } catch (error) {
    console.error('Failed to delete photo offline:', error);
    return false;
  }
};

// Sync Queue Management
/**
 * Get all items in the sync queue
 */
export const getSyncQueue = (): SyncQueueItem[] => {
  try {
    const queue = localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Failed to get sync queue:', error);
    return [];
  }
};

/**
 * Save the sync queue to local storage
 */
export const saveSyncQueue = (queue: SyncQueueItem[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(queue));
  } catch (error) {
    console.error('Failed to save sync queue:', error);
  }
};

/**
 * Add an item to the sync queue
 */
export const addToSyncQueue = (item: SyncQueueItem): void => {
  try {
    const queue = getSyncQueue();
    queue.push(item);
    saveSyncQueue(queue);
  } catch (error) {
    console.error('Failed to add to sync queue:', error);
  }
};

/**
 * Update an item in the sync queue
 */
export const updateSyncQueueItem = (itemId: string, updates: Partial<SyncQueueItem>): boolean => {
  try {
    const queue = getSyncQueue();
    const index = queue.findIndex(item => item.id === itemId);
    
    if (index < 0) return false;
    
    queue[index] = { ...queue[index], ...updates };
    saveSyncQueue(queue);
    return true;
  } catch (error) {
    console.error('Failed to update sync queue item:', error);
    return false;
  }
};

/**
 * Remove an item from the sync queue
 */
export const removeSyncQueueItem = (itemId: string): boolean => {
  try {
    const queue = getSyncQueue();
    const filteredQueue = queue.filter(item => item.id !== itemId);
    
    if (filteredQueue.length === queue.length) return false;
    
    saveSyncQueue(filteredQueue);
    return true;
  } catch (error) {
    console.error('Failed to remove sync queue item:', error);
    return false;
  }
};

// User data for offline mode
/**
 * Save user data for offline use
 */
export const saveUserDataOffline = (userData: any): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.error('Failed to save user data offline:', error);
  }
};

/**
 * Get user data from offline storage
 */
export const getOfflineUserData = (): any => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get offline user data:', error);
    return null;
  }
};

/**
 * Clear offline storage (used after successful sync or logout)
 */
export const clearOfflineStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.INSPECTIONS);
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE);
    // Don't clear user data, keep it for faster login
  } catch (error) {
    console.error('Failed to clear offline storage:', error);
  }
};

// File to base64 conversion for offline storage
/**
 * Convert a file to base64 for offline storage
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

/**
 * Convert base64 back to a file
 */
export const base64ToFile = (base64: string, fileName: string): File => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], fileName, { type: mime });
};
