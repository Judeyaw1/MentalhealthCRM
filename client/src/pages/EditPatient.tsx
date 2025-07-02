import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PatientForm } from "@/components/patients/PatientForm";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { InsertPatient } from "@shared/schema";

export default function EditPatient() {
  const params = useParams();
  const patientId = parseInt(params.id as string);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}`],
    retry: false,
    enabled: !isNaN(patientId),
  });

  const updatePatientMutation = useMutation({
    mutationFn: async (patientData: Partial<InsertPatient>) => {
      const response = await apiRequest("PATCH", `/api/patients/${patientId}`, patientData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent-patients"] });
      
      toast({
        title: "Success",
        description: "Patient updated successfully.",
      });
      
      setLocation(`/patients/${patientId}`);
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
        description: "Failed to update patient. Please try again.",
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
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">Patient Not Found</h1>
                <p className="text-gray-600">The requested patient could not be found.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">
                Edit Patient: {patient.firstName} {patient.lastName}
              </h1>
              <p className="text-gray-600 mt-1">
                Update patient profile and medical information.
              </p>
            </div>

            {/* Patient Form */}
            <div className="max-w-4xl">
              <PatientForm
                initialData={{
                  firstName: patient.firstName,
                  lastName: patient.lastName,
                  dateOfBirth: patient.dateOfBirth,
                  gender: patient.gender || "",
                  email: patient.email || "",
                  phone: patient.phone || "",
                  emergencyContact: patient.emergencyContact || "",
                  address: patient.address || "",
                  insurance: patient.insurance || "",
                  reasonForVisit: patient.reasonForVisit || "",
                  status: patient.status,
                  hipaaConsent: patient.hipaaConsent,
                  assignedTherapistId: patient.assignedTherapistId || "",
                }}
                onSubmit={(data) => updatePatientMutation.mutate(data)}
                isLoading={updatePatientMutation.isPending}
                submitLabel="Update Patient Record"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
