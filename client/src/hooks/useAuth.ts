import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simple authentication check without network requests
  const isAuthenticated = localStorage.getItem("isLoggedIn") === "true";
  const user = isAuthenticated
    ? JSON.parse(localStorage.getItem("user") || "null")
    : null;
  const forcePasswordChange =
    localStorage.getItem("forcePasswordChange") === "true";

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Make logout request to clear server session
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies
        });
      } catch (error) {
        // Ignore errors, just clear local state
      }
      return { success: true };
    },
    onSuccess: () => {
      // Clear local storage
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("user");

      // Clear any cached data
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
      // Redirect to login page
      window.location.href = "/login";
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  return {
    user,
    isLoading: false,
    isAuthenticated,
    forcePasswordChange,
    logout,
    error: null,
  };
}
