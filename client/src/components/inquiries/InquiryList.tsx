import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Phone,
  Mail,
  User,
  FileText
} from 'lucide-react';
import { InquiryForm } from './InquiryForm';
import { Inquiry } from '@/shared/types';

interface InquiryListProps {
  patientId: string;
  patientName: string;
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const inquiryTypeIcons = {
  new_patient: User,
  follow_up: Clock,
  referral: FileText,
  general: FileText,
  emergency: AlertCircle,
};

const contactMethodIcons = {
  phone: Phone,
  mail: Mail,
  in_person: User,
  referral: FileText,
};

export function InquiryList({ patientId, patientName }: InquiryListProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<Inquiry | null>(null);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [resolvingInquiry, setResolvingInquiry] = useState<Inquiry | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const queryClient = useQueryClient();

  // Fetch inquiries
  const { data: inquiries = [], isLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}/inquiries`],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/inquiries`);
      if (!response.ok) throw new Error('Failed to fetch inquiries');
      const data = await response.json();
      return data.inquiries || [];
    },
  });

  // Resolve inquiry mutation
  const resolveInquiryMutation = useMutation({
    mutationFn: async ({ inquiryId, resolutionNotes }: { inquiryId: string; resolutionNotes: string }) => {
      const response = await fetch(`/api/patients/${patientId}/inquiries/${inquiryId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolutionNotes }),
      });
      if (!response.ok) throw new Error('Failed to resolve inquiry');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Inquiry resolved successfully' });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/inquiries`] });
      setIsResolveDialogOpen(false);
      setResolvingInquiry(null);
      setResolutionNotes('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete inquiry mutation
  const deleteInquiryMutation = useMutation({
    mutationFn: async (inquiryId: string) => {
      const response = await fetch(`/api/patients/${patientId}/inquiries/${inquiryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete inquiry');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Inquiry deleted successfully' });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/inquiries`] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleResolve = () => {
    if (resolvingInquiry) {
      resolveInquiryMutation.mutate({
        inquiryId: resolvingInquiry.id!,
        resolutionNotes,
      });
    }
  };

  const handleDelete = (inquiryId: string) => {
    if (confirm('Are you sure you want to delete this inquiry?')) {
      deleteInquiryMutation.mutate(inquiryId);
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'low':
        return <CheckCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading inquiries...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Patient Inquiries</h3>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Inquiry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Inquiry</DialogTitle>
            </DialogHeader>
            <InquiryForm
              patientId={patientId}
              patientName={patientName}
              onSuccess={() => setIsCreateDialogOpen(false)}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {inquiries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No inquiries found for this patient.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create the first inquiry to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry: Inquiry) => {
            const InquiryTypeIcon = inquiryTypeIcons[inquiry.inquiryType as keyof typeof inquiryTypeIcons] || FileText;
            const ContactMethodIcon = contactMethodIcons[inquiry.contactMethod as keyof typeof contactMethodIcons] || FileText;
            
            return (
              <Card key={inquiry.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <InquiryTypeIcon className="h-5 w-5 text-blue-600" />
                      <div>
                        <CardTitle className="text-base capitalize">
                          {inquiry.inquiryType.replace('_', ' ')}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Created {inquiry.createdAt ? format(new Date(inquiry.createdAt), 'MMM d, yyyy') : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getPriorityIcon(inquiry.priority)}
                      <Badge className={priorityColors[inquiry.priority as keyof typeof priorityColors]}>
                        {inquiry.priority}
                      </Badge>
                      <Badge className={statusColors[inquiry.status as keyof typeof statusColors]}>
                        {inquiry.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <p className="text-sm">{inquiry.notes}</p>
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <ContactMethodIcon className="h-4 w-4" />
                        <span className="capitalize">{inquiry.contactMethod.replace('_', ' ')}</span>
                        {inquiry.contactInfo && (
                          <span>: {inquiry.contactInfo}</span>
                        )}
                      </div>
                      
                      {inquiry.followUpDate && (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>Follow up: {format(new Date(inquiry.followUpDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </div>

                    {inquiry.assignedTo ? (
                      <div className="text-sm text-muted-foreground">
                        Assigned to: {typeof inquiry.assignedTo === 'object' ? 
                          `${inquiry.assignedTo.firstName} ${inquiry.assignedTo.lastName}` : 
                          inquiry.assignedTo}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Status: Unassigned
                      </div>
                    )}

                    <div className="flex justify-end space-x-2">
                      {inquiry.status !== 'completed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResolvingInquiry(inquiry);
                            setIsResolveDialogOpen(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingInquiry(inquiry)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(inquiry.id!)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Inquiry Dialog */}
      {editingInquiry && (
        <Dialog open={!!editingInquiry} onOpenChange={() => setEditingInquiry(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Inquiry</DialogTitle>
            </DialogHeader>
            <InquiryForm
              patientId={patientId}
              patientName={patientName}
              initialData={editingInquiry}
              mode="edit"
              inquiryId={editingInquiry.id}
              onSuccess={() => setEditingInquiry(null)}
              onCancel={() => setEditingInquiry(null)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Resolve Inquiry Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Inquiry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resolutionNotes">Resolution Notes</Label>
              <Textarea
                id="resolutionNotes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about how this inquiry was resolved..."
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResolveDialogOpen(false);
                  setResolvingInquiry(null);
                  setResolutionNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResolve}
                disabled={resolveInquiryMutation.isPending}
              >
                {resolveInquiryMutation.isPending ? 'Resolving...' : 'Resolve Inquiry'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
