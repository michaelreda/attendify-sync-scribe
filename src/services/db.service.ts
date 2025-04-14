import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FirebaseService } from './firebase.service';
import { Class, Event, Attendee, ConnectionStatus } from '../types';

interface MyDB extends DBSchema {
  classes: {
    key: string;
    value: Class;
  };
  events: {
    key: string;
    value: Event;
  };
  attendees: {
    key: string;
    value: Attendee;
  };
}

class DbService {
  private static instance: DbService;
  private db: IDBPDatabase<MyDB> | null = null;
  private firebaseService: FirebaseService;
  private unsubscribeCallbacks: (() => void)[] = [];
  private syncStatusCallbacks: ((status: ConnectionStatus) => void)[] = [];
  private initPromise: Promise<void> | null = null;

  private constructor() {
    this.firebaseService = FirebaseService.getInstance();
    this.initPromise = this.initializeDB();
  }

  public static getInstance(): DbService {
    if (!DbService.instance) {
      DbService.instance = new DbService();
    }
    return DbService.instance;
  }

  private async initializeDB(): Promise<void> {
    try {
      this.db = await openDB<MyDB>('attendify-db', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('classes')) {
            db.createObjectStore('classes', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('events')) {
            db.createObjectStore('events', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('attendees')) {
            db.createObjectStore('attendees', { keyPath: 'id' });
          }
        }
      });

      // Set up Firebase listeners
      const classesUnsubscribe = this.firebaseService.onClassesChange(async (classes) => {
        if (!this.db) return;
        
        const tx = this.db.transaction('classes', 'readwrite');
        const store = tx.objectStore('classes');
        
        // Clear existing data
        await store.clear();
        
        // Add new data
        for (const cls of classes) {
          await store.add(cls);
        }
        
        await tx.done;
        
        // Notify subscribers
        this.notifyClassesChange(classes);
      });

      const eventsUnsubscribe = this.firebaseService.onEventsChange(async (events) => {
        if (!this.db) return;
        
        const tx = this.db.transaction('events', 'readwrite');
        const store = tx.objectStore('events');
        
        // Clear existing data
        await store.clear();
        
        // Add new data
        for (const event of events) {
          await store.add(event);
        }
        
        await tx.done;
        
        // Notify subscribers
        this.notifyEventsChange(events);
      });

      const attendeesUnsubscribe = this.firebaseService.onAttendeesChange(async (attendees) => {
        if (!this.db) return;
        
        const tx = this.db.transaction('attendees', 'readwrite');
        const store = tx.objectStore('attendees');
        
        // Clear existing data
        await store.clear();
        
        // Add new data
        for (const attendee of attendees) {
          await store.add(attendee);
        }
        
        await tx.done;
        
        // Notify subscribers
        this.notifyAttendeesChange(attendees);
      });

      this.unsubscribeCallbacks.push(classesUnsubscribe, eventsUnsubscribe, attendeesUnsubscribe);
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
  }

  private cleanDataForFirebase<T>(data: T): T {
    if (data === null || data === undefined) {
      return null as T;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.cleanDataForFirebase(item)) as T;
    }
    
    if (typeof data === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanDataForFirebase(value);
        }
      }
      return cleaned as T;
    }
    
    return data;
  }

  private async syncClasses() {
    try {
      const localClasses = await this.getAllClasses();
      const remoteClasses = await this.firebaseService.getClasses();
      
      // Clean data before syncing
      const cleanedLocalClasses = this.cleanDataForFirebase(localClasses);
      const cleanedRemoteClasses = this.cleanDataForFirebase(remoteClasses);
      
      // Find items that exist locally but not remotely
      const localOnly = cleanedLocalClasses.filter(local => 
        !cleanedRemoteClasses.some(remote => remote.id === local.id)
      );
      
      // Find items that exist remotely but not locally
      const remoteOnly = cleanedRemoteClasses.filter(remote => 
        !cleanedLocalClasses.some(local => local.id === remote.id)
      );
      
      // Find items that exist in both but have different data
      const toUpdate = cleanedLocalClasses.filter(local => {
        const remote = cleanedRemoteClasses.find(r => r.id === local.id);
        return remote && JSON.stringify(local) !== JSON.stringify(remote);
      });
      
      // Sync only if there are actual changes
      if (localOnly.length > 0 || remoteOnly.length > 0 || toUpdate.length > 0) {
        await this.firebaseService.syncClasses(cleanedLocalClasses);
      }
    } catch (error) {
      console.error('Error syncing classes:', error);
      throw error;
    }
  }

  private async syncEvents() {
    try {
      const localEvents = await this.getAllEvents();
      const remoteEvents = await this.firebaseService.getEvents();
      
      // Clean data before syncing
      const cleanedLocalEvents = this.cleanDataForFirebase(localEvents);
      const cleanedRemoteEvents = this.cleanDataForFirebase(remoteEvents);
      
      // Find items that exist locally but not remotely
      const localOnly = cleanedLocalEvents.filter(local => 
        !cleanedRemoteEvents.some(remote => remote.id === local.id)
      );
      
      // Find items that exist remotely but not locally
      const remoteOnly = cleanedRemoteEvents.filter(remote => 
        !cleanedLocalEvents.some(local => local.id === remote.id)
      );
      
      // Find items that exist in both but have different data
      const toUpdate = cleanedLocalEvents.filter(local => {
        const remote = cleanedRemoteEvents.find(r => r.id === local.id);
        return remote && JSON.stringify(local) !== JSON.stringify(remote);
      });
      
      // Sync only if there are actual changes
      if (localOnly.length > 0 || remoteOnly.length > 0 || toUpdate.length > 0) {
        await this.firebaseService.syncEvents(cleanedLocalEvents);
      }
    } catch (error) {
      console.error('Error syncing events:', error);
      throw error;
    }
  }

  private async syncAttendees() {
    try {
      const localAttendees = await this.getAllAttendees();
      const remoteAttendees = await this.firebaseService.getAttendees();
      
      // Clean data before syncing
      const cleanedLocalAttendees = this.cleanDataForFirebase(localAttendees);
      const cleanedRemoteAttendees = this.cleanDataForFirebase(remoteAttendees);
      
      // Find items that exist locally but not remotely
      const localOnly = cleanedLocalAttendees.filter(local => 
        !cleanedRemoteAttendees.some(remote => remote.id === local.id)
      );
      
      // Find items that exist remotely but not locally
      const remoteOnly = cleanedRemoteAttendees.filter(remote => 
        !cleanedLocalAttendees.some(local => local.id === remote.id)
      );
      
      // Find items that exist in both but have different data
      const toUpdate = cleanedLocalAttendees.filter(local => {
        const remote = cleanedRemoteAttendees.find(r => r.id === local.id);
        return remote && JSON.stringify(local) !== JSON.stringify(remote);
      });
      
      // Sync only if there are actual changes
      if (localOnly.length > 0 || remoteOnly.length > 0 || toUpdate.length > 0) {
        await this.firebaseService.syncAttendees(cleanedLocalAttendees);
      }
    } catch (error) {
      console.error('Error syncing attendees:', error);
      throw error;
    }
  }

  // Classes
  public async addClass(cls: Omit<Class, 'id'>): Promise<Class> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    
    const newClass: Class = {
      ...cls,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tx = this.db.transaction('classes', 'readwrite');
    await tx.store.add(newClass);
    await tx.done;

    // Sync with Firebase
    await this.syncClasses();
    return newClass;
  }

  public async updateClass(cls: Omit<Class, 'createdAt'>): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    
    // Get existing class to preserve createdAt
    const existingClass = await this.db.get('classes', cls.id);
    if (!existingClass) throw new Error('Class not found');
    
    const updatedClass: Class = {
      ...cls,
      createdAt: existingClass.createdAt,
      updatedAt: new Date().toISOString()
    };

    const tx = this.db.transaction('classes', 'readwrite');
    await tx.store.put(updatedClass);
    await tx.done;

    // Sync with Firebase
    await this.syncClasses();
  }

  public async deleteClass(classId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('classes', 'readwrite');
    await tx.store.delete(classId);
    await tx.done;

    // Sync with Firebase
    await this.firebaseService.deleteClass(classId);
  }

  public async getAllClasses(): Promise<Class[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAll('classes');
  }

  public async getClasses(): Promise<Class[]> {
    await this.ensureInitialized();
    return this.getAllClasses();
  }

  // Events
  public async addEvent(event: Omit<Event, 'id'>): Promise<Event> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    
    const newEvent: Event = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tx = this.db.transaction('events', 'readwrite');
    await tx.store.add(newEvent);
    await tx.done;

    // Sync with Firebase
    await this.syncEvents();
    return newEvent;
  }

  public async updateEvent(event: Omit<Event, 'createdAt'>): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    
    // Get existing event to preserve createdAt
    const existingEvent = await this.db.get('events', event.id);
    if (!existingEvent) throw new Error('Event not found');
    
    const updatedEvent: Event = {
      ...event,
      createdAt: existingEvent.createdAt,
      updatedAt: new Date().toISOString()
    };

    const tx = this.db.transaction('events', 'readwrite');
    await tx.store.put(updatedEvent);
    await tx.done;

    // Sync with Firebase
    await this.syncEvents();
  }

  public async deleteEvent(eventId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('events', 'readwrite');
    await tx.store.delete(eventId);
    await tx.done;

    // Sync with Firebase
    await this.firebaseService.deleteEvent(eventId);
  }

  public async getAllEvents(): Promise<Event[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAll('events');
  }

  public async getEvents(): Promise<Event[]> {
    await this.ensureInitialized();
    return this.getAllEvents();
  }

  public async getEvent(eventId: string): Promise<Event | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    return this.db.get('events', eventId) || null;
  }

  // Attendees
  public async addAttendee(attendee: Omit<Attendee, 'id'>): Promise<Attendee> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    
    const newAttendee: Attendee = {
      ...attendee,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const tx = this.db.transaction('attendees', 'readwrite');
    await tx.store.add(newAttendee);
    await tx.done;

    // Sync with Firebase
    await this.syncAttendees();
    return newAttendee;
  }

  public async updateAttendee(attendee: Omit<Attendee, 'createdAt'>): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    
    // Get existing attendee to preserve createdAt
    const existingAttendee = await this.db.get('attendees', attendee.id);
    if (!existingAttendee) throw new Error('Attendee not found');
    
    const updatedAttendee: Attendee = {
      ...attendee,
      createdAt: existingAttendee.createdAt,
      updatedAt: new Date().toISOString()
    };

    const tx = this.db.transaction('attendees', 'readwrite');
    await tx.store.put(updatedAttendee);
    await tx.done;

    // Sync with Firebase
    await this.syncAttendees();
  }

  public async deleteAttendee(attendeeId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction('attendees', 'readwrite');
    await tx.store.delete(attendeeId);
    await tx.done;

    // Sync with Firebase
    await this.firebaseService.deleteAttendee(attendeeId);
  }

  public async getAllAttendees(): Promise<Attendee[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database not initialized');
    return this.db.getAll('attendees');
  }

  public async getAttendees(eventId?: string): Promise<Attendee[]> {
    await this.ensureInitialized();
    const allAttendees = await this.getAllAttendees();
    if (eventId) {
      return allAttendees.filter(attendee => attendee.eventId === eventId);
    }
    return allAttendees;
  }

  public async hasAnyClasses(): Promise<boolean> {
    await this.ensureInitialized();
    const classes = await this.getAllClasses();
    return classes.length > 0;
  }

  public subscribeSyncStatus(callback: (status: ConnectionStatus) => void): () => void {
    this.syncStatusCallbacks.push(callback);
    
    // Subscribe to Firebase connection status
    const unsubscribe = this.firebaseService.subscribeToConnectionStatus((status) => {
      callback(status);
    });
    
    return () => {
      this.syncStatusCallbacks = this.syncStatusCallbacks.filter(cb => cb !== callback);
      unsubscribe();
    };
  }

  public cleanup(): void {
    this.unsubscribeCallbacks.forEach(unsubscribe => unsubscribe());
    this.unsubscribeCallbacks = [];
    this.syncStatusCallbacks = [];
  }

  // Add methods to notify subscribers
  private classSubscribers: ((classes: Class[]) => void)[] = [];
  private eventSubscribers: ((events: Event[]) => void)[] = [];
  private attendeeSubscribers: ((attendees: Attendee[]) => void)[] = [];

  public subscribeToClasses(callback: (classes: Class[]) => void): () => void {
    this.classSubscribers.push(callback);
    return () => {
      this.classSubscribers = this.classSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeToEvents(callback: (events: Event[]) => void): () => void {
    this.eventSubscribers.push(callback);
    return () => {
      this.eventSubscribers = this.eventSubscribers.filter(cb => cb !== callback);
    };
  }

  public subscribeToAttendees(callback: (attendees: Attendee[]) => void): () => void {
    this.attendeeSubscribers.push(callback);
    return () => {
      this.attendeeSubscribers = this.attendeeSubscribers.filter(cb => cb !== callback);
    };
  }

  private notifyClassesChange(classes: Class[]) {
    this.classSubscribers.forEach(callback => callback(classes));
  }

  private notifyEventsChange(events: Event[]) {
    this.eventSubscribers.forEach(callback => callback(events));
  }

  private notifyAttendeesChange(attendees: Attendee[]) {
    this.attendeeSubscribers.forEach(callback => callback(attendees));
  }
}

const dbService = DbService.getInstance();
export default dbService;
