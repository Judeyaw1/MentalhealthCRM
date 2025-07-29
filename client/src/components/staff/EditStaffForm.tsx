import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, Shield, UserCheck, Users, Loader2, Save, X, UserCog } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User } from "@shared/types";

interface EditStaffFormProps {
  staffMember: User;
  onSuccess?: () => void;
}

interface EditData {
  firstName: string;
  lastName: string;
  role: string;
}

export function EditStaffForm({ staffMember, onSuccess }: EditStaffFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch current staff member data when dialog opens
  const { data: currentStaffData, isLoading: isLoadingStaff } = useQuery({
    queryKey: ["staff", staffMember.id],
    queryFn: async () => {
      const response = await fetch(`/api/staff/${staffMember.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch staff member");
      }
      return response.json();
    },
    enabled: isOpen, // Only fetch when dialog is open
  });

  const [formData, setFormData] = useState<EditData>({
    firstName: "",
    lastName: "",
    role: "",
  });

  // Initialize form data when current staff data is loaded
  useEffect(() => {
    if (currentStaffData) {
      setFormData({
        firstName: currentStaffData.firstName || "",
        lastName: currentStaffData.lastName || "",
        role: currentStaffData.role || "",
      });
    }
  }, [currentStaffData]);

  // Dynamic role options based on current user's role and staff member being edited
  const roleOptions = [
    {
      value: "therapist",
      label: "Therapist",
      description: "Licensed mental health professional",
      icon: UserCheck,
    },
    {
      value: "staff",
      label: "Staff Member",
      description: "Administrative support staff",
      icon: Users,
    },
    // Only show supervisor option for admins
    ...(user?.role === "admin" ? [{
      value: "supervisor",
      label: "Supervisor",
      description: "Team leader with management privileges (no admin access)",
      icon: UserCog,
    }] : []),
    // Only show admin option for actual admins, and only if editing a non-admin user
    ...(user?.role === "admin" && staffMember.role !== "admin" ? [{
      value: "admin",
      label: "Administrator",
      description: "System administrator with full access",
      icon: Shield,
    }] : []),
  ];

  const editMutation = useMutation({
    mutationFn: async (data: EditData) => {
      const response = await fetch(`/api/staff/${staffMember.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Edit error details:", errorData);

        if (errorData.errors && Array.isArray(errorData.errors)) {
          const errorMessages = errorData.errors
            .map(
              (err: any) => `${err.path?.join(".") || "field"}: ${err.message}`,
            )
            .join(", ");
          throw new Error(`Validation failed: ${errorMessages}`);
        }

        throw new Error(errorData.message || "Failed to update staff member");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Staff Member Updated",
        description: `${formData.firstName} ${formData.lastName} has been updated successfully.`,
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
          description: "You don't have permission to edit staff members.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }

      toast({
        title: "Update Failed",
        description:
          error.message || "Failed to update staff member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Debug: Log the data being sent
    console.log("Sending edit data:", formData);
    editMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof EditData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const getRoleIcon = (role: string) => {
    const roleOption = roleOptions.find((option) => option.value === role);
    return roleOption ? roleOption.icon : Users;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Staff Member
          </DialogTitle>
        </DialogHeader>

        {isLoadingStaff ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading staff member details...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) =>
                      handleInputChange("firstName", e.target.value)
                    }
                    placeholder="Enter first name"
                    disabled={editMutation.isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) =>
                      handleInputChange("lastName", e.target.value)
                    }
                    placeholder="Enter last name"
                    disabled={editMutation.isPending}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={currentStaffData?.email || staffMember.email || ""}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  Email address cannot be changed. Contact the system
                  administrator if needed.
                </p>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange("role", value)}
                disabled={editMutation.isPending}
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
                            <div className="text-xs text-gray-500">
                              {role.description}
                            </div>
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
                      return (
                        <IconComponent className="h-5 w-5 text-primary-600" />
                      );
                    })()}
                    <div>
                      <div className="font-medium">
                        {
                          roleOptions.find((r) => r.value === formData.role)
                            ?.label
                        }
                      </div>
                      <div className="text-sm text-gray-600">
                        {
                          roleOptions.find((r) => r.value === formData.role)
                            ?.description
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={editMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editMutation.isPending}
                className="min-w-[120px]"
              >
                {editMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
