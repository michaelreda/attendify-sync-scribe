import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Event } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { Calendar, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

const EventSelectionPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    const loadEvents = async () => {
      try {
        setIsLoading(true);
        const eventsData = await dbService.getEvents();
        setEvents(eventsData);
      } catch (error) {
        console.error('Failed to load events:', error);
        toast({
          title: 'Error loading events',
          description: 'Please try again',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadEvents();
  }, []);
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Take Attendance</h1>
        <p className="text-muted-foreground">Select an event to manage attendance</p>
      </div>
      
      <Separator />
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-pulse text-attendify-600">Loading events...</div>
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <Calendar className="h-12 w-12 text-attendify-400 mb-4" />
            <CardDescription className="text-center">
              No events found. Create an event first to take attendance.
            </CardDescription>
            <Button
              className="mt-4 bg-attendify-600 hover:bg-attendify-700"
              onClick={() => navigate('/events')}
            >
              Go to Events
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Link key={event.id} to={`/attendance/${event.id}`} className="block">
              <Card className="transition-all hover:shadow-md hover:border-attendify-300 cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">{event.name}</CardTitle>
                  <CardDescription>{formatDate(event.date)}</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-between items-center">
                  <div>
                    {event.location && (
                      <p className="text-sm text-muted-foreground">{event.location}</p>
                    )}
                  </div>
                  <UserCheck className="h-5 w-5 text-attendify-500" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventSelectionPage;
