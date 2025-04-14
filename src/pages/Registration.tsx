import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Class, Attendee, Event, CustomField } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Users, User, X, Check, Trash2, ArrowLeft, Search, GraduationCap, Contact } from 'lucide-react';

// Add type definition for contacts API
declare global {
  interface Navigator {
    contacts: {
      select(properties: string[], options: { multiple: boolean }): Promise<Array<{
        name?: string[];
        tel?: string[];
      }>>;
    };
  }
}

// Helper function to check if a field is a phone field
const isPhoneField = (field: CustomField): boolean => {
  return field.type === 'phone';
};

const RegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | null>(null);

  // Form state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [nameInputValue, setNameInputValue] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [otherFields, setOtherFields] = useState<Record<string, string>>({});
  const [otherFieldsErrors, setOtherFieldsErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameFieldId, setNameFieldId] = useState<string | null>(null);
  const [phoneFields, setPhoneFields] = useState<CustomField[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);

  useEffect(() => {
    if (eventId) {
      loadData();
    }
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
    // Filter classes based on search query and selected class
    let filtered = Object.values(classes);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(cls => 
        cls.name.toLowerCase().includes(query) ||
        (cls.grade && cls.grade.toLowerCase().includes(query))
      );
    }
    
    if (selectedClassId) {
      filtered = filtered.filter(cls => cls.id === selectedClassId);
    }
    
    setFilteredClasses(filtered);
  }, [searchQuery, classes, selectedClassId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const loadedClasses = await dbService.getClasses();
      const loadedAttendees = await dbService.getAttendees(eventId!);
      const eventData = await dbService.getEvent(eventId!);
      setClasses(loadedClasses);
      setAttendees(loadedAttendees);
      setEvent(eventData);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedClassId(null);
    setNameInputValue('');
    setNameError(undefined);
    setOtherFields({});
    setOtherFieldsErrors({});
  };

  const handleSubmit = async () => {
    if (!selectedClassId) {
      toast({
        title: 'Error',
        description: 'Please select a class.',
        variant: 'destructive',
      });
      return;
    }

    if (!nameInputValue.trim()) {
      setNameError('Name is required');
      return;
    }

    const newAttendeeValues = event?.customFields.map(field => {
      let value = '';
      if (field.name.toLowerCase() === 'name' || field.name.toLowerCase() === 'full name') {
        value = nameInputValue;
      } else if (otherFields[field.id]) {
        value = otherFields[field.id];
      }
      return { fieldId: field.id, value };
    }) || [];

    try {
      await dbService.addAttendee({
        classId: selectedClassId,
        eventId: eventId!,
        values: newAttendeeValues,
        attended: false,
      });

      toast({
        title: 'Success',
        description: 'Attendee registered successfully!',
      });

      resetForm();
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Registration failed:', error);
      toast({
        title: 'Error',
        description: 'Registration failed. Please try again.',
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

  const handleInputChange = (fieldId: string, value: string) => {
    setOtherFields(prev => ({
      ...prev,
      [fieldId]: value,
    }));
  
    setOtherFieldsErrors(prev => ({
      ...prev,
      [fieldId]: undefined,
    }));
  };

  const validateField = (fieldId: string, value: string, required: boolean) => {
    if (required && !value.trim()) {
      setOtherFieldsErrors(prev => ({
        ...prev,
        [fieldId]: 'This field is required',
      }));
      return false;
    }
    return true;
  };

  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameInputValue(e.target.value);
    setNameError(undefined);
  };

  const validateName = () => {
    if (!nameInputValue.trim()) {
      setNameError('Name is required');
      return false;
    }
    return true;
  };

  const handleDeleteAttendee = async () => {
    if (!deletingAttendee) return;
    
    try {
      await dbService.deleteAttendee(deletingAttendee.id);
      toast({
        title: 'Attendee deleted successfully',
        description: 'The attendee has been deleted and will sync when online'
      });
      setDeleteDialogOpen(false);
      setDeletingAttendee(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete attendee:', error);
      toast({
        title: 'Error deleting attendee',
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };

  const handleContactSelect = async (fieldId: string) => {
    try {
      // Check if we're on a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // For mobile devices, try to use the native contact picker
        if ('contacts' in navigator) {
          try {
            const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
            if (contacts && contacts.length > 0) {
              const contact = contacts[0];
              if (contact.tel && contact.tel.length > 0) {
                handleInputChange(fieldId, contact.tel[0]);
                return;
              }
            }
          } catch (error) {
            console.log('Native contact picker failed, falling back to file picker');
          }
        }
      }

      // Fallback for desktop browsers
      toast({
        title: 'Contact Selection',
        description: 'Please enter the phone number manually. On mobile devices, you can export a contact and select the .vcf file.',
        variant: 'default'
      });
      
    } catch (error) {
      console.error('Error selecting contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to select contact. Please enter the phone number manually.',
        variant: 'destructive'
      });
    }
  };

  const renderAttendeeRow = (attendee: Attendee) => {
    const attendeeClass = classes.find(cls => cls.id === attendee.classId);
    const nameFieldValue = attendee.values.find(v =>
      event?.customFields.some(f =>
        (f.name.toLowerCase() === 'name' || f.name.toLowerCase() === 'full name') && f.id === v.fieldId
      )
    )?.value;
  
    return (
      <div key={attendee.id} className="flex items-center justify-between py-2">
        <div className="flex items-center">
          <User className="h-5 w-5 mr-2" />
          <span>{nameFieldValue || 'Unnamed Attendee'}</span>
        </div>
        <div className="flex items-center space-x-2">
          {attendeeClass ? (
            <Badge variant="secondary">{attendeeClass.name}</Badge>
          ) : (
            <Badge variant="outline">Class not found</Badge>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDeletingAttendee(attendee);
              setDeleteDialogOpen(true);
            }}
            className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>
    );
  };

  const renderClassCard = (cls: Class) => {
    const classAttendees = attendees.filter(a => a.classId === cls.id);
    const attendeeCount = classAttendees.length;
    const maxAttendees = cls.maxAttendees || 0;
    const isFull = maxAttendees > 0 && attendeeCount >= maxAttendees;

    return (
      <Card key={cls.id} className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-attendify-600" />
                {cls.name}
                {cls.grade && (
                  <Badge variant="outline" className="ml-2">
                    {cls.grade}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {cls.description || 'No description provided'}
              </CardDescription>
            </div>
            <Badge variant={isFull ? "destructive" : "default"}>
              {attendeeCount} / {maxAttendees || '∞'} attendees
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setSelectedClassId(cls.id);
                setIsDialogOpen(true);
              }}
              disabled={isFull}
              className="bg-attendify-600 hover:bg-attendify-700"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Register Attendee
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderAttendeeForm = () => (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="className">Class</Label>
          <Select onValueChange={setSelectedClassId} value={selectedClassId}>
            <SelectTrigger id="class">
              <SelectValue placeholder="Select a class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={nameInputValue}
            onChange={handleNameInputChange}
            placeholder="Enter attendee name"
          />
          {nameError && <p className="text-destructive text-sm">{nameError}</p>}
        </div>

        {event?.customFields
          .filter(field => field.name.toLowerCase() !== 'name' && field.name.toLowerCase() !== 'full name')
          .map(field => (
            <div className="grid gap-2" key={field.id}>
              <Label htmlFor={`field-${field.id}`}>{field.name} {field.required ? '*' : ''}</Label>
              <div className="flex gap-2">
                <Input
                  id={`field-${field.id}`}
                  type={isPhoneField(field) ? "tel" : "text"}
                  value={otherFields[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  placeholder={`Enter ${field.name.toLowerCase()}`}
                  onBlur={() => validateField(field.id, otherFields[field.id] || '', field.required)}
                />
                {isPhoneField(field) && 'contacts' in navigator && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleContactSelect(field.id)}
                    title="Select from contacts"
                  >
                    <Contact className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {otherFieldsErrors[field.id] && <p className="text-destructive text-sm">{otherFieldsErrors[field.id]}</p>}
            </div>
          ))
        }
      </div>
    </>
  );

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Registration</h1>
          <p className="text-muted-foreground">
            {event ? `Register for ${event.name}` : 'Select an event to register'}
          </p>
          {event && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-attendify-50">
                <Users className="h-3 w-3 mr-1" />
                Total Attendees: {attendees.length}
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
          <p className="text-muted-foreground">Please select an event to register</p>
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
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h2 className="text-xl font-semibold">Registered Attendees</h2>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="w-full sm:w-auto bg-attendify-600 hover:bg-attendify-700"
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Register New Attendee
              </Button>
            </div>

            {attendees.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No attendees registered yet
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-2 p-4">
                      {attendees.map(renderAttendeeRow)}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Registration Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Register New Attendee</DialogTitle>
                <DialogDescription>
                  Register a new attendee for this event
                </DialogDescription>
              </DialogHeader>

              {renderAttendeeForm()}

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  resetForm();
                  setIsDialogOpen(false);
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} className="bg-attendify-600 hover:bg-attendify-700">
                  Register Attendee
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Attendee</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this attendee? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setDeleteDialogOpen(false);
                  setDeletingAttendee(null);
                }}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleDeleteAttendee}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default RegistrationPage;
