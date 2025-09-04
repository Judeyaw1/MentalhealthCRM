import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "./use-toast";

export function useAuth() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check backend session status
  const { data: sessionUser, isLoading: isLoadingSession } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include',
      });
      if (response.ok) {
        return response.json();
      }
      return null;
    },
    retry: false,
    refetchInterval: 30000, // Check every 30 seconds
    refetchIntervalInBackground: true,
  });

  // Use backend session if available, fallback to localStorage
  const isAuthenticated = sessionUser ? true : localStorage.getItem("isLoggedIn") === "true";
  const user = sessionUser || (isAuthenticated ? JSON.parse(localStorage.getItem("user") || "null") : null);
  
  // Prioritize backend user data over localStorage for forcePasswordChange
  const forcePasswordChange = user?.forcePasswordChange === true;

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
      localStorage.removeItem("patient-changes-refresh");
      localStorage.removeItem("patient-changes-date");

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
    isLoading: isLoadingSession,
    isAuthenticated,
    forcePasswordChange,
    logout,
    error: null,
  };
}
