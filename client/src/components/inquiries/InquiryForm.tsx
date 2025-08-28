import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

const inquirySchema = z.object({
  inquiryType: z.enum(['new_patient', 'follow_up', 'referral', 'general', 'emergency']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  notes: z.string().min(1, 'Notes are required'),
  contactMethod: z.enum(['phone', 'email', 'in_person', 'referral']),
  contactInfo: z.string().optional(),
  followUpDate: z.date().optional(),
  assignedTo: z.string().optional(),
});

type InquiryFormData = z.infer<typeof inquirySchema>;

interface InquiryFormProps {
  patientId: string;
  patientName: string;
  initialData?: Partial<InquiryFormData>;
  onSuccess?: () => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
  inquiryId?: string;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export function InquiryForm({
  patientId,
  patientName,
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
  inquiryId
}: InquiryFormProps) {
  const [open, setOpen] = useState(false);
  const [assignedToOpen, setAssignedToOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      inquiryType: initialData?.inquiryType || 'general',
      priority: initialData?.priority || 'medium',
      notes: initialData?.notes || '',
      contactMethod: initialData?.contactMethod || 'phone',
      contactInfo: initialData?.contactInfo || '',
      followUpDate: initialData?.followUpDate,
      assignedTo: initialData?.assignedTo || 'unassigned',
    },
  });

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        inquiryType: initialData.inquiryType || 'general',
        priority: initialData.priority || 'medium',
        notes: initialData.notes || '',
        contactMethod: initialData.contactMethod || 'phone',
        contactInfo: initialData.contactInfo || '',
        followUpDate: initialData.followUpDate,
        assignedTo: initialData.assignedTo ? 
          (typeof initialData.assignedTo === 'object' ? initialData.assignedTo.id : initialData.assignedTo) : 
          'unassigned',
      });
    }
  }, [initialData, form]);

  // Fetch staff members for assignment
  const { data: staffMembers = [] } = useQuery({
    queryKey: ['/api/staff'],
    queryFn: async () => {
      const response = await fetch('/api/staff');
      if (!response.ok) throw new Error('Failed to fetch staff');
      return response.json();
    },
  });

  const createInquiryMutation = useMutation({
    mutationFn: async (data: InquiryFormData) => {
      const response = await fetch(`/api/patients/${patientId}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create inquiry');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Inquiry created successfully' });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/inquiries`] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateInquiryMutation = useMutation({
    mutationFn: async (data: InquiryFormData) => {
      const response = await fetch(`/api/patients/${patientId}/inquiries/${inquiryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update inquiry');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Inquiry updated successfully' });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/inquiries`] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const onSubmit = (data: InquiryFormData) => {
    // Convert "unassigned" to undefined for API
    const submitData = {
      ...data,
      assignedTo: data.assignedTo === 'unassigned' ? undefined : data.assignedTo
    };

    if (mode === 'create') {
      createInquiryMutation.mutate(submitData);
    } else {
      updateInquiryMutation.mutate(submitData);
    }
  };

  const isLoading = createInquiryMutation.isPending || updateInquiryMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">
          {mode === 'create' ? 'Create New Inquiry' : 'Edit Inquiry'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {mode === 'create' ? 'Create a new inquiry for' : 'Edit inquiry for'} {patientName}
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inquiryType">Inquiry Type *</Label>
            <Select onValueChange={form.setValue} value={form.watch('inquiryType')}>
              <SelectTrigger>
                <SelectValue placeholder="Select inquiry type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_patient">New Patient</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.inquiryType && (
              <p className="text-sm text-red-500">{form.formState.errors.inquiryType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority *</Label>
            <Select onValueChange={form.setValue} value={form.watch('priority')}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.priority && (
              <p className="text-sm text-red-500">{form.formState.errors.priority.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contactMethod">Contact Method *</Label>
            <Select onValueChange={form.setValue} value={form.watch('contactMethod')}>
              <SelectTrigger>
                <SelectValue placeholder="Select contact method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="in_person">In Person</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.contactMethod && (
              <p className="text-sm text-red-500">{form.formState.errors.contactMethod.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactInfo">Contact Information</Label>
            <Input
              {...form.register('contactInfo')}
              placeholder="Phone number, email, or other contact details"
            />
            {form.formState.errors.contactInfo && (
              <p className="text-sm text-red-500">{form.formState.errors.contactInfo.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign To</Label>
            <Select onValueChange={form.setValue} value={form.watch('assignedTo')}>
              <SelectTrigger>
                <SelectValue placeholder="Select staff member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {staffMembers.map((staff: StaffMember) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.firstName} {staff.lastName} ({staff.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="followUpDate">Follow Up Date</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !form.watch('followUpDate') && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('followUpDate') ? (
                    format(form.watch('followUpDate')!, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={form.watch('followUpDate')}
                  onSelect={(date) => {
                    form.setValue('followUpDate', date);
                    setOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes *</Label>
          <Textarea
            {...form.register('notes')}
            placeholder="Describe the inquiry details..."
            rows={4}
          />
          {form.formState.errors.notes && (
            <p className="text-sm text-red-500">{form.formState.errors.notes.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create Inquiry' : 'Update Inquiry'}
          </Button>
        </div>
      </form>
    </div>
  );
}
