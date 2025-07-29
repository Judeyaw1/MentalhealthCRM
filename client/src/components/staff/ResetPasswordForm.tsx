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
import { Key, AlertTriangle, Loader2, X, CheckCircle } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User } from "@shared/types";

interface ResetPasswordFormProps {
  staffMember: User;
  onSuccess?: () => void;
}

export function ResetPasswordForm({
  staffMember,
  onSuccess,
}: ResetPasswordFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [defaultPassword, setDefaultPassword] = useState<string>("");

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/staff/${staffMember.id}/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Reset password error details:", errorData);
        throw new Error(errorData.message || "Failed to reset password");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setIsSuccess(true);
      setDefaultPassword(data.defaultPassword || "");

      const message = data.defaultPassword
        ? `Password reset successful. Default password: ${data.defaultPassword}`
        : `A password reset email has been sent to ${staffMember.email}.`;

      toast({
        title: "Password Reset Successful",
        description: message,
      });

      // Refresh staff list
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });

      // Call success callback
      onSuccess?.();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to reset passwords.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        return;
      }

      toast({
        title: "Reset Failed",
        description:
          error.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReset = () => {
    resetMutation.mutate();
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsSuccess(false);
    setDefaultPassword("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={(e) => e.stopPropagation()}
        >
          <Key className="h-4 w-4 mr-2" />
          Reset Password
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <Key className="h-5 w-5" />
            Reset Password
          </DialogTitle>
        </DialogHeader>

        {!isSuccess ? (
          <div className="space-y-6">
            {/* Information Card */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 text-lg">
                  Password Reset
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-blue-700">
                  This will send a password reset email to{" "}
                  <strong>{staffMember.email}</strong>. The staff member will
                  receive instructions to set a new password.
                </p>
              </CardContent>
            </Card>

            {/* Staff Member Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Staff Member Details
                </CardTitle>
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
              </CardContent>
            </Card>

            {/* What happens next */}
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-amber-800 text-base">
                  What happens next?
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="text-amber-700 space-y-1 text-sm">
                  <li>
                    • A password reset email will be sent to {staffMember.email}
                  </li>
                  <li>
                    • The staff member will receive a secure link to reset their
                    password
                  </li>
                  <li>• The link will expire after 24 hours for security</li>
                  <li>
                    • The staff member can continue using their current password
                    until they reset it
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={resetMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="min-w-[120px]"
              >
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Send Reset Email
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Success Card */}
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Password Reset Successful
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {defaultPassword ? (
                  <div className="space-y-3">
                    <p className="text-green-700">
                      Password has been reset for{" "}
                      <strong>{staffMember.email}</strong>.
                    </p>
                    <div className="bg-white border-2 border-green-300 rounded-lg p-3">
                      <p className="text-sm text-gray-600 mb-2">
                        Default Password:
                      </p>
                      <p className="text-lg font-mono font-bold text-green-800 bg-green-100 px-3 py-2 rounded border">
                        {defaultPassword}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Share this password securely with the staff member. They
                        will be required to change it on their next login.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-green-700">
                    A password reset email has been successfully sent to{" "}
                    <strong>{staffMember.email}</strong>.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {defaultPassword ? (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Share Password</p>
                        <p className="text-xs text-gray-600">
                          Provide the default password to the staff member
                          securely
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Staff Login</p>
                        <p className="text-xs text-gray-600">
                          They can log in with the default password
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Password Change</p>
                        <p className="text-xs text-gray-600">
                          They'll be prompted to change their password on first
                          login
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Email Sent</p>
                        <p className="text-xs text-gray-600">
                          The staff member will receive the reset email shortly
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Password Reset</p>
                        <p className="text-xs text-gray-600">
                          They'll click the link and set a new password
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium">Access Restored</p>
                        <p className="text-xs text-gray-600">
                          They can log in with their new password
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                onClick={handleClose}
                className="min-w-[120px]"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
