import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, onValue, off, onDisconnect, serverTimestamp } from 'firebase/database';
import { Class, Event, Attendee } from '../types';

export class FirebaseService {
  private static instance: FirebaseService;
  private db;
  private connectionRef;
  private isConnectedRef;

  private constructor() {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL: 'https://eventattendance-f8c10-default-rtdb.europe-west1.firebasedatabase.app',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    const app = initializeApp(firebaseConfig);
    this.db = getDatabase(app);
    
    // Set up connection state tracking
    this.connectionRef = ref(this.db, '.info/connected');
    this.isConnectedRef = ref(this.db, '.info/connected');
    
    // Set up connection state listener
    onValue(this.connectionRef, (snap) => {
      if (snap.val() === false) {
        // We're offline
        this.notifyConnectionStatus('offline');
      } else {
        // We're online
        this.notifyConnectionStatus('online');
      }
    });
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  private connectionStatusCallbacks: ((status: 'online' | 'offline') => void)[] = [];

  public subscribeToConnectionStatus(callback: (status: 'online' | 'offline') => void): () => void {
    this.connectionStatusCallbacks.push(callback);
    // Initial status
    callback('online');
    
    return () => {
      this.connectionStatusCallbacks = this.connectionStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyConnectionStatus(status: 'online' | 'offline') {
    this.connectionStatusCallbacks.forEach(callback => callback(status));
  }

  public onClassesChange(callback: (classes: Class[]) => void): () => void {
    const classesRef = ref(this.db, 'classes');
    onValue(classesRef, (snapshot) => {
      const data = snapshot.val();
      const classes: Class[] = data ? Object.values(data) : [];
      callback(classes);
    });
    return () => off(classesRef);
  }

  public onEventsChange(callback: (events: Event[]) => void): () => void {
    const eventsRef = ref(this.db, 'events');
    onValue(eventsRef, (snapshot) => {
      const data = snapshot.val();
      const events: Event[] = data ? Object.values(data) : [];
      callback(events);
    });
    return () => off(eventsRef);
  }

  public onAttendeesChange(callback: (attendees: Attendee[]) => void): () => void {
    const attendeesRef = ref(this.db, 'attendees');
    onValue(attendeesRef, (snapshot) => {
      const data = snapshot.val();
      const attendees: Attendee[] = data ? Object.values(data) : [];
      callback(attendees);
    });
    return () => off(attendeesRef);
  }

  public async syncClasses(classes: Class[]): Promise<void> {
    const classesRef = ref(this.db, 'classes');
    await set(classesRef, classes.reduce((acc, cls) => {
      acc[cls.id] = cls;
      return acc;
    }, {} as Record<string, Class>));
  }

  public async syncEvents(events: Event[]): Promise<void> {
    const eventsRef = ref(this.db, 'events');
    await set(eventsRef, events.reduce((acc, event) => {
      acc[event.id] = event;
      return acc;
    }, {} as Record<string, Event>));
  }

  public async syncAttendees(attendees: Attendee[]): Promise<void> {
    const attendeesRef = ref(this.db, 'attendees');
    await set(attendeesRef, attendees.reduce((acc, attendee) => {
      acc[attendee.id] = attendee;
      return acc;
    }, {} as Record<string, Attendee>));
  }

  public async deleteClass(classId: string): Promise<void> {
    const classRef = ref(this.db, `classes/${classId}`);
    await remove(classRef);
  }

  public async deleteEvent(eventId: string): Promise<void> {
    const eventRef = ref(this.db, `events/${eventId}`);
    await remove(eventRef);
  }

  public async deleteAttendee(attendeeId: string): Promise<void> {
    const attendeeRef = ref(this.db, `attendees/${attendeeId}`);
    await remove(attendeeRef);
  }

  public async getClasses(): Promise<Class[]> {
    const snapshot = await get(ref(this.db, 'classes'));
    if (!snapshot.exists()) {
      return [];
    }
    return Object.values(snapshot.val());
  }

  public async getEvents(): Promise<Event[]> {
    const snapshot = await get(ref(this.db, 'events'));
    if (!snapshot.exists()) {
      return [];
    }
    return Object.values(snapshot.val());
  }

  public async getAttendees(): Promise<Attendee[]> {
    const snapshot = await get(ref(this.db, 'attendees'));
    if (!snapshot.exists()) {
      return [];
    }
    return Object.values(snapshot.val());
  }
} 