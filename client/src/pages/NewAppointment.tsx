// @ts-nocheck
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppointmentForm } from "@/components/appointments/AppointmentForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

// Type for MongoDB appointments
type InsertAppointment = {
  patientId: string;
  therapistId: string;
  appointmentDate: Date;
  duration: number;
  type: string;
  status: string;
  notes?: string;
};

export default function NewAppointment() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Get URL parameters for pre-filled patient
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedPatientId = urlParams.get("patientId");

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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

  const { data: patients } = useQuery({
    queryKey: ["/api/patients", { limit: 1000 }],
    retry: false,
  });

  const { data: therapists } = useQuery({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  // Fetch all appointments to determine patient history
  const { data: appointments } = useQuery({
    queryKey: ["/api/appointments"],
    retry: false,
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: InsertAppointment) => {
      const response = await apiRequest(
        "POST",
        "/api/appointments",
        appointmentData,
      );
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all appointment-related queries to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/stats"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/today-appointments"],
        exact: false,
      });

      // Also remove any cached appointment data to force fresh fetch
      queryClient.removeQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });

      toast({
        title: "Success",
        description: "Appointment scheduled successfully.",
      });

      setLocation("/appointments");
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
        description: "Failed to schedule appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const defaultTherapistId = user?.role === "therapist" ? user.id : "";

  // Create patient history object
  const patientHistory: { [patientId: number]: boolean } = {};
  if (appointments?.appointments && patients?.patients) {
    appointments.appointments.forEach((appointment: any) => {
      if (appointment.patientId && appointment.patientId._id) {
        const patientId = Number(appointment.patientId._id);
        if (!isNaN(patientId)) {
          patientHistory[patientId] = true;
        }
      }
    });
  }

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
                onClick={() => setLocation("/appointments")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Appointments
              </Button>
            </div>

            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">
                Schedule New Appointment
              </h1>
              <p className="text-gray-600 mt-1">
                Create a new appointment for patient care.
              </p>
            </div>

            {/* Appointment Form */}
            <div className="max-w-4xl">
              <AppointmentForm
                initialData={{
                  patientId: preselectedPatientId || "",
                  therapistId: defaultTherapistId,
                  appointmentDate: new Date(),
                  duration: 60,
                  type: "therapy",
                  status: "scheduled",
                  notes: "",
                }}
                onSubmit={(data) => createAppointmentMutation.mutate(data)}
                isLoading={createAppointmentMutation.isPending}
                submitLabel="Schedule Appointment"
                patients={patients?.patients || []}
                therapists={therapists || []}
                isNewAppointment={true}
                patientHistory={patientHistory}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
