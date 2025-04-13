
import React, { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Event, Class, CustomField, AttendeeValue } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { ArrowLeft, Calendar, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

const RegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    // If no eventId is provided, redirect to event selection
    if (!eventId) {
      navigate('/register');
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
          navigate('/register');
          return;
        }
        
        setEvent(eventData);
        
        // Load available classes
        const classesData = await dbService.getClasses();
        setClasses(classesData);
        
        // Set first class as default if available
        if (classesData.length > 0) {
          setSelectedClass(classesData[0].id);
        }
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
  
  const handleInputChange = (fieldId: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
    
    // Clear error when user types
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };
  
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Validate class selection
    if (!selectedClass) {
      newErrors['class'] = 'Please select a class';
    }
    
    // Validate all required fields
    event?.customFields.forEach(field => {
      if (field.required && (!fieldValues[field.id] || fieldValues[field.id].trim() === '')) {
        newErrors[field.id] = `${field.name} is required`;
      } else if (field.type === 'number' && fieldValues[field.id] && isNaN(Number(fieldValues[field.id]))) {
        newErrors[field.id] = `${field.name} must be a number`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Format the values for the attendee
      const values: AttendeeValue[] = Object.entries(fieldValues).map(([fieldId, value]) => {
        const field = event!.customFields.find(f => f.id === fieldId);
        return {
          fieldId,
          value: field?.type === 'number' ? Number(value) : value
        };
      });
      
      // Save the attendee
      await dbService.addAttendee({
        eventId: eventId!,
        classId: selectedClass,
        values,
        attended: false // Default to not attended
      });
      
      toast({
        title: 'Registration successful',
        description: 'The attendee has been registered'
      });
      
      // Clear form for next registration
      setFieldValues({});
    } catch (error) {
      console.error('Failed to register attendee:', error);
      toast({
        title: 'Registration failed',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <div className="animate-pulse text-attendify-600">Loading registration form...</div>
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
            onClick={() => navigate('/register')}
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
              onClick={() => navigate('/register')}
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
          onClick={() => navigate('/register')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      </div>
      
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendee Registration</h1>
        <p className="text-muted-foreground">Register attendees for {event.name}</p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>{event.name}</CardTitle>
          <CardDescription>
            {formatDate(event.date)}
            {event.location && ` • ${event.location}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="class">Select Class</Label>
                <Select
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                >
                  <SelectTrigger
                    id="class"
                    className={errors['class'] ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.length === 0 ? (
                      <SelectItem value="no-classes" disabled>
                        No classes available
                      </SelectItem>
                    ) : (
                      classes.map(cls => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors['class'] && (
                  <p className="text-destructive text-sm">{errors['class']}</p>
                )}
                {classes.length === 0 && (
                  <p className="text-amber-600 text-sm">
                    No classes available. 
                    <Link to="/classes" className="ml-1 underline">
                      Add a class first
                    </Link>
                  </p>
                )}
              </div>
              
              <Separator />
              
              {event.customFields.map(field => (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={field.id}>
                    {field.name}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  
                  {field.type === 'text' && (
                    <Input
                      id={field.id}
                      value={fieldValues[field.id] || ''}
                      onChange={e => handleInputChange(field.id, e.target.value)}
                      placeholder={`Enter ${field.name.toLowerCase()}`}
                      className={errors[field.id] ? 'border-destructive' : ''}
                    />
                  )}
                  
                  {field.type === 'number' && (
                    <Input
                      id={field.id}
                      type="number"
                      value={fieldValues[field.id] || ''}
                      onChange={e => handleInputChange(field.id, e.target.value)}
                      placeholder={`Enter ${field.name.toLowerCase()}`}
                      className={errors[field.id] ? 'border-destructive' : ''}
                    />
                  )}
                  
                  {field.type === 'select' && field.options && (
                    <Select
                      value={fieldValues[field.id] || ''}
                      onValueChange={value => handleInputChange(field.id, value)}
                    >
                      <SelectTrigger
                        id={field.id}
                        className={errors[field.id] ? 'border-destructive' : ''}
                      >
                        <SelectValue placeholder={`Select ${field.name.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {errors[field.id] && (
                    <p className="text-destructive text-sm">{errors[field.id]}</p>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFieldValues({});
                  setErrors({});
                }}
              >
                Clear Form
              </Button>
              <Button 
                type="submit"
                className="bg-attendify-600 hover:bg-attendify-700"
                disabled={isSubmitting || classes.length === 0}
              >
                {isSubmitting ? 'Registering...' : 'Register Attendee'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// This component is shown when no event is selected
const EventSelectionPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
        <h1 className="text-2xl font-bold tracking-tight">Register Attendees</h1>
        <p className="text-muted-foreground">Select an event to register attendees</p>
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
              No events found. Create an event first to register attendees.
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
            <Link key={event.id} to={`/register/${event.id}`} className="block">
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
                  <ClipboardList className="h-5 w-5 text-attendify-500" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegistrationPage;
