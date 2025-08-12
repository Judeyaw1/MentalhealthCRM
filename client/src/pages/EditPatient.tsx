// @ts-nocheck
import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PatientForm } from "@/components/patients/PatientForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { InsertPatient } from "@shared/types";

export default function EditPatient() {
  const params = useParams();
  const patientId = params.id as string;
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
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Real-time socket connection for instant updates
  useSocket({
    onPatientUpdated: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}`],
    retry: false,
    enabled: !!patientId,
  });

  const updatePatientMutation = useMutation({
            mutationFn: async (patientData: Partial<InsertPatient> | FormData) => {
      
      if (typeof FormData !== 'undefined' && patientData instanceof FormData) {
        // Send as multipart/form-data
        const response = await fetch(`/api/patients/${patientId}`, {
          method: "PATCH",
          body: patientData,
        });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update patient: ${response.status} ${errorText}`);
        }
        return response.json();
      } else {
        // Send as JSON
                  const response = await fetch(`/api/patients/${patientId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(patientData),
            credentials: "include",
          });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to update patient: ${response.status} ${errorText}`);
        }
        
                  const result = await response.json();
          return result;
      }
    },
    onSuccess: (data) => {
      console.log("✅ Mutation onSuccess called with data:", data);
      queryClient.invalidateQueries({
        queryKey: [`/api/patients/${patientId}`],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-patients"],
      });

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
          window.location.href = "/login";
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
                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                  Patient Not Found
                </h1>
                <p className="text-gray-600">
                  The requested patient could not be found.
                </p>
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
            {/* Return Arrow */}
            <div className="mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation(`/patients/${patientId}`)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Patient Details
              </Button>
            </div>

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
              initialData={patient}
              onSubmit={(data) => {
                console.log("🔍 EditPatient onSubmit called with data:", data);
                updatePatientMutation.mutate(data);
              }}
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
