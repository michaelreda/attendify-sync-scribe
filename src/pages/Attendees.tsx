import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ArrowLeft } from 'lucide-react';

const AttendeesPage: React.FC = () => {
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | null>(null);

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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Attendees</h1>
          <p className="text-muted-foreground">
            {event ? `Managing attendees for ${event.name}` : 'Select an event to manage attendees'}
          </p>
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
          <p className="text-muted-foreground">Please select an event to manage attendees</p>
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

export default AttendeesPage; 