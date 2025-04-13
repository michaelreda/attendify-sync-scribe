import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Class, Attendee, Event } from '../types';
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
import { PlusCircle, Users, User, X, Check } from 'lucide-react';

const RegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [nameInputValue, setNameInputValue] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [otherFields, setOtherFields] = useState<Record<string, string>>({});
  const [otherFieldsErrors, setOtherFieldsErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId]);

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
    setSelectedClassId(undefined);
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
        {attendeeClass ? (
          <Badge variant="secondary">{attendeeClass.name}</Badge>
        ) : (
          <Badge variant="outline">Class not found</Badge>
        )}
      </div>
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
              <Input
                id={`field-${field.id}`}
                value={otherFields[field.id] || ''}
                onChange={(e) => handleInputChange(field.id, e.target.value)}
                placeholder={`Enter ${field.name.toLowerCase()}`}
                onBlur={() => validateField(field.id, otherFields[field.id] || '', field.required)}
              />
              {otherFieldsErrors[field.id] && <p className="text-destructive text-sm">{otherFieldsErrors[field.id]}</p>}
            </div>
          ))
        }
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Registration</h1>
          {event && (
            <p className="text-muted-foreground">
              Register attendees for {event.name} on {formatDate(event.date)}
            </p>
          )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-attendify-600 hover:bg-attendify-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Register Attendee
            </Button>
          </DialogTrigger>
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
      </div>

      <Separator />

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-pulse text-attendify-600">Loading data...</div>
        </div>
      ) : attendees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <User className="h-12 w-12 text-attendify-400 mb-4" />
            <CardDescription className="text-center">
              No attendees registered for this event yet.
            </CardDescription>
            <Button
              className="mt-4 bg-attendify-600 hover:bg-attendify-700"
              onClick={() => setIsDialogOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Register First Attendee
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attendees.map(renderAttendeeRow)}
        </div>
      )}
    </div>
  );
};

export default RegistrationPage;
