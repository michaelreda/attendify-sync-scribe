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
import { ArrowLeft, Calendar, Search, CheckCircle, XCircle, UserCheck, GraduationCap, Users, UserPlus, Check, X, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import ContactButtons from '@/components/ContactButtons';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nameFieldId, setNameFieldId] = useState<string | null>(null);
  const [phoneFields, setPhoneFields] = useState<CustomField[]>([]);
  
  const loadData = async () => {
    if (!eventId) return;
    
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
  
  useEffect(() => {
    // If no eventId is provided, redirect to event selection
    if (!eventId) {
      navigate('/attendance');
      return;
    }
    
    loadData();
  }, [eventId, navigate]);

  // Subscribe to attendee changes
  useEffect(() => {
    const unsubscribe = dbService.subscribeToAttendees((updatedAttendees) => {
      // Filter attendees for the current event
      const eventAttendees = updatedAttendees.filter(a => a.eventId === eventId);
      setAttendees(eventAttendees);
      setFilteredAttendees(eventAttendees);
    });

    return () => unsubscribe();
  }, [eventId]);
  
  // Add effect to listen for sync status changes
  useEffect(() => {
    const unsubscribe = dbService.subscribeSyncStatus((info) => {
      // If we were offline and just came back online, or if sync just completed
      if (info.status === 'online' && info.pendingChanges === 0) {
        loadData();
      }
    });

    return () => unsubscribe();
  }, [eventId]);
  
  useEffect(() => {
    // Filter attendees based on search query and selected class
    let filtered = attendees;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(attendee => {
        return attendee.values.some(valueObj => {
          const stringValue = String(valueObj.value).toLowerCase();
          return stringValue.includes(query);
        }) || 
        (classes[attendee.classId]?.name.toLowerCase().includes(query));
      });
    }
    
    if (selectedClassId) {
      filtered = filtered.filter(attendee => attendee.classId === selectedClassId);
    }
    
    setFilteredAttendees(filtered);
  }, [searchQuery, attendees, classes, selectedClassId]);
  
  const handleAttendanceToggle = async (attendeeId: string, currentStatus: boolean) => {
    try {
      // Find the attendee in the current state
      const attendee = attendees.find(a => a.id === attendeeId);
      if (!attendee) {
        throw new Error('Attendee not found');
      }

      // Get attendee name for the toast message
      const attendeeName = getAttendeeDisplayName(attendee);

      // Create updated attendee object
      const updatedAttendee = {
        ...attendee,
        attended: !currentStatus,
        updatedAt: new Date().toISOString()
      };

      await dbService.updateAttendee(updatedAttendee);
      
      // Update local state
      setAttendees(prev => 
        prev.map(a => 
          a.id === attendeeId ? { ...a, attended: !currentStatus } : a
        )
      );
      
      toast({
        title: `${attendeeName}`,
        description: `Marked as ${!currentStatus ? 'attended' : 'not attended'}`,
        className: !currentStatus ? "bg-green-500 text-white" : "bg-yellow-500 text-white"
      });
    } catch (error) {
      console.error('Failed to update attendance:', error);
      const attendee = attendees.find(a => a.id === attendeeId);
      const attendeeName = attendee ? getAttendeeDisplayName(attendee) : 'Unknown attendee';
      toast({
        title: `${attendeeName}`,
        description: 'Failed to update attendance. Please try again.',
        variant: 'destructive',
        className: "bg-red-500 text-white"
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
  
  const renderAttendeeRow = (attendee: Attendee) => {
    const classInfo = classes[attendee.classId];
    const customFields = event?.customFields || [];
    const servantNames = classInfo?.servants?.map(servant => servant.name).join(', ') || 'No servants assigned';
    
    return (
      <div key={attendee.id} className="flex items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className="font-medium">{getAttendeeDisplayName(attendee)}</div>
            {classInfo && (
              <Badge variant="outline" className="bg-attendify-50">
                <GraduationCap className="h-3 w-3 mr-1" />
                {classInfo.name}
                {classInfo.grade && ` (${classInfo.grade})`}
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium">Servants:</span> {servantNames}
          </div>
          {customFields.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {customFields
                .filter(field => 
                  field.name.toLowerCase() !== 'name' && 
                  field.name.toLowerCase() !== 'full name'
                )
                .map((field, index) => (
                <div key={index} className="text-sm text-muted-foreground">
                  <span className="font-medium">{field.name}:</span>{' '}
                  <span>{getAttendeeValue(attendee, field.id) || 'Not provided'}</span>
                  {isPhoneField(field) && getAttendeeValue(attendee, field.id) && (
                    <ContactButtons phoneNumber={getAttendeeValue(attendee, field.id)} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant={attendee.attended ? "default" : "outline"}
            size="sm"
            onClick={() => handleAttendanceToggle(attendee.id, attendee.attended)}
            className={attendee.attended ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {attendee.attended ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Attended
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Present
              </>
            )}
          </Button>
        </div>
      </div>
    );
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
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Attendance</h1>
          <p className="text-muted-foreground">
            {event ? `Taking attendance for ${event.name}` : 'Select an event to take attendance'}
          </p>
          {event && (
            <div className="mt-2 flex items-center gap-4">
              <Badge variant="outline" className="bg-attendify-50">
                <UserCheck className="h-3 w-3 mr-1" />
                {attendees.filter(a => a.attended).length} / {attendees.length} attended
              </Badge>
            </div>
          )}
        </div>
        {event && (
          <Button 
            variant="outline"
            onClick={() => navigate('/events')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Change Event
          </Button>
        )}
      </div>

      {!event ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Please select an event to take attendance</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search attendees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Class Filter Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge
              variant={selectedClassId === null ? "default" : "outline"}
              className="cursor-pointer hover:bg-attendify-100"
              onClick={() => setSelectedClassId(null)}
            >
              All Classes
            </Badge>
            {Object.values(classes).map((cls) => (
              <Badge
                key={cls.id}
                variant={selectedClassId === cls.id ? "default" : "outline"}
                className="cursor-pointer hover:bg-attendify-100"
                onClick={() => setSelectedClassId(cls.id)}
              >
                <GraduationCap className="h-3 w-3 mr-1" />
                {cls.name}
                {cls.grade && ` (${cls.grade})`}
              </Badge>
            ))}
          </div>

          <div className="space-y-4">
            {filteredAttendees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'No attendees found matching your search'
                    : 'No attendees registered for this event'}
                </p>
              </div>
            ) : (
              filteredAttendees.map(renderAttendeeRow)
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AttendancePage;
