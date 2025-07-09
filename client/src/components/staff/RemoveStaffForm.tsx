import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2, AlertTriangle, Loader2, X } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User } from "@shared/schema";

interface RemoveStaffFormProps {
  staffMember: User;
  onSuccess?: () => void;
}

export function RemoveStaffForm({
  staffMember,
  onSuccess,
}: RemoveStaffFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const removeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/staff/${staffMember.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Remove error details:", errorData);
        throw new Error(errorData.message || "Failed to remove staff member");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Staff Member Removed",
        description: `${staffMember.firstName} ${staffMember.lastName} has been removed from the team.`,
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
          description: "You don't have permission to remove staff members.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        return;
      }

      toast({
        title: "Remove Failed",
        description:
          error.message || "Failed to remove staff member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRemove = () => {
    removeMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Remove
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Remove Staff Member
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Card */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-red-800 text-lg">Warning</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-red-700">
                You are about to remove{" "}
                <strong>
                  {staffMember.firstName} {staffMember.lastName}
                </strong>{" "}
                from the team. This action cannot be undone.
              </p>
            </CardContent>
          </Card>

          {/* Staff Member Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Staff Member Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">
                  {staffMember.firstName} {staffMember.lastName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{staffMember.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Role:</span>
                <span className="font-medium capitalize">
                  {staffMember.role}
                </span>
              </div>
              {staffMember.createdAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Joined:</span>
                  <span className="font-medium">
                    {new Date(staffMember.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Impact Information */}
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-amber-800 text-base">
                What happens next?
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-amber-700 space-y-1 text-sm">
                <li>• The staff member will lose access to the system</li>
                <li>• Their account will be deactivated</li>
                <li>
                  • All associated data will be preserved for audit purposes
                </li>
                <li>• They can be re-invited if needed in the future</li>
              </ul>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={removeMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="min-w-[120px]"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Staff
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
