import { useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Edit,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Clock,
    User,
  ArrowLeft,
  Trash2,
  Pencil,
  CheckCircle,
  XCircle,
  Search,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError, canSeeCreatedBy } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type {
  PatientWithTherapist,
  AppointmentWithDetails,
  TreatmentRecordWithDetails,
} from "@shared/types";
import { format, parseISO, isValid } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PatientReport from "@/components/reports/PatientReport";

import PatientNotes from "@/components/patients/PatientNotes";
import { DischargeRequestForm } from "@/components/patients/DischargeRequestForm";
import { DischargeRequestsList } from "@/components/patients/DischargeRequestsList";

export default function PatientDetail() {
  const params = useParams();
  const [location] = useLocation();
  const patientId = params.id as string;
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const canPerformAssessments = ['admin', 'supervisor', 'therapist'].includes(user?.role || '');
  const canUseChat = ['admin', 'supervisor', 'therapist'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';

  // Get tab from URL query parameter - use both wouter and browser URL
  const wouterParams = new URLSearchParams(location.split('?')[1]);
  const browserParams = new URLSearchParams(window.location.search);
  
  // Prefer browser URL params as they're more reliable
  const defaultTab = browserParams.get('tab') || wouterParams.get('tab') || 'overview';
  
  console.log("🔍 PatientDetail - Wouter location:", location);
  console.log("🔍 PatientDetail - Wouter URL params:", location.split('?')[1]);
  console.log("🔍 PatientDetail - Browser URL:", window.location.href);
  console.log("🔍 PatientDetail - Browser URL params:", window.location.search);
  console.log("🔍 PatientDetail - Initial default tab:", defaultTab);
  
  // State for active tab
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  // Custom tab change handler that updates both state and URL
  const handleTabChange = (newTab: string) => {
    console.log("🔍 PatientDetail - Manual tab change from", activeTab, "to", newTab);
    setActiveTab(newTab);
    
    // Update URL to reflect the new tab
    const newUrl = `/patients/${patientId}?tab=${newTab}`;
    window.history.replaceState(null, '', newUrl);
  };

  // Fetch notes count for the Notes tab badge
  const { data: notes = [] } = useQuery({
    queryKey: ["patient-notes", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/notes`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!patientId,
  });

  // Get unread notes count for the badge
  const [unreadCount, setUnreadCount] = useState(0);

  // Calculate unread notes count
  useEffect(() => {
    if (user?.id && patientId && notes.length > 0) {
      try {
        const saved = localStorage.getItem(`readMessages_${patientId}_${user.id}`);
        console.log("🔍 Badge Debug - localStorage saved data:", saved);
        
        if (saved) {
          const readMessages = new Set(JSON.parse(saved) as string[]);
          console.log("🔍 Badge Debug - Read messages from localStorage:", Array.from(readMessages));
          console.log("🔍 Badge Debug - Total notes:", notes.length);
          console.log("🔍 Badge Debug - Notes from other users:", notes.filter((note: any) => note.authorId !== user?.id).length);
          
          const unreadNotes = notes.filter((note: any) => 
            note.authorId !== user?.id && !readMessages.has(note._id)
          );
          console.log("🔍 Badge Debug - Unread notes count:", unreadNotes.length);
          console.log("🔍 Badge Debug - Unread note IDs:", unreadNotes.map((note: any) => note._id));
          
          setUnreadCount(unreadNotes.length);
        } else {
          // If no read messages saved, all notes from other users are unread
          const unreadNotes = notes.filter((note: any) => note.authorId !== user?.id);
          console.log("🔍 Badge Debug - No localStorage data, unread notes:", unreadNotes.length);
          setUnreadCount(unreadNotes.length);
        }
      } catch (error) {
        console.error("❌ Error calculating unread count:", error);
        setUnreadCount(0);
      }
    } else {
      console.log("🔍 Badge Debug - No user, patientId, or notes, setting unread count to 0");
      setUnreadCount(0);
    }
  }, [notes, user?.id, patientId]);

  // Recalculate unread count when page becomes visible (user returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.id && patientId && notes.length > 0) {
        console.log("🔍 Badge Debug - Page became visible, recalculating unread count");
        try {
          const saved = localStorage.getItem(`readMessages_${patientId}_${user.id}`);
          if (saved) {
            const readMessages = new Set(JSON.parse(saved) as string[]);
            const unreadNotes = notes.filter((note: any) => 
              note.authorId !== user?.id && !readMessages.has(note._id)
            );
            console.log("🔍 Badge Debug - Visibility change - unread count:", unreadNotes.length);
            setUnreadCount(unreadNotes.length);
          }
        } catch (error) {
          console.error("❌ Error recalculating unread count on visibility change:", error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [notes, user?.id, patientId]);

  // Listen for custom events when notes are read to update unread count in real-time
  useEffect(() => {
    const handleNotesRead = () => {
      // Recalculate unread count when notes are marked as read
      if (user?.id && patientId && notes.length > 0) {
        try {
          const saved = localStorage.getItem(`readMessages_${patientId}_${user.id}`);
          if (saved) {
            const readMessages = new Set(JSON.parse(saved) as string[]);
            const unreadNotes = notes.filter((note: any) => 
              note.authorId !== user?.id && !readMessages.has(note._id)
            );
            setUnreadCount(unreadNotes.length);
          } else {
            const unreadNotes = notes.filter((note: any) => note.authorId !== user?.id);
            setUnreadCount(unreadNotes.length);
          }
        } catch (error) {
          console.error("❌ Error updating unread count from notes read event:", error);
        }
      }
    };

    window.addEventListener('notes-read', handleNotesRead);
    return () => window.removeEventListener('notes-read', handleNotesRead);
  }, [notes, user?.id, patientId]);

  // Update active tab when URL changes (for navigation from notifications)
  useEffect(() => {
    // Use both wouter location and browser URL for robust tab detection
    const wouterUrlParams = new URLSearchParams(location.split('?')[1]);
    const browserUrlParams = new URLSearchParams(window.location.search);
    
    // Prefer browser URL as it's more reliable
    const currentTab = browserUrlParams.get('tab') || wouterUrlParams.get('tab') || 'overview';
    
    console.log("🔍 PatientDetail - URL changed, wouter location:", location);
    console.log("🔍 PatientDetail - Wouter URL params:", location.split('?')[1]);
    console.log("🔍 PatientDetail - Browser URL params:", window.location.search);
    console.log("🔍 PatientDetail - Current tab from URL:", currentTab, "active tab state:", activeTab);
    
    // Only update if this is a navigation from external source (not manual tab click)
    // Check if the URL actually changed vs just the activeTab state
    if (currentTab && currentTab !== activeTab && location.includes('?tab=')) {
      console.log("🔍 PatientDetail - External navigation detected, updating tab from", activeTab, "to", currentTab);
      setActiveTab(currentTab);
    }
  }, [location, activeTab]);
  
  // Force tab update on mount if URL has tab parameter
  useEffect(() => {
    // Check both wouter and browser URL on mount
    const wouterParams = new URLSearchParams(location.split('?')[1]);
    const browserParams = new URLSearchParams(window.location.search);
    
    const tabFromWouter = wouterParams.get('tab');
    const tabFromBrowser = browserParams.get('tab');
    const tabFromUrl = tabFromBrowser || tabFromWouter;
    
    console.log("🔍 PatientDetail - Force update on mount:");
    console.log("  - Tab from wouter:", tabFromWouter);
    console.log("  - Tab from browser:", tabFromBrowser);
    console.log("  - Tab from URL:", tabFromUrl);
    console.log("  - Current active tab:", activeTab);
    
    if (tabFromUrl && tabFromUrl !== activeTab) {
      console.log("🔍 PatientDetail - Force updating tab on mount from", activeTab, "to", tabFromUrl);
      setActiveTab(tabFromUrl);
    }
  }, []); // Empty dependency array - only run on mount
  
  // Additional delayed check for URL parameters (handles timing issues)
  useEffect(() => {
    const timer = setTimeout(() => {
      const browserParams = new URLSearchParams(window.location.search);
      const delayedTab = browserParams.get('tab');
      
      console.log("🔍 PatientDetail - Delayed URL check, tab:", delayedTab);
      
      // Only update if this is initial navigation with tab parameter
      if (delayedTab && delayedTab !== activeTab && location.includes('?tab=')) {
        console.log("🔍 PatientDetail - Delayed update: changing tab from", activeTab, "to", delayedTab);
        setActiveTab(delayedTab);
      }
    }, 100); // Small delay to ensure URL is fully updated
    
    return () => clearTimeout(timer);
  }, [activeTab, location]);

  // Smart back button logic
  const [previousPath, setPreviousPath] = useState<string>('/patients');
  
  // Delete confirmation state
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Discharge request state
  const [showDischargeRequest, setShowDischargeRequest] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Debug: Monitor showReportDialog state changes
  useEffect(() => {
    console.log("🔍 showReportDialog state changed to:", showReportDialog);
    console.log("🔍 Component re-rendering with showReportDialog:", showReportDialog);
  }, [showReportDialog]);

  // Debug: Track component renders
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log("🔍 PatientDetail component render #", renderCount.current, "showReportDialog:", showReportDialog);
  
  // Real-time socket connection for instant updates
  useSocket({
    onPatientUpdated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onAppointmentCreated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/appointments`] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
    onAppointmentUpdated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/appointments`] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    },
    onTreatmentRecordCreated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/records`] });
      queryClient.invalidateQueries({ queryKey: ['/api/records'] });
    },
    onTreatmentRecordUpdated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/records`] });
      queryClient.invalidateQueries({ queryKey: ['/api/records'] });
    },
    onDischargeRequestCreated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/discharge-requests`] });
      queryClient.invalidateQueries({ queryKey: ['/api/discharge-requests/pending'] });
    },
    onDischargeRequestUpdated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/discharge-requests`] });
      queryClient.invalidateQueries({ queryKey: ['/api/discharge-requests/pending'] });
    },
    onNoteCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
    },
    onNoteUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
    },
  });

  // Track where user came from
  useEffect(() => {
    const referrer = document.referrer;
    const currentHost = window.location.origin;
    
    // If they came from within our app
    if (referrer.startsWith(currentHost)) {
      const referrerPath = new URL(referrer).pathname;
      
      // Don't go back to the same page
      if (referrerPath !== location) {
        setPreviousPath(referrerPath);
      }
    }
    
    // Check if they came from search
    if (location.includes('?from=search')) {
      setPreviousPath('/dashboard');
    }
  }, [location]);

  // Smart back button handler
  const handleBackClick = () => {
    // If they came from search, go to dashboard
    if (location.includes('?from=search')) {
      window.location.href = '/dashboard';
      return;
    }
    
    // Try to use browser history if available
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    
    // If they came from patients list, go back there
    if (previousPath === '/patients') {
      window.location.href = '/patients';
      return;
    }
    
    // If they came from dashboard, go back there
    if (previousPath === '/dashboard') {
      window.location.href = '/dashboard';
      return;
    }
    
    // Default fallback
    window.location.href = '/patients';
  };

  // Get back button text based on context
  const getBackButtonText = () => {
    if (location.includes('?from=search')) {
      return 'Back to Dashboard';
    }
    
    if (previousPath === '/patients') {
      return 'Back to Patients';
    }
    
    if (previousPath === '/dashboard') {
      return 'Back to Dashboard';
    }
    
    return 'Back to Patients';
  };

  // Update active tab when URL changes
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const tabFromUrl = urlParams.get('tab') || 'overview';
    setActiveTab(tabFromUrl);
  }, [location]);

  // Redirect to home if not authenticated
  useEffect(() => {
    console.log("🔍 PatientDetail auth check:", { authLoading, isAuthenticated, patientId });
    if (!authLoading && !isAuthenticated) {
      console.log("🔍 User not authenticated, redirecting to login");
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Clear appointments cache when component mounts
  useEffect(() => {
    if (patientId) {
      queryClient.removeQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });
    }
  }, [patientId, queryClient]);

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}`],
    retry: false,
    enabled: !!patientId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  }) as { data: any; isLoading: boolean };

  // Debug: Monitor patient data changes
  useEffect(() => {
    console.log("🔍 Patient data changed:", { 
      patient, 
      patientLoading, 
      patientId: patient?._id,
      patientKeys: patient ? Object.keys(patient) : 'no patient'
    });
  }, [patient, patientLoading]);

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}/appointments`],
    retry: false,
    enabled: !!patientId,
    staleTime: 0, // Force fresh fetch
    refetchOnMount: true,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  }) as { data: any[]; isLoading: boolean };

  // Debug appointments data
  useEffect(() => {
    if (appointments && appointments.length > 0) {
      console.log('🔍 PatientDetail - Appointments data:', {
        patientId,
        appointmentsCount: appointments.length,
        appointments: appointments.map(apt => ({
          id: apt.id,
          patientId: apt.patientId,
          patientName: apt.patient?.firstName + ' ' + apt.patient?.lastName,
          date: apt.appointmentDate,
          type: apt.type
        }))
      });
    }
  }, [appointments, patientId]);

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}/records`],
    retry: false,
    enabled: !!patientId,
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  }) as { data: any[]; isLoading: boolean };

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/patients/${patientId}`, { status });
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/patients/${patientId}`],
      });
      
      if (status === "discharged") {
        toast({
          title: "Patient Discharged",
          description: "Patient has been discharged and moved to archive.",
        });
        // Redirect to archive page after a short delay
        setTimeout(() => {
          window.location.href = "/archive";
        }, 1500);
      } else {
        toast({
          title: "Success",
          description: "Patient status updated successfully.",
        });
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update patient status.",
        variant: "destructive",
      });
    },
  });

  // Add delete mutation for appointments
  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete appointment");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment deleted successfully",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/patients/${patientId}/appointments`],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/today-appointments"],
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: "Failed to delete appointment",
        variant: "destructive",
      });
    },
  });





  if (authLoading || patientLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="text-center py-12">
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                  Patient Not Found
                </h1>
                <p className="text-gray-600">
                  The requested patient could not be found.
                </p>
                <Link href="/patients">
                  <Button className="mt-4">Back to Patients</Button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success-100 text-success-500">Active</Badge>
        );
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "discharged":
        return <Badge variant="outline">Discharged</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  const isFrontDesk = user?.role === "frontdesk";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Return Arrow */}
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                onClick={handleBackClick}
              >
                <ArrowLeft className="h-4 w-4" />
                {getBackButtonText()}
              </Button>
            </div>

            {/* Patient Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary-100 text-primary-600 text-xl">
                      {getInitials(patient.firstName, patient.lastName)}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <h1 className="text-3xl font-semibold text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Patient ID: {patient._id}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      {getStatusBadge(patient.status)}
                      <span className="text-sm text-gray-500">
                        Age: {calculateAge(patient.dateOfBirth)}
                      </span>
                      {patient.assignedTherapist && (
                        <span className="text-sm text-gray-500">
                          Therapist: {patient.assignedTherapist.firstName}{" "}
                          {patient.assignedTherapist.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Link href={`/patients/${patient.id}/edit`}>
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <Edit className="h-4 w-4" />
                      <span>Edit Patient</span>
                    </Button>
                  </Link>

                  {/* Only show deactivate button for admin/supervisor */}
                  {/* Only admin, supervisor, and front desk can activate/inactivate patients */}
                  {(user?.role === "admin" || user?.role === "supervisor" || user?.role === "frontdesk") && (
                    <Button
                      variant={
                        patient.status === "active" ? "outline" : "default"
                      }
                      onClick={() =>
                        updateStatusMutation.mutate(
                          patient.status === "active" ? "inactive" : "active",
                        )
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      {patient.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  )}

                  {/* Discharge button - only for admin and supervisor */}
                  {(user?.role === "admin" || user?.role === "supervisor") && patient.status !== "discharged" && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to discharge ${patient.firstName} ${patient.lastName}? This will move them to the archive.`)) {
                          updateStatusMutation.mutate("discharged");
                        }
                      }}
                      disabled={updateStatusMutation.isPending}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Discharge Patient
                    </Button>
                  )}

                  {/* Request discharge button - for non-admin users */}
                  {user?.role !== "admin" && user?.role !== "supervisor" && patient.status !== "discharged" && (
                    <Button
                      variant="outline"
                      onClick={() => setShowDischargeRequest(true)}
                      className="border-orange-200 text-orange-700 hover:bg-orange-50"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Request Discharge
                    </Button>
                  )}

                  {/* Generate Report button */}
                  {user?.role !== "frontdesk" && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log("🔍 Generate Report button clicked!");
                        console.log("🔍 Current showReportDialog state:", showReportDialog);
                        console.log("🔍 Patient data when button clicked:", { 
                          patient, 
                          patientLoading, 
                          patientId: patient?.id,
                          patientKeys: patient ? Object.keys(patient) : 'no patient',
                          patientType: typeof patient,
                          patientIsNull: patient === null,
                          patientIsUndefined: patient === undefined
                        });
                        // Log the full patient object to see its structure
                        if (patient) {
                          console.log("🔍 Full patient object:", JSON.stringify(patient, null, 2));
                          console.log("🔍 Patient ID field check:", {
                            _id: patient._id,
                            id: patient.id,
                            patientId: patient.patientId,
                            hasOwnProperty_id: patient.hasOwnProperty('_id'),
                            hasOwnProperty_id2: patient.hasOwnProperty('id')
                          });
                        }
                        setShowReportDialog(true);
                        console.log("🔍 Set showReportDialog to true");
                      }}
                      className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  )}



                  {/* Simple delete button */}

                  
                  
                </div>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="records">Treatment Records</TabsTrigger>
                {canUseChat && (
                  <TabsTrigger value="notes" className="relative">
                    Notes
                    {unreadCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="ml-2 h-5 w-5 rounded-full p-0 text-xs font-bold flex items-center justify-center"
                      >
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                )}
                {canPerformAssessments && (
                  <TabsTrigger value="assessment">Assessment</TabsTrigger>
                )}
                {(user?.role === "admin" || user?.role === "supervisor") && (
                  <TabsTrigger value="discharge-requests">Discharge Requests</TabsTrigger>
                )}
                <TabsTrigger value="treatment-outcomes">Treatment Outcomes</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <User className="h-5 w-5" />
                        <span>Personal Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            First Name
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.firstName}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Last Name
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.lastName}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Date of Birth
                          </label>
                          <p className="text-sm text-gray-900">
                            {formatDate(patient.dateOfBirth)} ({calculateAge(patient.dateOfBirth)} years old)
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Gender
                          </label>
                          <p className="text-sm text-gray-900 capitalize">
                            {patient.gender || "Not specified"}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Registration Date
                          </label>
                          <p className="text-sm text-gray-900">
                            {formatDate(patient.createdAt!)}
                          </p>
                        </div>

                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Length of Stay (LOS)
                          </label>
                          <p className="text-sm text-gray-900">
                            {(() => {
                              const intake = patient.createdAt ? new Date(patient.createdAt) : null;
                              const discharge = patient.dischargeCriteria?.dischargeDate ? new Date(patient.dischargeCriteria.dischargeDate) : (patient.status === 'discharged' ? new Date() : null);
                              if (!intake) return 'N/A';
                              const end = discharge || new Date();
                              const diff = Math.max(0, Math.floor((end.getTime() - intake.getTime()) / (1000 * 60 * 60 * 24)));
                              return `${diff} day${diff !== 1 ? 's' : ''}`;
                            })()}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Discharge Date
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.dischargeCriteria?.dischargeDate ? formatDate(patient.dischargeCriteria.dischargeDate) : 
                             patient.status === 'discharged' ? "Not recorded" : "Not discharged"}
                          </p>
                        </div>
                      </div>

                      {patient.createdBy && canSeeCreatedBy(user) && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Created By
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.createdBy.firstName}{" "}
                            {patient.createdBy.lastName}
                            <span className="text-gray-500 ml-2">
                              ({patient.createdBy.role})
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Phone className="h-5 w-5" />
                        <span>Contact Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Email
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.email || "Not provided"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Phone
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.phone || "Not provided"}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Emergency Contact
                        </label>
                        <p className="text-sm text-gray-900">
                          {patient.emergencyContact ? `${patient.emergencyContact.name} (${patient.emergencyContact.relationship}) - ${patient.emergencyContact.phone}` : "Not provided"}
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-500">
                          Address
                        </label>
                        <p className="text-sm text-gray-900">
                          {patient.address || "Not provided"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Medical Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <CreditCard className="h-5 w-5" />
                        <span>Medical & Insurance</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Insurance Provider
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.insurance || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Authorization Number
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.authNumber || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Level of Care (LOC)
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.loc || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Reason for Visit
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.reasonForVisit || "Not specified"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            HIPAA Consent
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.hipaaConsent ? "Provided" : "Not Provided"}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Assigned Therapist
                          </label>
                          <p className="text-sm text-gray-900">
                            {patient.assignedTherapist ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}` : "Not assigned"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Link href={`/appointments/new?patientId=${patient.id}`}>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Appointment
                        </Button>
                      </Link>

                      <Link href={`/records/new?patientId=${patient.id}`}>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Add Treatment Note
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>

                  {/* Treatment Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5" />
                        <span>Treatment Statistics</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Total Appointments
                          </label>
                          <p className="text-2xl font-semibold text-gray-900">
                            {appointments ? appointments.length : 0}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Total Treatment Records
                          </label>
                          <p className="text-2xl font-semibold text-gray-900">
                            {records ? records.length : 0}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Completed Appointments
                          </label>
                          <p className="text-lg font-medium text-green-600">
                            {appointments ? appointments.filter(a => a.status === 'completed').length : 0}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Upcoming Appointments
                          </label>
                          <p className="text-lg font-medium text-blue-600">
                            {appointments ? appointments.filter(a => a.status === 'scheduled').length : 0}
                          </p>
                        </div>
                      </div>
                      
                      {records && records.length > 0 && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">
                            Last Treatment Session
                          </label>
                          <p className="text-sm text-gray-900">
                            {(() => {
                              const sortedRecords = [...records].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
                              const lastRecord = sortedRecords[0];
                              return lastRecord ? `${formatDate(lastRecord.sessionDate)} - ${lastRecord.sessionType}` : "No sessions";
                            })()}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="appointments">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Appointments</CardTitle>
                      <Link href={`/appointments/new?patientId=${patient.id}`}>
                        <Button>
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule New
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {appointmentsLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse"
                          >
                            <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-gray-200 rounded w-20"></div>
                          </div>
                        ))}
                      </div>
                    ) : appointments && appointments.length > 0 ? (
                      <div className="space-y-4">
                        {appointments.map(
                          (appointment: AppointmentWithDetails) => (
                            <div
                              key={appointment.id}
                              className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50"
                            >
                              <div
                                className={`w-3 h-3 rounded-full crm-status-${appointment.status}`}
                              ></div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {appointment.type}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {formatDateTime(appointment.appointmentDate)}{" "}
                                  • {appointment.duration} minutes
                                </p>
                                <p className="text-sm text-gray-500">
                                  {appointment.therapist ? (
                                    <>with {appointment.therapist.firstName} {appointment.therapist.lastName}</>
                                  ) : (
                                    <>No therapist assigned</>
                                  )}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  appointment.status === "completed"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {appointment.status}
                              </Badge>
                              {/* Delete button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                                title="Delete Appointment"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Are you sure you want to delete this appointment? This action cannot be undone.",
                                    )
                                  ) {
                                    deleteAppointmentMutation.mutate(
                                      appointment.id,
                                    );
                                  }
                                }}
                                disabled={deleteAppointmentMutation.isPending}
                              >
                                {deleteAppointmentMutation.isPending ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No appointments found for this patient.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="records">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Treatment Records</CardTitle>
                      <Link href={`/records/new?patientId=${patient.id}`}>
                        <Button>
                          <FileText className="h-4 w-4 mr-2" />
                          Add Record
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {recordsLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className="p-4 border rounded-lg animate-pulse"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-4 bg-gray-200 rounded w-20"></div>
                              </div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                              <div className="h-20 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : records && records.length > 0 ? (
                      <div className="space-y-4">
                        {[...records]
                          .sort((a: any, b: any) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
                          .map((record: TreatmentRecordWithDetails) => (
                          <div
                            key={record.id}
                            className="p-4 border rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {record.sessionType}
                                </h4>
                                <p className="text-sm text-gray-600">
                                  {formatDateTime(record.sessionDate)} • by{" "}
                                  {record.therapist
                                    ? `${record.therapist.firstName} ${record.therapist.lastName}`
                                    : "Unknown Therapist"}
                                </p>
                              </div>
                              <Clock className="h-4 w-4 text-gray-400" />
                            </div>

                            {record.notes && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-700 mb-1">
                                  Session Notes
                                </h5>
                                <p className="text-sm text-gray-600 line-clamp-3">
                                  {record.notes}
                                </p>
                              </div>
                            )}

                            {record.goals && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-700 mb-1">
                                  Goals
                                </h5>
                                <p className="text-sm text-gray-600">
                                  {record.goals}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No treatment records found for this patient.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {canUseChat && (
                <TabsContent value="notes">
                  <PatientNotes patientId={patientId} />
                </TabsContent>
              )}

              {canPerformAssessments && (
                <TabsContent value="assessment">
                  <Card>
                    <CardHeader>
                      <CardTitle>Patient Assessment</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* List of previous assessments */}
                      <AssessmentsSection patientId={patient.id} patient={patient} />
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {(user?.role === "admin" || user?.role === "supervisor") && (
                <TabsContent value="discharge-requests">
                  <DischargeRequestsList patientId={patientId} />
                </TabsContent>
              )}

              <TabsContent value="treatment-outcomes">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Treatment Outcomes</h3>
                    <Link href={`/patients/${patientId}/treatment-outcomes`}>
                      <Button variant="outline">
                        View Full Treatment Outcomes
                      </Button>
                    </Link>
                  </div>
                  <p className="text-gray-600">
                    Track patient progress, symptom severity, and treatment goals over time.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Discharge Request Dialog */}
      <Dialog open={showDischargeRequest} onOpenChange={setShowDischargeRequest}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Discharge</DialogTitle>
            <DialogDescription>
              Submit a discharge request for this patient. The request will be reviewed by authorized staff.
            </DialogDescription>
          </DialogHeader>
          <DischargeRequestForm
            patientId={patientId}
            patientName={`${patient.firstName} ${patient.lastName}`}
            onRequestSubmitted={() => setShowDischargeRequest(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Patient Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={(open) => {
        console.log("🔍 Dialog onOpenChange called with:", open);
        console.log("🔍 Current showReportDialog in Dialog:", showReportDialog);
        console.log("🔍 Patient data in Dialog:", { patient, patientLoading, patientId: patient?._id });
        // Only allow closing, not opening from external sources
        if (!open) {
          setShowReportDialog(false);
        }
      }}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Patient Report - Dialog State: {showReportDialog.toString()}</DialogTitle>
            <DialogDescription>
              Comprehensive treatment and progress report for {patient?.firstName} {patient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {patientLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading patient data...</p>
                </div>
              </div>
            ) : patient && patient.id ? (
              <PatientReport 
                patientId={patient.id} 
                onClose={() => setShowReportDialog(false)}
              />
            ) : (
              <div className="flex items-center justify-center p-8">
                <div className="text-center text-red-600">
                  <p>Error: Patient data not available</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssessmentsSection({ patientId, patient }: { patientId: string, patient: any }) {
  const { user } = useAuth();
  const canPerformAssessments = ['admin', 'supervisor', 'therapist'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';
  
  // If user cannot perform assessments, show access denied message
  if (!canPerformAssessments) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Access denied. Only admin, supervisor, and therapist roles can perform assessments.</p>
      </div>
    );
  }
  const [form, setForm] = useState({
    presentingProblem: "",
    medicalHistory: "",
    psychiatricHistory: "",
    familyHistory: "",
    socialHistory: "",
    mentalStatus: "",
    riskAssessment: "",
    diagnosis: "",
    impressions: "",
    followUpDate: "",
    followUpNotes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    presentingProblem: "",
    medicalHistory: "",
    psychiatricHistory: "",
    familyHistory: "",
    socialHistory: "",
    mentalStatus: "",
    riskAssessment: "",
    diagnosis: "",
    impressions: "",
    followUpDate: "",
    followUpNotes: "",
    status: "in_progress",
  });
  const { data: assessments = [], refetch, isLoading } = useQuery({
    queryKey: ["/api/patients", patientId, "assessments"],
    queryFn: async () => {
      const res = await fetch(`/api/patients/${patientId}/assessments`);
      if (!res.ok) throw new Error("Failed to fetch assessments");
      return res.json();
    },
    enabled: !!patientId,
  });
  const handleChange = (e: any) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let res;
      if (editingId) {
        res = await fetch(`/api/assessments/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form }),
        });
      } else {
        res = await fetch(`/api/patients/${patientId}/assessments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form }),
        });
      }
      if (!res.ok) throw new Error("Failed to save assessment");
      setForm({
        presentingProblem: "",
        medicalHistory: "",
        psychiatricHistory: "",
        familyHistory: "",
        socialHistory: "",
        mentalStatus: "",
        riskAssessment: "",
        diagnosis: "",
        impressions: "",
        followUpDate: "",
        followUpNotes: "",
      });
      setEditingId(null);
      refetch();
    } catch (err) {
      alert("Failed to save assessment");
    } finally {
      setSubmitting(false);
    }
  };
  const handleEdit = (a: any) => {
    setEditForm({
      presentingProblem: a.presentingProblem || "",
      medicalHistory: a.medicalHistory || "",
      psychiatricHistory: a.psychiatricHistory || "",
      familyHistory: a.familyHistory || "",
      socialHistory: a.socialHistory || "",
      mentalStatus: a.mentalStatus || "",
      riskAssessment: a.riskAssessment || "",
      diagnosis: a.diagnosis || "",
      impressions: a.impressions || "",
      followUpDate: a.followUpDate ? a.followUpDate.slice(0, 10) : "",
      followUpNotes: a.followUpNotes || "",
      status: a.status || "in_progress",
    });
    setEditingId(a.id);
    setEditDialogOpen(true);
  };
  const handleEditChange = (e: any) => {
    setEditForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };
  const handleEditSubmit = async (e: any) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update assessment");
      setEditingId(null);
      setEditDialogOpen(false);
      refetch();
    } catch (err) {
      alert("Failed to update assessment");
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this assessment?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete assessment");
      refetch();
    } catch (err) {
      alert("Failed to delete assessment");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDisplayDate = (date: string) => {
    if (!date) return "N/A";
    return isValid(parseISO(date)) ? format(parseISO(date), "PPP") : format(new Date(date + 'T12:00:00'), "PPP");
  };

  return (
    <div>
      {/* New assessment form */}
      {user?.role !== "frontdesk" && (
        <form className="space-y-4 mb-10 bg-white p-6 rounded-lg shadow border" onSubmit={handleSubmit}>
          <h2 className="text-xl font-bold mb-2 text-gray-800">New Assessment</h2>
          <div>
            <strong>Patient:</strong> {patient.firstName} {patient.lastName}
          </div>
          <div>
            <label className="block font-medium">Presenting Problem</label>
            <textarea className="w-full border rounded p-2" name="presentingProblem" value={form.presentingProblem} onChange={handleChange} required />
          </div>
          <div>
            <label className="block font-medium">Medical History</label>
            <textarea className="w-full border rounded p-2" name="medicalHistory" value={form.medicalHistory} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Psychiatric History</label>
            <textarea className="w-full border rounded p-2" name="psychiatricHistory" value={form.psychiatricHistory} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Family History</label>
            <textarea className="w-full border rounded p-2" name="familyHistory" value={form.familyHistory} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Social History</label>
            <textarea className="w-full border rounded p-2" name="socialHistory" value={form.socialHistory} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Mental Status Exam</label>
            <textarea className="w-full border rounded p-2" name="mentalStatus" value={form.mentalStatus} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Risk Assessment</label>
            <textarea className="w-full border rounded p-2" name="riskAssessment" value={form.riskAssessment} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Diagnosis</label>
            <input className="w-full border rounded p-2" name="diagnosis" value={form.diagnosis} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Initial Impressions & Recommendations</label>
            <textarea className="w-full border rounded p-2" name="impressions" value={form.impressions} onChange={handleChange} required />
          </div>
          <div>
            <label className="block font-medium">Follow-Up Date</label>
            <input type="date" className="w-full border rounded p-2" name="followUpDate" value={form.followUpDate} onChange={handleChange} />
          </div>
          <div>
            <label className="block font-medium">Follow-Up Notes</label>
            <textarea className="w-full border rounded p-2" name="followUpNotes" value={form.followUpNotes} onChange={handleChange} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" variant="default" disabled={submitting}>Save Assessment</Button>
          </div>
        </form>
      )}
      <hr className="my-8" />
      <h3 className="font-semibold mb-4 text-lg text-gray-800 flex items-center gap-2"><span>Previous Assessments</span></h3>
      {isLoading ? (
        <div>Loading assessments...</div>
      ) : assessments.length === 0 ? (
        <div className="text-gray-500">No assessments found for this patient.</div>
      ) : (
        <div className="space-y-6">
          {assessments.map((a: any, idx: number) => (
            <div key={a.id} className="border rounded-lg p-5 bg-gray-50 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-center mb-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium text-blue-900 text-base">Assessment #{assessments.length - idx}</div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${a.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{a.status === 'complete' ? 'Complete' : 'In Progress'}</span>
                </div>
                {(user?.role !== "frontdesk" && (a.status !== 'complete' || isAdmin)) && (
                  <>
                    {a.status !== 'complete' && (
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 transition" onClick={async () => {
                        await fetch(`/api/assessments/${a.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: 'complete' }),
                        });
                        refetch();
                      }}>
                        <CheckCircle className="w-4 h-4" /> Mark as Complete
                      </button>
                    )}
                    <div className="space-x-2 flex">
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition" onClick={() => handleEdit(a)}>
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                      <button className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded bg-red-100 text-red-700 hover:bg-red-200 transition" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="w-4 h-4" /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Created by: {a.createdBy?.name || 'Unknown'} ({a.createdBy?.role || 'N/A'})
                {a.updatedBy && a.updatedBy.name && a.updatedBy.name !== a.createdBy?.name && (
                  <> | Last updated by: {a.updatedBy.name} ({a.updatedBy.role || 'N/A'})</>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><span className="font-semibold text-gray-700">Presenting Problem:</span> {a.presentingProblem}</div>
                <div><span className="font-semibold text-gray-700">Impressions:</span> {a.impressions}</div>
                {a.diagnosis && <div><span className="font-semibold text-gray-700">Diagnosis:</span> {a.diagnosis}</div>}
                {a.followUpDate && (
                  <div>
                    <span className="font-semibold text-gray-700">Follow-Up:</span> {
                      typeof a.followUpDate === 'string'
                        ? (isValid(parseISO(a.followUpDate)) ? format(parseISO(a.followUpDate), "PPP") : format(new Date(a.followUpDate + 'T12:00:00'), "PPP"))
                        : format(new Date(a.followUpDate), "PPP")
                    }
                  </div>
                )}
                {a.followUpNotes && <div><span className="font-semibold text-gray-700">Follow-Up Notes:</span> {a.followUpNotes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Edit Assessment Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={open => { setEditDialogOpen(open); if (!open) { setEditingId(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-white shadow-xl rounded-lg p-0">
          <div className="sticky top-0 z-10 bg-white border-b px-6 pt-4 pb-2 rounded-t-lg shadow-sm">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Edit Assessment</DialogTitle>
              <DialogDescription>
                Update the patient's assessment information. Some fields may be restricted based on your role and assessment status.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form id="edit-assessment-form" className="space-y-5 px-6 pt-2 pb-20" onSubmit={handleEditSubmit}>
            <div className="mb-2">
              <strong>Patient:</strong> {patient.firstName} {patient.lastName}
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Presenting Problem</label>
              <textarea className="w-full border rounded p-2" name="presentingProblem" value={editForm.presentingProblem} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Medical History</label>
              <textarea className="w-full border rounded p-2" name="medicalHistory" value={editForm.medicalHistory} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Psychiatric History</label>
              <textarea className="w-full border rounded p-2" name="psychiatricHistory" value={editForm.psychiatricHistory} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Family History</label>
              <textarea className="w-full border rounded p-2" name="familyHistory" value={editForm.familyHistory} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Social History</label>
              <textarea className="w-full border rounded p-2" name="socialHistory" value={editForm.socialHistory} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Mental Status Exam</label>
              <textarea className="w-full border rounded p-2" name="mentalStatus" value={editForm.mentalStatus} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Risk Assessment</label>
              <textarea className="w-full border rounded p-2" name="riskAssessment" value={editForm.riskAssessment} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Diagnosis</label>
              <input className="w-full border rounded p-2" name="diagnosis" value={editForm.diagnosis} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Initial Impressions & Recommendations</label>
              <textarea className="w-full border rounded p-2" name="impressions" value={editForm.impressions} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Follow-Up Date</label>
              <input type="date" className="w-full border rounded p-2" name="followUpDate" value={editForm.followUpDate} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
            <div className="space-y-2">
              <label className="block font-semibold">Follow-Up Notes</label>
              <textarea className="w-full border rounded p-2" name="followUpNotes" value={editForm.followUpNotes} onChange={handleEditChange} disabled={user?.role === "frontdesk" || (editForm.status === 'complete' && !isAdmin)} />
            </div>
          </form>
          <div className="sticky bottom-0 z-10 bg-white border-t px-6 py-4 flex justify-end space-x-2 rounded-b-lg shadow-sm">
            <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition" onClick={() => { setEditDialogOpen(false); setEditingId(null); }}>Close</button>
            {(user?.role !== "frontdesk" && (editForm.status !== 'complete' || isAdmin)) && (
              <button type="submit" form="edit-assessment-form" className="inline-flex items-center gap-2 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 font-semibold shadow transition" disabled={submitting}>
                <CheckCircle className="w-5 h-5" /> {submitting ? "Updating..." : "Update Assessment"}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
