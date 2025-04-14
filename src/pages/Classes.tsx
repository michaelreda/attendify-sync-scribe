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
import { PlusCircle, Users, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

// Validation schema for class form
const classFormSchema = z.object({
  name: z.string().min(1, "Class name is required"),
  grade: z.string().optional(),
  servants: z.array(z.string()).default([]),
  servantInput: z.string().optional(),
});

const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [deletingClass, setDeletingClass] = useState<Class | null>(null);
  
  const form = useForm<z.infer<typeof classFormSchema>>({
    resolver: zodResolver(classFormSchema),
    defaultValues: {
      name: "",
      grade: "",
      servants: [],
      servantInput: "",
    },
  });
  
  useEffect(() => {
    loadData();

    // Subscribe to real-time updates
    const unsubscribe = dbService.subscribeToClasses((updatedClasses) => {
      setClasses(updatedClasses || []);
    });

    return () => {
      unsubscribe();
    };
  }, []);
  
  const loadData = async () => {
    try {
      setIsLoading(true);
      const loadedClasses = await dbService.getClasses();
      setClasses(loadedClasses || []);
    } catch (error) {
      console.error('Failed to load classes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load classes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetForm = () => {
    form.reset();
    setEditingClass(null);
  };
  
  const handleAddServant = () => {
    const servantInput = form.getValues('servantInput');
    if (servantInput?.trim()) {
      const currentServants = form.getValues('servants') || [];
      form.setValue('servants', [...currentServants, servantInput.trim()]);
      form.setValue('servantInput', '');
    }
  };
  
  const handleRemoveServant = (index: number) => {
    const currentServants = form.getValues('servants') || [];
    form.setValue('servants', currentServants.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async (values: z.infer<typeof classFormSchema>) => {
    try {
      if (editingClass) {
        // Update existing class
        await dbService.updateClass({
          id: editingClass.id,
          name: values.name,
          grade: values.grade || undefined,
          servants: values.servants || [],
          updatedAt: new Date().toISOString()
        });
        
        toast({
          title: 'Class updated successfully',
          description: 'The class has been updated and will sync when online'
        });
        
        setEditDialogOpen(false);
      } else {
        // Add new class
        await dbService.addClass({
          name: values.name,
          grade: values.grade || undefined,
          servants: values.servants || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        
        toast({
          title: 'Class added successfully',
          description: 'The class has been saved locally and will sync when online'
        });
        
        setDialogOpen(false);
      }
      
      resetForm();
      loadData();
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
    form.reset({
      name: cls.name,
      grade: cls.grade || '',
      servants: cls.servants || [],
    });
    setEditDialogOpen(true);
  };
  
  const handleDeleteClass = async () => {
    if (!deletingClass) return;
    
    try {
      await dbService.deleteClass(deletingClass.id);
      toast({
        title: 'Class deleted successfully',
        description: 'The class has been deleted and will sync when online'
      });
      setDeleteDialogOpen(false);
      setDeletingClass(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete class:', error);
      toast({
        title: 'Error deleting class',
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
  
  // Class Form Dialog content shared between Add and Edit modes
  const ClassFormContent = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Class Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter class name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="grade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grade (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter grade (e.g., 1st, 2nd, 3rd)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="servants"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Servants</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <div className="flex space-x-2">
                    <FormField
                      control={form.control}
                      name="servantInput"
                      render={({ field: servantField }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder="Add servant name"
                              {...servantField}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddServant();
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="button" 
                      variant="secondary" 
                      onClick={handleAddServant}
                    >
                      Add
                    </Button>
                  </div>
                  {field.value && field.value.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-2">
                      {field.value.map((servant, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {servant}
                          <button
                            type="button"
                            onClick={() => handleRemoveServant(index)}
                            className="ml-1 rounded-full w-4 h-4 inline-flex items-center justify-center hover:bg-attendify-300 transition-colors"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
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
          <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                onClick={form.handleSubmit(handleSubmit)}
                className="bg-attendify-600 hover:bg-attendify-700"
              >
                Save Class
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Edit Class Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                onClick={form.handleSubmit(handleSubmit)}
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
                  <div className="flex space-x-1">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingClass(cls);
                        setDeleteDialogOpen(true);
                      }}
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
                <CardDescription>Created on {formatDate(cls.createdAt)}</CardDescription>
              </CardHeader>
              <CardContent>
                <h4 className="text-sm font-medium mb-2">Servants:</h4>
                {(!cls.servants || cls.servants.length === 0) ? (
                  <p className="text-sm text-muted-foreground">No servants assigned</p>
                ) : (
                  <ScrollArea className="h-24">
                    <div className="flex flex-wrap gap-2">
                      {(cls.servants || []).map((servant, i) => (
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Class</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingClass?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeleteDialogOpen(false);
              setDeletingClass(null);
            }}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteClass}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassesPage;
