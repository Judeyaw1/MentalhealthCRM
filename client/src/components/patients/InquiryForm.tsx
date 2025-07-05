import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, Mail, User, AlertCircle, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface InquiryFormProps {
  patientId: string;
  patientName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface InquiryData {
  inquiryType: string;
  priority: string;
  notes: string;
  contactMethod: string;
  contactInfo: string;
  followUpDate?: string;
  assignedTo?: string;
}

export function InquiryForm({ patientId, patientName, onSuccess, onCancel }: InquiryFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<InquiryData>({
    inquiryType: 'general',
    priority: 'medium',
    notes: '',
    contactMethod: 'phone',
    contactInfo: '',
    followUpDate: '',
    assignedTo: ''
  });

  const createInquiryMutation = useMutation({
    mutationFn: async (data: InquiryData) => {
      return apiRequest("POST", `/api/patients/${patientId}/inquiries`, data);
    },
    onSuccess: () => {
      toast({
        title: "Inquiry Created",
        description: "Patient inquiry has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create inquiry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInquiryMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof InquiryData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-600" />
          New Patient Inquiry
        </CardTitle>
        <p className="text-sm text-gray-600">
          Creating inquiry for <strong>{patientName}</strong>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inquiryType">Inquiry Type</Label>
              <Select value={formData.inquiryType} onValueChange={(value) => handleInputChange('inquiryType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_patient">New Patient</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactMethod">Contact Method</Label>
              <Select value={formData.contactMethod} onValueChange={(value) => handleInputChange('contactMethod', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="contactInfo">Contact Information</Label>
              <Input
                id="contactInfo"
                value={formData.contactInfo}
                onChange={(e) => handleInputChange('contactInfo', e.target.value)}
                placeholder="Phone, email, or other contact info"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="followUpDate">Follow-up Date (Optional)</Label>
            <Input
              id="followUpDate"
              type="datetime-local"
              value={formData.followUpDate}
              onChange={(e) => handleInputChange('followUpDate', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Describe the inquiry details..."
              rows={4}
              required
            />
          </div>

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <Badge className={getPriorityColor(formData.priority)}>
                {formData.priority.charAt(0).toUpperCase() + formData.priority.slice(1)} Priority
              </Badge>
              <Badge variant="outline">
                {formData.inquiryType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Badge>
            </div>
            
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createInquiryMutation.isPending || !formData.notes.trim()}
              >
                {createInquiryMutation.isPending ? "Creating..." : "Create Inquiry"}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
} 