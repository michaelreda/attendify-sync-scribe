import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SyncInfo } from '../types';
import dbService from '../services/db.service';
import { Wifi, WifiOff, Clock, Settings } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [syncInfo, setSyncInfo] = useState<SyncInfo>({
    lastSync: null,
    status: 'offline',
    pendingChanges: 0
  });
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = dbService.subscribeSyncStatus(info => {
      setSyncInfo(info);
    });
    
    return () => unsubscribe();
  }, []);

  const formatLastSync = () => {
    if (!syncInfo.lastSync) return 'Never synced';
    
    try {
      return `Last sync: ${formatDistanceToNow(new Date(syncInfo.lastSync), { addSuffix: true })}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-attendify-600 text-white shadow-md">
        <div className="container mx-auto py-4 px-4 sm:px-6 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">
              <Link to="/" className="flex items-center">
                AttendifySync
              </Link>
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center text-sm space-x-2">
              <Clock className="h-4 w-4" />
              <span>{formatLastSync()}</span>
            </div>
            
            <div className="flex items-center space-x-1">
              {syncInfo.status === 'online' ? (
                <Wifi className="h-5 w-5 text-green-300" />
              ) : (
                <WifiOff className="h-5 w-5 text-yellow-300 animate-pulse-opacity" />
              )}
              <span className="text-sm font-medium">
                {syncInfo.status === 'online' ? 'Online' : 'Offline'}
              </span>
              {syncInfo.pendingChanges > 0 && (
                <span className="bg-white text-attendify-600 text-xs rounded-full px-2 py-0.5 ml-1">
                  {syncInfo.pendingChanges}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <nav className="bg-attendify-700 text-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-hide">
            <Link 
              to="/classes" 
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap hover:bg-attendify-800 transition-colors",
                location.pathname.startsWith('/classes') ? "bg-attendify-800" : ""
              )}
            >
              Classes
            </Link>
            <Link 
              to="/events" 
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap hover:bg-attendify-800 transition-colors",
                location.pathname.startsWith('/events') ? "bg-attendify-800" : ""
              )}
            >
              Events
            </Link>
            <Link 
              to="/register" 
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap hover:bg-attendify-800 transition-colors",
                location.pathname.startsWith('/register') ? "bg-attendify-800" : ""
              )}
            >
              Register Attendees
            </Link>
            <Link 
              to="/attendance" 
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap hover:bg-attendify-800 transition-colors",
                location.pathname.startsWith('/attendance') ? "bg-attendify-800" : ""
              )}
            >
              Take Attendance
            </Link>
            <Link 
              to="/settings" 
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap hover:bg-attendify-800 transition-colors flex items-center",
                location.pathname.startsWith('/settings') ? "bg-attendify-800" : ""
              )}
            >
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </div>
        </div>
      </nav>
      
      <div className="sm:text-sm text-xs px-4 sm:px-6 py-2 bg-attendify-100 text-attendify-700 flex justify-between items-center">
        <div className="sm:hidden flex items-center space-x-2">
          <Clock className="h-3 w-3" />
          <span>{formatLastSync()}</span>
        </div>
        <div className="flex-1 text-right">
          {syncInfo.status === 'offline' && (
            <span className="font-medium">
              Working offline - changes will sync when you're back online
            </span>
          )}
        </div>
      </div>
      
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
      
      <footer className="bg-attendify-800 text-white py-4">
        <div className="container mx-auto px-4 sm:px-6 text-center text-sm">
          <p>AttendifySync - Offline-first Attendance Tracking App</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
