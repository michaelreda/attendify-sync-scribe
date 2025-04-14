import { googleSheetsService } from './googleSheetsService';
import dbService from './db.service';
import { toast } from 'sonner';

class SyncService {
  private isAutoSyncEnabled = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Subscribe to database changes
    dbService.subscribeSyncStatus((info) => {
      if (this.isAutoSyncEnabled && info.status === 'online') {
        this.sync();
      }
    });
  }

  async sync() {
    try {
      // Get all data from the local database
      const classes = await dbService.getClasses();
      const events = await dbService.getEvents();
      const attendees = await Promise.all(
        events.map(event => dbService.getAttendees(event.id))
      ).then(attendeeArrays => attendeeArrays.flat());

      // Only sync if there is data
      const syncPromises = [];
      
      if (classes && classes.length > 0) {
        syncPromises.push(googleSheetsService.syncData(classes, 'Classes'));
      }
      
      if (events && events.length > 0) {
        syncPromises.push(googleSheetsService.syncData(events, 'Events'));
      }
      
      if (attendees && attendees.length > 0) {
        syncPromises.push(googleSheetsService.syncData(attendees, 'Attendees'));
      }

      if (syncPromises.length > 0) {
        await Promise.all(syncPromises);
        toast.success('Data synced successfully');
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error('Failed to sync data');
    }
  }

  setAutoSync(enabled: boolean) {
    this.isAutoSyncEnabled = enabled;
    
    if (enabled) {
      // Sync every 5 minutes
      this.syncInterval = setInterval(() => {
        this.sync();
      }, 10 * 1000);
    } else if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  isAutoSyncOn() {
    return this.isAutoSyncEnabled;
  }
}

export const syncService = new SyncService(); 