import { useState, useEffect } from 'react';

// Define the type for the persisted data
type PersistedData<T> = {
  data: T;
  timestamp: number;
};

/**
 * Custom hook for persisting data in localStorage with expiration
 * @param key The localStorage key to use
 * @param initialValue The initial value if no value exists in localStorage
 * @param expiryTime Time in milliseconds after which the data is considered stale (default: 24 hours)
 * @returns [value, setValue] tuple similar to useState
 */
export function useLocalStoragePersistence<T>(
  key: string,
  initialValue: T,
  expiryTime: number = 24 * 60 * 60 * 1000 // 24 hours by default
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Create state to store the value
  const [value, setValue] = useState<T>(() => {
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      
      // Parse stored json or return initialValue if none
      if (item) {
        const parsedItem = JSON.parse(item) as PersistedData<T>;
        
        // Check if the data is still valid (not expired)
        if (Date.now() - parsedItem.timestamp < expiryTime) {
          return parsedItem.data;
        }
      }
      
      // If no item or expired, return initialValue
      return initialValue;
    } catch (error) {
      // If error, return initialValue
      console.error('Error reading from localStorage:', error);
      return initialValue;
    }
  });
  
  // Update localStorage when the state changes
  useEffect(() => {
    try {
      // Save to local storage
      const persistedData: PersistedData<T> = {
        data: value,
        timestamp: Date.now(),
      };
      
      window.localStorage.setItem(key, JSON.stringify(persistedData));
    } catch (error) {
      // Log errors
      console.error('Error writing to localStorage:', error);
    }
  }, [key, value]);
  
  return [value, setValue];
}

/**
 * Service for handling note persistence
 */
class NotePersistenceService {
  private static instance: NotePersistenceService;
  
  private constructor() {}
  
  public static getInstance(): NotePersistenceService {
    if (!NotePersistenceService.instance) {
      NotePersistenceService.instance = new NotePersistenceService();
    }
    return NotePersistenceService.instance;
  }
  
  /**
   * Save notes for a specific node
   * @param nodeId The ID of the node
   * @param notes The notes to save
   */
  public saveNotes(nodeId: string, notes: any[]): void {
    try {
      const key = `notes_${nodeId}`;
      const data = {
        notes,
        timestamp: Date.now(),
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      console.log(`NotePersistenceService: Saved ${notes.length} notes for node ${nodeId}`);
    } catch (error) {
      console.error('NotePersistenceService: Error saving notes:', error);
    }
  }
  
  /**
   * Load notes for a specific node
   * @param nodeId The ID of the node
   * @returns The loaded notes or null if none exist
   */
  public loadNotes(nodeId: string): any[] | null {
    try {
      const key = `notes_${nodeId}`;
      const item = localStorage.getItem(key);
      
      if (item) {
        const data = JSON.parse(item);
        console.log(`NotePersistenceService: Loaded ${data.notes.length} notes for node ${nodeId}`);
        return data.notes;
      }
      
      return null;
    } catch (error) {
      console.error('NotePersistenceService: Error loading notes:', error);
      return null;
    }
  }
  
  /**
   * Check if notes exist for a specific node
   * @param nodeId The ID of the node
   * @returns True if notes exist, false otherwise
   */
  public hasNotes(nodeId: string): boolean {
    const key = `notes_${nodeId}`;
    return localStorage.getItem(key) !== null;
  }
  
  /**
   * Delete notes for a specific node
   * @param nodeId The ID of the node
   */
  public deleteNotes(nodeId: string): void {
    try {
      const key = `notes_${nodeId}`;
      localStorage.removeItem(key);
      console.log(`NotePersistenceService: Deleted notes for node ${nodeId}`);
    } catch (error) {
      console.error('NotePersistenceService: Error deleting notes:', error);
    }
  }
  
  /**
   * Get all node IDs that have saved notes
   * @returns Array of node IDs
   */
  public getAllNodeIdsWithNotes(): string[] {
    const nodeIds: string[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith('notes_')) {
          const nodeId = key.replace('notes_', '');
          nodeIds.push(nodeId);
        }
      }
    } catch (error) {
      console.error('NotePersistenceService: Error getting node IDs with notes:', error);
    }
    
    return nodeIds;
  }
}

export const notePersistenceService = NotePersistenceService.getInstance();
