import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GraduationCap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EventCard } from '@/components/EventCard';
import { ClassCard } from '@/components/ClassCard';

const EventRegistrationPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [classes, setClasses] = useState<Record<string, Class>>({});
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameFieldId, setNameFieldId] = useState<string | null>(null);
  const [phoneFields, setPhoneFields] = useState<CustomField[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClasses, setFilteredClasses] = useState<Class[]>([]);

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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Event Registration</h1>
          <p className="text-muted-foreground">
            {event ? `Register for ${event.name}` : 'Select an event to register'}
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
          <p className="text-muted-foreground">Please select an event to register</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search classes..."
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
            {filteredClasses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'No classes found matching your search'
                    : 'No classes available for this event'}
                </p>
              </div>
            ) : (
              filteredClasses.map(renderClassCard)
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default EventRegistrationPage; 