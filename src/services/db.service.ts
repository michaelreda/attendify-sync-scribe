import { v4 as uuidv4 } from 'uuid';
import { Class, Event, Attendee, SyncInfo } from '../types';

// Database schema version
const DB_VERSION = 1;
const DB_NAME = 'attendifyDB';

export class DbService {
  private db: IDBDatabase | null = null;
  private syncCallbacks: ((status: SyncInfo) => void)[] = [];

  private currentSyncInfo: SyncInfo = {
    lastSync: null,
    status: 'offline',
    pendingChanges: 0
  };

  constructor() {
    this.initDatabase();
    this.setupNetworkListeners();
  }

  private async initDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Error opening database', event);
        reject('Error opening database');
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('classes')) {
          const classStore = db.createObjectStore('classes', { keyPath: 'id' });
          classStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('attendees')) {
          const attendeeStore = db.createObjectStore('attendees', { keyPath: 'id' });
          attendeeStore.createIndex('eventId', 'eventId', { unique: false });
          attendeeStore.createIndex('classId', 'classId', { unique: false });
          attendeeStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.loadSyncInfoFromLocalStorage();
        resolve();
      };
    });
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.updateSyncStatus('online');
      this.syncWithServer();
    });

    window.addEventListener('offline', () => {
      this.updateSyncStatus('offline');
    });

    // Initial status check
    this.updateSyncStatus(navigator.onLine ? 'online' : 'offline');

    // Set up periodic sync when online
    setInterval(() => {
      if (navigator.onLine) {
        this.syncWithServer();
      }
    }, 60000); // Every minute
  }

  private loadSyncInfoFromLocalStorage(): void {
    const savedInfo = localStorage.getItem('syncInfo');
    if (savedInfo) {
      this.currentSyncInfo = JSON.parse(savedInfo);
    }
    // Notify callbacks of the loaded state
    this.notifySyncCallbacks();
  }

  private saveSyncInfoToLocalStorage(): void {
    localStorage.setItem('syncInfo', JSON.stringify(this.currentSyncInfo));
  }

  private updateSyncStatus(status: 'online' | 'offline'): void {
    this.currentSyncInfo.status = status;
    this.notifySyncCallbacks();
    this.saveSyncInfoToLocalStorage();
  }

  private updateLastSync(): void {
    this.currentSyncInfo.lastSync = new Date().toISOString();
    this.notifySyncCallbacks();
    this.saveSyncInfoToLocalStorage();
  }

  private updatePendingChangesCount(count: number): void {
    this.currentSyncInfo.pendingChanges = count;
    this.notifySyncCallbacks();
    this.saveSyncInfoToLocalStorage();
  }

  private notifySyncCallbacks(): void {
    for (const callback of this.syncCallbacks) {
      callback({ ...this.currentSyncInfo });
    }
  }

  // Public methods
  
  public subscribeSyncStatus(callback: (status: SyncInfo) => void): () => void {
    this.syncCallbacks.push(callback);
    // Immediately invoke with current status
    callback({ ...this.currentSyncInfo });
    
    // Return unsubscribe function
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  public async getClasses(): Promise<Class[]> {
    if (!this.db) await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classes'], 'readonly');
      const store = transaction.objectStore('classes');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async addClass(classData: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Promise<Class> {
    if (!this.db) await this.initDatabase();
    
    const now = new Date().toISOString();
    const newClass: Class = {
      ...classData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classes', 'syncQueue'], 'readwrite');
      const store = transaction.objectStore('classes');
      const syncStore = transaction.objectStore('syncQueue');
      
      store.add(newClass);
      syncStore.add({
        type: 'addClass',
        data: newClass,
        timestamp: now
      });

      transaction.oncomplete = () => {
        this.updatePendingChangesCount(this.currentSyncInfo.pendingChanges + 1);
        if (navigator.onLine) this.syncWithServer();
        resolve(newClass);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async updateClass(classData: Omit<Class, 'createdAt'>): Promise<Class> {
    if (!this.db) await this.initDatabase();
    
    const now = new Date().toISOString();
    const updatedClass: Class = {
      ...classData,
      updatedAt: now
    };

    return new Promise(async (resolve, reject) => {
      // First check if the class exists
      const existingClass = await this.getClass(classData.id);
      if (!existingClass) {
        return reject(new Error('Class not found'));
      }

      const transaction = this.db!.transaction(['classes', 'syncQueue'], 'readwrite');
      const store = transaction.objectStore('classes');
      const syncStore = transaction.objectStore('syncQueue');
      
      store.put(updatedClass);
      syncStore.add({
        type: 'updateClass',
        data: updatedClass,
        timestamp: now
      });

      transaction.oncomplete = () => {
        this.updatePendingChangesCount(this.currentSyncInfo.pendingChanges + 1);
        if (navigator.onLine) this.syncWithServer();
        resolve(updatedClass);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async getClass(id: string): Promise<Class | null> {
    if (!this.db) await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['classes'], 'readonly');
      const store = transaction.objectStore('classes');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async getEvents(): Promise<Event[]> {
    if (!this.db) await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async getEvent(id: string): Promise<Event | null> {
    if (!this.db) await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async addEvent(eventData: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    if (!this.db) await this.initDatabase();
    
    const now = new Date().toISOString();
    const newEvent: Event = {
      ...eventData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['events', 'syncQueue'], 'readwrite');
      const store = transaction.objectStore('events');
      const syncStore = transaction.objectStore('syncQueue');
      
      store.add(newEvent);
      syncStore.add({
        type: 'addEvent',
        data: newEvent,
        timestamp: now
      });

      transaction.oncomplete = () => {
        this.updatePendingChangesCount(this.currentSyncInfo.pendingChanges + 1);
        if (navigator.onLine) this.syncWithServer();
        resolve(newEvent);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async getAttendees(eventId: string): Promise<Attendee[]> {
    if (!this.db) await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendees'], 'readonly');
      const store = transaction.objectStore('attendees');
      const index = store.index('eventId');
      const request = index.getAll(eventId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async addAttendee(attendeeData: Omit<Attendee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Attendee> {
    if (!this.db) await this.initDatabase();
    
    const now = new Date().toISOString();
    const newAttendee: Attendee = {
      ...attendeeData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendees', 'syncQueue'], 'readwrite');
      const store = transaction.objectStore('attendees');
      const syncStore = transaction.objectStore('syncQueue');
      
      store.add(newAttendee);
      syncStore.add({
        type: 'addAttendee',
        data: newAttendee,
        timestamp: now
      });

      transaction.oncomplete = () => {
        this.updatePendingChangesCount(this.currentSyncInfo.pendingChanges + 1);
        if (navigator.onLine) this.syncWithServer();
        resolve(newAttendee);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async updateAttendeeStatus(attendeeId: string, attended: boolean): Promise<Attendee> {
    if (!this.db) await this.initDatabase();
    
    const now = new Date().toISOString();

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(['attendees', 'syncQueue'], 'readwrite');
      const store = transaction.objectStore('attendees');
      const syncStore = transaction.objectStore('syncQueue');
      
      // First get the attendee
      const request = store.get(attendeeId);
      
      request.onsuccess = () => {
        if (!request.result) {
          reject(new Error('Attendee not found'));
          return;
        }
        
        const attendee = request.result;
        attendee.attended = attended;
        attendee.updatedAt = now;
        
        // Update in store
        store.put(attendee);
        
        // Add to sync queue
        syncStore.add({
          type: 'updateAttendee',
          data: attendee,
          timestamp: now
        });
      };

      transaction.oncomplete = async () => {
        this.updatePendingChangesCount(this.currentSyncInfo.pendingChanges + 1);
        if (navigator.onLine) this.syncWithServer();
        
        // Get the updated attendee to return
        const updatedAttendee = await this.getAttendee(attendeeId);
        if (updatedAttendee) {
          resolve(updatedAttendee);
        } else {
          reject(new Error('Failed to retrieve updated attendee'));
        }
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async getAttendee(attendeeId: string): Promise<Attendee | null> {
    if (!this.db) await this.initDatabase();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['attendees'], 'readonly');
      const store = transaction.objectStore('attendees');
      const request = store.get(attendeeId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async hasAnyClasses(): Promise<boolean> {
    const classes = await this.getClasses();
    return classes.length > 0;
  }

  private async syncWithServer(): Promise<void> {
    if (!navigator.onLine || !this.db) return;

    try {
      // Get all pending changes from syncQueue
      const pendingChanges = await this.getPendingChanges();
      
      if (pendingChanges.length === 0) {
        // If there are no pending changes, just update the last sync time
        this.updateLastSync();
        return;
      }

      // Sort changes by timestamp
      pendingChanges.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // In a real app, you would send these changes to the server
      // For this demo, we'll simulate a successful sync after a delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear the sync queue after successful sync
      await this.clearSyncQueue();
      
      // Update sync info
      this.updateLastSync();
      this.updatePendingChangesCount(0);
      
      console.log(`Synced ${pendingChanges.length} changes with server`);
    } catch (error) {
      console.error('Sync error:', error);
    }
  }

  private async getPendingChanges(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readonly');
      const store = transaction.objectStore('syncQueue');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearSyncQueue(): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
      const store = transaction.objectStore('syncQueue');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Create and export a singleton instance
const dbService = new DbService();
export default dbService;
