
import React, { useEffect, useState } from 'react';
import { Class } from '../types';
import dbService from '../services/db.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { PlusCircle, Users, GraduationCap, Pencil } from 'lucide-react';

const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  
  // Form state
  const [className, setClassName] = useState('');
  const [grade, setGrade] = useState('');
  const [servantInput, setServantInput] = useState('');
  const [servants, setServants] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  
  useEffect(() => {
    loadClasses();
  }, []);
  
  const loadClasses = async () => {
    try {
      setIsLoading(true);
      const loadedClasses = await dbService.getClasses();
      setClasses(loadedClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
      toast({
        title: 'Error loading classes',
        description: 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    setClassName('');
    setGrade('');
    setServantInput('');
    setServants([]);
    setNameError('');
    setEditingClass(null);
  };
  
  const handleAddServant = () => {
    if (servantInput.trim()) {
      setServants(prev => [...prev, servantInput.trim()]);
      setServantInput('');
    }
  };
  
  const handleRemoveServant = (index: number) => {
    setServants(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async () => {
    // Validate
    if (!className.trim()) {
      setNameError('Class name is required');
      return;
    }
    
    try {
      if (editingClass) {
        // Update existing class
        await dbService.updateClass({
          id: editingClass.id,
          name: className.trim(),
          grade: grade.trim() || undefined,
          servants: servants,
          createdAt: editingClass.createdAt,
          updatedAt: editingClass.updatedAt
        });
        
        toast({
          title: 'Class updated successfully',
          description: 'The class has been updated and will sync when online'
        });
        
        setEditDialogOpen(false);
      } else {
        // Add new class
        await dbService.addClass({
          name: className.trim(),
          grade: grade.trim() || undefined,
          servants: servants
        });
        
        toast({
          title: 'Class added successfully',
          description: 'The class has been saved locally and will sync when online'
        });
        
        setDialogOpen(false);
      }
      
      resetForm();
      loadClasses();
    } catch (error) {
      console.error('Failed to save class:', error);
      toast({
        title: `Error ${editingClass ? 'updating' : 'adding'} class`,
        description: 'Please try again',
        variant: 'destructive'
      });
    }
  };
  
  const handleEditClass = (cls: Class) => {
    setEditingClass(cls);
    setClassName(cls.name);
    setGrade(cls.grade || '');
    setServants(cls.servants || []);
    setEditDialogOpen(true);
  };
  
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'PPP');
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Class Form Dialog content shared between Add and Edit modes
  const ClassFormContent = () => (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="className">Class Name</Label>
          <Input
            id="className"
            value={className}
            onChange={(e) => {
              setClassName(e.target.value);
              setNameError('');
            }}
            placeholder="Enter class name"
          />
          {nameError && <p className="text-destructive text-sm">{nameError}</p>}
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="grade">Grade (Optional)</Label>
          <Input
            id="grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="Enter grade (e.g., 1st, 2nd, 3rd)"
          />
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="servants">Servants</Label>
          <div className="flex space-x-2">
            <Input
              id="servants"
              value={servantInput}
              onChange={(e) => setServantInput(e.target.value)}
              placeholder="Add servant name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddServant();
                }
              }}
            />
            <Button 
              type="button" 
              variant="secondary" 
              onClick={handleAddServant}
            >
              Add
            </Button>
          </div>
        </div>
        
        {servants.length > 0 && (
          <div className="grid gap-2">
            <Label>Added Servants</Label>
            <div className="flex flex-wrap gap-2 py-2">
              {servants.map((servant, index) => (
                <Badge 
                  key={index} 
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {servant}
                  <button
                    onClick={() => handleRemoveServant(index)}
                    className="ml-1 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-attendify-300 transition-colors"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">Manage your classes and servants</p>
        </div>
        
        {/* Add Class Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-attendify-600 hover:bg-attendify-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Class
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add a New Class</DialogTitle>
              <DialogDescription>
                Create a new class with grade and servants
              </DialogDescription>
            </DialogHeader>
            
            <ClassFormContent />
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                className="bg-attendify-600 hover:bg-attendify-700"
              >
                Save Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit Class Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Class</DialogTitle>
              <DialogDescription>
                Update class information
              </DialogDescription>
            </DialogHeader>
            
            <ClassFormContent />
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                resetForm();
                setEditDialogOpen(false);
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit}
                className="bg-attendify-600 hover:bg-attendify-700"
              >
                Update Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Separator />
      
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-pulse text-attendify-600">Loading classes...</div>
        </div>
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-40 p-6">
            <Users className="h-12 w-12 text-attendify-400 mb-4" />
            <CardDescription className="text-center">
              No classes found. Add your first class to get started.
            </CardDescription>
            <Button
              className="mt-4 bg-attendify-600 hover:bg-attendify-700"
              onClick={() => setDialogOpen(true)}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add First Class
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card key={cls.id} className="transition-all hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-semibold flex items-center">
                    {cls.name}
                    {cls.grade && (
                      <Badge variant="outline" className="bg-attendify-50 ml-2 flex items-center">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {cls.grade}
                      </Badge>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClass(cls);
                    }}
                    className="h-8 w-8 rounded-full"
                  >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                  </Button>
                </div>
                <CardDescription>Created on {formatDate(cls.createdAt)}</CardDescription>
              </CardHeader>
              <CardContent>
                <h4 className="text-sm font-medium mb-2">Servants:</h4>
                {cls.servants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No servants assigned</p>
                ) : (
                  <ScrollArea className="h-24">
                    <div className="flex flex-wrap gap-2">
                      {cls.servants.map((servant, i) => (
                        <Badge key={i} variant="outline" className="bg-attendify-50">
                          {servant}
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassesPage;
