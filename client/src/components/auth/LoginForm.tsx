import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";

import { isUnauthorizedError } from "@/lib/authUtils";

interface LoginFormProps {
  onSuccess?: () => void;
}

interface LoginData {
  email: string;
  password: string;
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<LoginData>({
    email: "",
    password: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Login failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        // Store user data in localStorage
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify(data.user));
        
        // Invalidate auth query to refetch session
        queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        
        toast({
          title: "Login Successful",
          description: `Welcome back, ${data.user.firstName}!`,
        });

        // Wait for auth state to update before calling success callback
        setTimeout(() => {
          onSuccess?.();
        }, 200);
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Login Failed",
          description: "Invalid email or password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Login Failed",
          description: error.message || "An error occurred during login.",
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof LoginData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">🌱</span>
        </div>
        <CardTitle>Sign In to NewLife CRM</CardTitle>
        <p className="text-sm text-gray-600">
          Enter your credentials to access your account
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              placeholder="Enter your email address"
              disabled={loginMutation.isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                placeholder="Enter your password"
                disabled={loginMutation.isPending}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loginMutation.isPending}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Sign In
              </>
            )}
          </Button>
        </form>


      </CardContent>
    </Card>
  );
}
