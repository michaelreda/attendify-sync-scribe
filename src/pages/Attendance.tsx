
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Event, Attendee, Class, CustomField } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, Search, CheckCircle, XCircle, UserCheck, GraduationCap, Users, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import EventSelectionPage from '@/components/EventSelectionPage';
import ContactButtons from '@/components/ContactButtons';

// Helper function to get value from an attendee's values by field ID
const getAttendeeValue = (attendee: Attendee, fieldId: string): string => {
  const valueObj = attendee.values.find(v => v.fieldId === fieldId);
  return valueObj ? String(valueObj.value) : '';
};

// Helper function to check if a field is a phone field
const isPhoneField = (field: CustomField): boolean => {
  return field.type === 'phone';
};

const AttendancePage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [filteredAttendees, setFilteredAttendees] = useState<Attendee[]>([]);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [nameFieldId, setNameFieldId] = useState<string | null>(null);
  const [phoneFields, setPhoneFields] = useState<CustomField[]>([]);
  
  useEffect(() => {
    // If no eventId is provided, redirect to event selection
    if (!eventId) {
      navigate('/attendance');
      return;
    }
    
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load the event details
        const eventData = await dbService.getEvent(eventId);
        if (!eventData) {
          toast({
            title: 'Event not found',
            description: 'The requested event does not exist',
            variant: 'destructive'
          });
          navigate('/attendance');
          return;
        }
        
        setEvent(eventData);
        
        // Find name field ID for easy access
        const nameField = eventData.customFields.find(field => 
          field.name.toLowerCase() === 'name' || 
          field.name.toLowerCase() === 'full name'
        );
        
        if (nameField) {
          setNameFieldId(nameField.id);
        }
        
        // Find phone fields
        const phoneFieldsList = eventData.customFields.filter(field => field.type === 'phone');
        setPhoneFields(phoneFieldsList);
        
        // Load attendees for this event
        const attendeesData = await dbService.getAttendees(eventId);
        setAttendees(attendeesData);
        setFilteredAttendees(attendeesData);
        
        // Load all classes for reference
        const classesData = await dbService.getClasses();
        const classesMap: Record<string, Class> = {};
        classesData.forEach(cls => {
          classesMap[cls.id] = cls;
        });
        setClasses(classesMap);
      } catch (error) {
        console.error('Failed to load data:', error);
        toast({
          title: 'Error loading data',
          description: 'Please try again',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [eventId, navigate]);
  
  useEffect(() => {
    // Filter attendees based on search query
    if (!searchQuery.trim()) {
      setFilteredAttendees(attendees);
      return;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = attendees.filter(attendee => {
      // Search in all field values
      return attendee.values.some(valueObj => {
        const stringValue = String(valueObj.value).toLowerCase();
        return stringValue.includes(query);
      }) || 
      // Also search in class name
      (classes[attendee.classId]?.name.toLowerCase().includes(query));
    });
    
    setFilteredAttendees(filtered);
  }, [searchQuery, attendees, classes]);
  
  const handleAttendanceToggle = async (attendeeId: string, currentStatus: boolean) => {
    try {
      await dbService.updateAttendeeStatus(attendeeId, !currentStatus);
      
      // Update local state
      setAttendees(prev => 
        prev.map(a => 
          a.id === attendeeId ? { ...a, attended: !currentStatus } : a
        )
      );
      
      toast({
        title: 'Attendance updated',
        description: `Marked as ${!currentStatus ? 'attended' : 'not attended'}`,
      });
    } catch (error) {
      console.error('Failed to update attendance:', error);
      toast({
        title: 'Update failed',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };
  
  const getAttendeeDisplayName = (attendee: Attendee): string => {
    if (nameFieldId) {
      const name = getAttendeeValue(attendee, nameFieldId);
      if (name) return name;
    }
    
    // Fallback to first text field if no name field
    const firstTextField = event?.customFields.find(f => f.type === 'text');
    if (firstTextField) {
      return getAttendeeValue(attendee, firstTextField.id) || 'Unnamed';
    }
    
    return 'Unnamed';
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // This is the event selection page shown when no event is specified
  if (!eventId) {
    return <EventSelectionPage />;
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-attendify-600">Loading attendance data...</div>
      </div>
    );
  }
  
  if (!event) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/attendance')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </div>
        
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <CardDescription className="text-center">
              Event not found or has been deleted.
            </CardDescription>
            <Button
              className="mt-4"
              onClick={() => navigate('/attendance')}
            >
              Return to Event Selection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/attendance')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      </div>
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Take Attendance</h1>
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">{event?.name} • {formatDate(event?.date || '')}</p>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <UserPlus className="h-5 w-5" />
            <span>
              <span className="font-semibold">{filteredAttendees.filter(a => a.attended).length}</span>
              {' '}of{' '}
              <span className="font-semibold">{filteredAttendees.length}</span>{' '}
              attended
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search attendees..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center text-sm text-muted-foreground">
          <span className="font-medium">{filteredAttendees.length}</span>
          <span className="mx-1">of</span>
          <span className="font-medium">{attendees.length}</span>
          <span className="hidden sm:inline ml-1">attendees</span>
        </div>
      </div>
      
      {attendees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <UserCheck className="h-12 w-12 text-attendify-400 mb-4" />
            <CardDescription className="text-center">
              No attendees have been registered for this event yet.
            </CardDescription>
            <Button
              className="mt-4 bg-attendify-600 hover:bg-attendify-700"
              onClick={() => navigate(`/register/${eventId}`)}
            >
              Register Attendees
            </Button>
          </CardContent>
        </Card>
      ) : filteredAttendees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <Search className="h-12 w-12 text-attendify-400 mb-4" />
            <CardDescription className="text-center">
              No attendees match your search. Try a different search term.
            </CardDescription>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setSearchQuery('')}
            >
              Clear Search
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAttendees.map(attendee => {
            const attendeeClass = classes[attendee.classId];
            
            return (
              <div 
                key={attendee.id}
                className={`p-4 rounded-lg border transition-colors ${
                  attendee.attended 
                    ? 'bg-attendify-50 border-attendify-200' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">
                      {getAttendeeDisplayName(attendee)}
                    </h3>
                    
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attendeeClass && (
                        <Badge 
                          variant="outline" 
                          className="bg-attendify-50 text-xs flex items-center"
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {attendeeClass.name}
                          {attendeeClass.grade && (
                            <span className="ml-1 flex items-center">
                              <GraduationCap className="h-3 w-3 mx-1" />
                              {attendeeClass.grade}
                            </span>
                          )}
                        </Badge>
                      )}
                    </div>
                    
                    {attendeeClass && attendeeClass.servants.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-medium">Servants:</span> {attendeeClass.servants.join(', ')}
                      </div>
                    )}
                    
                    <div className="mt-2 text-sm text-muted-foreground space-y-1">
                      {event.customFields
                        .filter(field => {
                          // Skip name field as it's already shown and skip phone fields as they are handled separately
                          return field.id !== nameFieldId && field.type !== 'phone';
                        })
                        .map(field => {
                          const value = getAttendeeValue(attendee, field.id);
                          if (!value) return null;
                          
                          return (
                            <div key={field.id}>
                              <span className="font-medium">{field.name}:</span> {value}
                            </div>
                          );
                        })}

                      {/* Phone fields with contact buttons */}
                      {phoneFields.map(field => {
                        const phoneValue = getAttendeeValue(attendee, field.id);
                        if (!phoneValue) return null;
                        
                        return (
                          <div key={field.id} className="mt-1">
                            <div>
                              <span className="font-medium">{field.name}:</span> {phoneValue}
                            </div>
                            <ContactButtons phoneNumber={phoneValue} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <Button
                    variant={attendee.attended ? "default" : "outline"}
                    size="sm"
                    className={attendee.attended 
                      ? "bg-green-600 hover:bg-green-700" 
                      : "text-muted-foreground"
                    }
                    onClick={() => handleAttendanceToggle(attendee.id, attendee.attended)}
                  >
                    {attendee.attended ? (
                      <>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Present
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 h-4 w-4" />
                        Mark Present
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
