import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Mail, User, Shield, UserCheck, Users, Loader2, X } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface InviteStaffFormProps {
  onSuccess?: () => void;
}

interface InviteData {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  message?: string;
}

const roleOptions = [
  { value: "therapist", label: "Therapist", description: "Licensed mental health professional", icon: UserCheck },
  { value: "staff", label: "Staff Member", description: "Administrative support staff", icon: Users },
  { value: "admin", label: "Administrator", description: "System administrator with full access", icon: Shield },
];

export function InviteStaffForm({ onSuccess }: InviteStaffFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<InviteData>({
    email: "",
    firstName: "",
    lastName: "",
    role: "",
    message: "",
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: InviteData) => {
      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Invitation error details:", errorData);
        
        // Handle detailed validation errors
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors.map((err: any) => 
            `${err.path?.join('.') || 'field'}: ${err.message}`
          ).join(', ');
          console.error("Validation errors:", errorData.errors);
          console.error("Received data:", errorData.receivedData);
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        throw new Error(errorData.message || "Failed to invite staff member");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const message = data.defaultPassword 
        ? `${data.message} Default password: ${data.defaultPassword} (User will be required to change it on first login)`
        : data.message || `Invitation sent to ${formData.email} successfully.`;
      
      toast({
        title: "Invitation Sent",
        description: message,
      });
      
      // Reset form
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        role: "",
        message: "",
      });
      
      // Close dialog
      setIsOpen(false);
      
      // Refresh staff list
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      
      // Call success callback
      onSuccess?.();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to invite staff members.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        return;
      }

      toast({
        title: "Invitation Failed",
        description: error.message || "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.email || !formData.firstName || !formData.lastName || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Email validation - more permissive pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address (e.g., user@example.com).",
        variant: "destructive",
      });
      return;
    }

    // Debug: Log the data being sent
    console.log("Sending invitation data:", formData);
    console.log("Role value:", formData.role, "Type:", typeof formData.role);
    inviteMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof InviteData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const getRoleIcon = (role: string) => {
    const roleOption = roleOptions.find(option => option.value === role);
    return roleOption ? roleOption.icon : Users;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Invite Staff Member</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite New Staff Member
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  placeholder="Enter first name"
                  disabled={inviteMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  placeholder="Enter last name"
                  disabled={inviteMutation.isPending}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Enter email address"
                disabled={inviteMutation.isPending}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => handleInputChange("role", value)}
              disabled={inviteMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((role) => {
                  const IconComponent = role.icon;
                  return (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{role.label}</div>
                          <div className="text-xs text-gray-500">{role.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Role Preview */}
          {formData.role && (
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = getRoleIcon(formData.role);
                    return <IconComponent className="h-5 w-5 text-primary-600" />;
                  })()}
                  <div>
                    <div className="font-medium">
                      {roleOptions.find(r => r.value === formData.role)?.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {roleOptions.find(r => r.value === formData.role)?.description}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optional Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Personal Message (Optional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              placeholder="Add a personal message to the invitation..."
              rows={3}
              disabled={inviteMutation.isPending}
            />
            <p className="text-xs text-gray-500">
              This message will be included in the invitation email.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={inviteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={inviteMutation.isPending}
              className="min-w-[120px]"
            >
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 