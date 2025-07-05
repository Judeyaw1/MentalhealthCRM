import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { TreatmentRecordForm } from "@/components/records/TreatmentRecordForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

// Type for MongoDB treatment records
type InsertTreatmentRecord = {
  patientId: string;
  therapistId: string;
  sessionDate: Date;
  sessionType: string;
  notes?: string;
  goals?: string;
  interventions?: string;
  progress?: string;
  planForNextSession?: string;
};

// Type for form submission with timestamp
type TreatmentRecordFormData = Omit<InsertTreatmentRecord, 'sessionDate'> & {
  sessionDate: number;
};

export default function NewRecord() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Get URL parameters for pre-filled patient
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedPatientId = urlParams.get('patientId');

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

  const { data: patients } = useQuery<{ patients: { id: number; firstName: string; lastName: string }[]; total: number }>({
    queryKey: ["/api/patients", { limit: 1000 }],
    retry: false,
  });

  const { data: therapists } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  const createRecordMutation = useMutation({
    mutationFn: async (recordData: TreatmentRecordFormData) => {
      const response = await apiRequest("POST", "/api/records", recordData);
      return response.json() as Promise<any>;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      if (preselectedPatientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${preselectedPatientId}/records`] });
      }
      
      toast({
        title: "Success",
        description: "Treatment record created successfully.",
      });
      
      setLocation("/records");
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
        description: "Failed to create treatment record. Please try again.",
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
                onClick={() => setLocation("/records")}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Records
              </Button>
            </div>

            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold text-gray-900">New Treatment Record</h1>
              <p className="text-gray-600 mt-1">
                Document patient session details and treatment progress.
              </p>
            </div>

            {/* Treatment Record Form */}
            <div className="max-w-4xl">
              <TreatmentRecordForm
                initialData={{
                  patientId: preselectedPatientId ? preselectedPatientId : "",
                  therapistId: user?.id || "",
                  sessionDate: new Date(),
                  sessionType: "therapy",
                  notes: "",
                  goals: "",
                  interventions: "",
                  progress: "",
                  planForNextSession: "",
                }}
                onSubmit={(data) => createRecordMutation.mutate(data)}
                isLoading={createRecordMutation.isPending}
                patients={patients?.patients || []}
                therapists={therapists || []}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
