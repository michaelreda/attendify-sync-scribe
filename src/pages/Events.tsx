import React, { useEffect, useState } from 'react';
import { Event, CustomField, FieldType, Attendee } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Calendar, Lock, Trash, Plus, X, Pencil, Trash2, Users, CheckCircle, UserPlus, UserCheck } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

// Admin password for creating events
const ADMIN_PASSWORD = 'admin';

// Validation schema for admin password
const passwordSchema = z.object({
  password: z.string().min(1, "Password is required")
});

// Validation schema for event form
const eventFormSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  date: z.string().min(1, "Event date is required"),
  location: z.string().optional(),
  description: z.string().optional(),
});

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const navigate = useNavigate();
  const [selectedEventId, setSelectedEventId] = useState('');
  const [changeEventDialogOpen, setChangeEventDialogOpen] = useState(false);
  
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
    },
  });
  
  const eventForm = useForm<z.infer<typeof eventFormSchema>>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: "",
      date: format(new Date(), 'yyyy-MM-dd'),
      location: "",
      description: "",
    },
  });
  
  useEffect(() => {
    loadEvents();
  }, []);
  
  const loadEvents = async () => {
    try {
      setIsLoading(true);
      const loadedEvents = await dbService.getEvents();
      setEvents(loadedEvents);
      
      // Load all attendees
      const loadedAttendees = await dbService.getAllAttendees();
      setAttendees(loadedAttendees);
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
  
  const resetForms = () => {
    passwordForm.reset();
    eventForm.reset();
    setCustomFields([]);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptions('');
    setEditingEvent(null);
  };
  
  const handlePasswordSubmit = (values: z.infer<typeof passwordSchema>) => {
    if (values.password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminDialogOpen(false);
      setEventDialogOpen(true);
    } else {
      passwordForm.setError("password", { 
        message: "Incorrect password" 
      });
    }
  };
  
  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    eventForm.reset({
      name: event.name,
      date: event.date,
      location: event.location || '',
      description: event.description || '',
    });
    setCustomFields(event.customFields);
    setEditDialogOpen(true);
  };
  
  const addCustomField = () => {
    if (!newFieldName.trim()) {
      toast({
        title: 'Error',
        description: 'Field name is required',
        variant: 'destructive'
      });
      return;
    }
    
    // For select fields, validate that we have options
    if (newFieldType === 'select' && !newFieldOptions.trim()) {
      toast({
        title: 'Error',
        description: 'Select fields require at least one option',
        variant: 'destructive'
      });
      return;
    }
    
    const newField: CustomField = {
      id: Date.now().toString(),
      name: newFieldName.trim(),
      type: newFieldType,
      required: newFieldRequired,
    };
    
    if (newFieldType === 'select') {
      newField.options = newFieldOptions.split(',').map(opt => opt.trim()).filter(opt => opt);
    }
    
    setCustomFields(prev => [...prev, newField]);
    setNewFieldName('');
    setNewFieldType('text');
    setNewFieldRequired(false);
    setNewFieldOptions('');
  };
  
  const removeField = (index: number) => {
    setCustomFields(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleEventSubmit = async (values: z.infer<typeof eventFormSchema>) => {
    // Ensure at least one field for attendee registration
    if (customFields.length === 0) {
      toast({
        title: 'Error',
        description: 'Add at least one custom field for attendee registration',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      // Add a name field by default if not already added
      let fieldsToUse = [...customFields];
      const hasNameField = fieldsToUse.some(field => 
        field.name.toLowerCase() === 'name' || 
        field.name.toLowerCase() === 'full name'
      );
      
      if (!hasNameField) {
        fieldsToUse.unshift({
          id: 'default-name-field',
          name: 'Name',
          type: 'text',
          required: true
        });
      }
      
      if (editingEvent) {
        // Update existing event
        await dbService.updateEvent({
          id: editingEvent.id,
          name: values.name,
          date: values.date,
          location: values.location,
          description: values.description,
          customFields: fieldsToUse,
          createdAt: editingEvent.createdAt,
          updatedAt: new Date().toISOString()
        });
        
        toast({
          title: 'Event updated successfully',
          description: 'The event has been updated and will sync when online'
        });
        
        setEditDialogOpen(false);
      } else {
        // Add new event
        await dbService.addEvent({
          name: values.name,
          date: values.date,
          location: values.location,
          description: values.description,
          customFields: fieldsToUse
        });
        
        toast({
          title: 'Event created successfully',
          description: 'The event has been saved locally and will sync when online'
        });
        
        setEventDialogOpen(false);
      }
      
      resetForms();
      loadEvents();
    } catch (error) {
      console.error('Failed to save event:', error);
      toast({
        title: `Error ${editingEvent ? 'updating' : 'creating'} event`,
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    
    try {
      await dbService.deleteEvent(deletingEvent.id);
      toast({
        title: 'Event deleted successfully',
        description: 'The event has been deleted and will sync when online'
      });
      setDeleteDialogOpen(false);
      setDeletingEvent(null);
      loadEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast({
        title: 'Error deleting event',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };
  
  const renderEventCard = (event: Event) => {
    const eventAttendees = attendees.filter(a => a.eventId === event.id);
    const attendedCount = eventAttendees.filter(a => a.attended).length;
    const totalCount = eventAttendees.length;

    return (
      <Card key={event.id} className="transition-all hover:shadow-md">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{event.name}</CardTitle>
              <CardDescription>
                {formatDate(event.date)}
              </CardDescription>
              <div className="mt-2 flex gap-2">
                <Badge variant="outline" className="bg-attendify-50">
                  <Users className="h-3 w-3 mr-1" />
                  Total: {totalCount}
                </Badge>
                <Badge variant="outline" className="bg-green-50">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Attended: {attendedCount}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingEvent(event);
                  setEditDialogOpen(true);
                }}
                className="h-8 w-8 rounded-full hover:bg-attendify-100"
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setDeletingEvent(event);
                  setDeleteDialogOpen(true);
                }}
                className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {event.customFields && event.customFields.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Custom Fields:</h4>
                <div className="flex flex-wrap gap-2">
                  {event.customFields.map((field) => (
                    <Badge key={field.id} variant="outline">
                      {field.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/attendance/${event.id}`)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Take Attendance
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/attendees/${event.id}`)}
              >
                <Users className="mr-2 h-4 w-4" />
                Manage Attendees
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/registration/${event.id}`)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Register
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Events</h1>
            <p className="text-muted-foreground">View and manage your attendance events</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-attendify-600 hover:bg-attendify-700">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Admin Authentication</DialogTitle>
                  <DialogDescription>
                    Enter the admin password to create a new event
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={passwordForm.watch('password')}
                      onChange={(e) => passwordForm.setValue('password', e.target.value)}
                      placeholder="Enter admin password"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAdminDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={passwordForm.handleSubmit(handlePasswordSubmit)}
                    disabled={!passwordForm.formState.isValid}
                  >
                    Submit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Dialog open={changeEventDialogOpen} onOpenChange={setChangeEventDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4" />
              Change Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Change Event</DialogTitle>
              <DialogDescription>
                Select a different event to view
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="event">Event</Label>
                <Select
                  value={selectedEventId}
                  onValueChange={(value) => {
                    setSelectedEventId(value);
                    setChangeEventDialogOpen(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setChangeEventDialogOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              No events found. Create your first event to get started.
            </CardDescription>
            <Button
              className="mt-4 bg-attendify-600 hover:bg-attendify-700"
              onClick={() => setAdminDialogOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create First Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <Card key={event.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold">{event.name}</CardTitle>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditEvent(event)}
                      className="h-8 w-8 rounded-full"
                    >
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingEvent(event);
                        setDeleteDialogOpen(true);
                      }}
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
                <CardDescription>{formatDate(event.date)}</CardDescription>
              </CardHeader>
              <CardContent>
                {event.location && (
                  <p className="text-sm mb-2">
                    <span className="font-medium">Location:</span> {event.location}
                  </p>
                )}
                {event.description && (
                  <p className="text-sm mb-2">
                    <span className="font-medium">Description:</span> {event.description}
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-medium">Registration Fields:</span> {event.customFields.length}
                </p>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 pt-0">
                <Link to={`/register/${event.id}`}>
                  <Button variant="outline" size="sm">
                    Register Attendees
                  </Button>
                </Link>
                <Link to={`/attendance/${event.id}`}>
                  <Button 
                    size="sm"
                    className="bg-attendify-600 hover:bg-attendify-700"
                  >
                    Take Attendance
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingEvent?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingEvent(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteEvent}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsPage;
