import React, { useEffect, useState } from 'react';
import { Event, CustomField, FieldType } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Calendar, Lock, Trash, Plus, X, Pencil } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Link } from 'react-router-dom';

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
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground">View and manage your attendance events</p>
        </div>
        
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
            
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4 py-4">
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admin Password</FormLabel>
                      <FormControl>
                        <div className="flex space-x-2 items-center">
                          <Input 
                            type="password" 
                            placeholder="Enter password" 
                            {...field} 
                          />
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setAdminDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-attendify-600 hover:bg-attendify-700"
                  >
                    Verify
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Event creation dialog - only shows after admin auth */}
        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>
                Set up an event and define custom registration fields
              </DialogDescription>
            </DialogHeader>
            
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(handleEventSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={eventForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter event name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Custom Registration Fields</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Define the fields attendees will fill out during registration
                  </p>
                  
                  {/* List of added fields */}
                  {customFields.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {customFields.map((field, index) => (
                        <div 
                          key={field.id} 
                          className="flex items-center justify-between bg-muted p-3 rounded-md"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{field.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Type: {field.type} | {field.required ? 'Required' : 'Optional'}
                              {field.options && field.options.length > 0 && (
                                <> | Options: {field.options.join(', ')}</>
                              )}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeField(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new field form */}
                  <div className="space-y-4 bg-attendify-50 p-4 rounded-md">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fieldName">Field Name</Label>
                        <Input
                          id="fieldName"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          placeholder="e.g., Phone Number"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="fieldType">Field Type</Label>
                        <Select
                          value={newFieldType}
                          onValueChange={(value: FieldType) => {
                            setNewFieldType(value);
                            if (value !== 'select') {
                              setNewFieldOptions('');
                            }
                          }}
                        >
                          <SelectTrigger id="fieldType">
                            <SelectValue placeholder="Select field type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>                
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="select">Dropdown Select</SelectItem>                
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="required"
                        checked={newFieldRequired}
                        onCheckedChange={setNewFieldRequired}
                      />
                      <Label htmlFor="required">Required Field</Label>
                    </div>
                    
                    {newFieldType === 'select' && (
                      <div className="space-y-2">
                        <Label htmlFor="options">
                          Options (comma separated)
                        </Label>
                        <Input
                          id="options"
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          placeholder="Option 1, Option 2, Option 3"
                        />
                        <p className="text-xs text-muted-foreground">
                          Separate each option with a comma
                        </p>
                      </div>
                    )}
                    
                    <Button
                      type="button"
                      onClick={addCustomField}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      resetForms();
                      setEventDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-attendify-600 hover:bg-attendify-700"
                  >
                    Create Event
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Edit Event Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
              <DialogDescription>
                Update event information and registration fields
              </DialogDescription>
            </DialogHeader>
            
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(handleEventSubmit)} className="space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={eventForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter event name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={eventForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-lg font-semibold mb-4">Custom Registration Fields</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Define the fields attendees will fill out during registration
                  </p>
                  
                  {/* List of added fields */}
                  {customFields.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {customFields.map((field, index) => (
                        <div 
                          key={field.id} 
                          className="flex items-center justify-between bg-muted p-3 rounded-md"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-sm">{field.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Type: {field.type} | {field.required ? 'Required' : 'Optional'}
                              {field.options && field.options.length > 0 && (
                                <> | Options: {field.options.join(', ')}</>
                              )}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeField(index)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new field form */}
                  <div className="space-y-4 bg-attendify-50 p-4 rounded-md">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fieldName">Field Name</Label>
                        <Input
                          id="fieldName"
                          value={newFieldName}
                          onChange={(e) => setNewFieldName(e.target.value)}
                          placeholder="e.g., Phone Number"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="fieldType">Field Type</Label>
                        <Select
                          value={newFieldType}
                          onValueChange={(value: FieldType) => {
                            setNewFieldType(value);
                            if (value !== 'select') {
                              setNewFieldOptions('');
                            }
                          }}
                        >
                          <SelectTrigger id="fieldType">
                            <SelectValue placeholder="Select field type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="number">Number</SelectItem>                
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="select">Dropdown Select</SelectItem>                
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="required"
                        checked={newFieldRequired}
                        onCheckedChange={setNewFieldRequired}
                      />
                      <Label htmlFor="required">Required Field</Label>
                    </div>
                    
                    {newFieldType === 'select' && (
                      <div className="space-y-2">
                        <Label htmlFor="options">
                          Options (comma separated)
                        </Label>
                        <Input
                          id="options"
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          placeholder="Option 1, Option 2, Option 3"
                        />
                        <p className="text-xs text-muted-foreground">
                          Separate each option with a comma
                        </p>
                      </div>
                    )}
                    
                    <Button
                      type="button"
                      onClick={addCustomField}
                      className="w-full"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Field
                    </Button>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      resetForms();
                      setEditDialogOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="bg-attendify-600 hover:bg-attendify-700"
                  >
                    Update Event
                  </Button>
                </DialogFooter>
              </form>
            </Form>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditEvent(event)}
                    className="h-8 w-8 rounded-full"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
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
    </div>
  );
};

export default EventsPage;
