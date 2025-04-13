
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Calendar, ClipboardList, UserCheck, Users } from 'lucide-react';
import dbService from '../services/db.service';

const Index: React.FC = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if any classes exist and redirect to classes page if none
    const checkClasses = async () => {
      const hasClasses = await dbService.hasAnyClasses();
      if (!hasClasses) {
        navigate('/classes');
      }
    };
    
    checkClasses();
  }, [navigate]);
  
  return (
    <div className="space-y-8 py-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-attendify-800">
          AttendifySync
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          An offline-first application for managing event attendance with automatic syncing when online
        </p>
      </div>
      
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-5xl mx-auto">
        <Card className="transition-all hover:shadow-md hover:border-attendify-300">
          <CardHeader className="pb-2">
            <Users className="h-6 w-6 text-attendify-600 mb-2" />
            <CardTitle className="text-lg">Manage Classes</CardTitle>
            <CardDescription>
              Create and manage your classes and servants
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Link to="/classes" className="w-full">
              <Button className="w-full bg-attendify-600 hover:bg-attendify-700">
                <span>Go to Classes</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
        
        <Card className="transition-all hover:shadow-md hover:border-attendify-300">
          <CardHeader className="pb-2">
            <Calendar className="h-6 w-6 text-attendify-600 mb-2" />
            <CardTitle className="text-lg">Manage Events</CardTitle>
            <CardDescription>
              Create events with custom registration fields
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Link to="/events" className="w-full">
              <Button className="w-full bg-attendify-600 hover:bg-attendify-700">
                <span>Go to Events</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
        
        <Card className="transition-all hover:shadow-md hover:border-attendify-300">
          <CardHeader className="pb-2">
            <ClipboardList className="h-6 w-6 text-attendify-600 mb-2" />
            <CardTitle className="text-lg">Register Attendees</CardTitle>
            <CardDescription>
              Add attendees to events with custom fields
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Link to="/register" className="w-full">
              <Button className="w-full bg-attendify-600 hover:bg-attendify-700">
                <span>Register Now</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
        
        <Card className="transition-all hover:shadow-md hover:border-attendify-300">
          <CardHeader className="pb-2">
            <UserCheck className="h-6 w-6 text-attendify-600 mb-2" />
            <CardTitle className="text-lg">Take Attendance</CardTitle>
            <CardDescription>
              Mark attendance for registered attendees
            </CardDescription>
          </CardHeader>
          <CardFooter className="pt-2">
            <Link to="/attendance" className="w-full">
              <Button className="w-full bg-attendify-600 hover:bg-attendify-700">
                <span>Take Attendance</span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
      
      <div className="max-w-3xl mx-auto mt-12 p-6 bg-attendify-50 rounded-lg border border-attendify-100">
        <h2 className="text-xl font-bold mb-4 text-attendify-800">How AttendifySync Works</h2>
        
        <div className="space-y-4">
          <div className="flex space-x-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-attendify-600 text-white flex items-center justify-center text-sm font-medium">1</div>
            <div>
              <h3 className="font-medium">Create Classes</h3>
              <p className="text-sm text-muted-foreground">Start by creating classes with servant names to organize your attendees.</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-attendify-600 text-white flex items-center justify-center text-sm font-medium">2</div>
            <div>
              <h3 className="font-medium">Set Up Events</h3>
              <p className="text-sm text-muted-foreground">Create events with custom registration fields (password: "admin").</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-attendify-600 text-white flex items-center justify-center text-sm font-medium">3</div>
            <div>
              <h3 className="font-medium">Register Attendees</h3>
              <p className="text-sm text-muted-foreground">Add attendees to your events using the custom form fields.</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-attendify-600 text-white flex items-center justify-center text-sm font-medium">4</div>
            <div>
              <h3 className="font-medium">Take Attendance</h3>
              <p className="text-sm text-muted-foreground">Mark attendance for your registered attendees at the event.</p>
            </div>
          </div>
          
          <div className="flex space-x-3">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-attendify-600 text-white flex items-center justify-center text-sm font-medium">5</div>
            <div>
              <h3 className="font-medium">Auto-Sync When Online</h3>
              <p className="text-sm text-muted-foreground">All your data is saved locally and automatically syncs when you're online.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
