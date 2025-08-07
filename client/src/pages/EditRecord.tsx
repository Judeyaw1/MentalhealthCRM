import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { TreatmentRecordForm } from "@/components/records/TreatmentRecordForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";

// Type for MongoDB treatment records
type UpdateTreatmentRecord = {
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
type TreatmentRecordFormData = Omit<UpdateTreatmentRecord, "sessionDate"> & {
  sessionDate: number;
};

export default function EditRecord() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [recordId, setRecordId] = useState<string | null>(null);

  // Extract record ID from URL
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/records\/([^\/]+)\/edit/);
    if (match) {
      setRecordId(match[1]);
    }
  }, []);

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

  // Fetch record data
  const { data: record, isLoading: recordLoading } = useQuery({
    queryKey: ["/api/records", recordId],
    queryFn: async () => {
      if (!recordId) return null;
      const response = await fetch(`/api/records/${recordId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch record");
      }
      return response.json();
    },
    enabled: !!recordId,
    retry: false,
  });

  const { data: patients } = useQuery<{
    patients: { id: number; firstName: string; lastName: string }[];
    total: number;
  }>({
    queryKey: ["/api/patients", { limit: 1000 }],
    retry: false,
  });

  const { data: therapists } = useQuery<
    { id: string; firstName: string; lastName: string }[]
  >({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  // Real-time socket connection for instant updates
  useSocket({
    onTreatmentRecordUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/records'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: async (recordData: TreatmentRecordFormData) => {
      const response = await apiRequest("PUT", `/api/records/${recordId}`, recordData);
      return response.json() as Promise<any>;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      if (record?.patientId) {
        queryClient.invalidateQueries({
          queryKey: [`/api/patients/${record.patientId}/records`],
        });
      }

      toast({
        title: "Success",
        description: "Treatment record updated successfully.",
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
          window.location.href = "/login";
        }, 500);
        return;
      }

      console.error("Error updating record:", error);
      toast({
        title: "Error",
        description: "Failed to update treatment record. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (formData: TreatmentRecordFormData) => {
    updateRecordMutation.mutate(formData);
  };

  if (recordLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading record...</p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Record Not Found</h2>
          <p className="text-gray-600 mb-4">The treatment record you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/records")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Records
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="flex">
        <Sidebar />

        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setLocation("/records")}
                  className="flex items-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Records
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Edit Treatment Record
                  </h1>
                  <p className="text-gray-600">
                    Update treatment record for {record.patient?.firstName} {record.patient?.lastName}
                  </p>
                </div>
              </div>
            </div>



            {/* Form */}
            <div className="bg-white rounded-lg shadow">
              <TreatmentRecordForm
                onSubmit={handleSubmit}
                isLoading={updateRecordMutation.isPending}
                patients={patients?.patients || []}
                therapists={therapists || []}
                initialData={{
                  patientId: record.patientId?._id || record.patientId?.toString() || record.patientId,
                  therapistId: record.therapistId?._id || record.therapistId?.toString() || record.therapistId,
                  sessionDate: new Date(record.sessionDate),
                  sessionType: record.sessionType,
                  notes: record.notes || "",
                  goals: record.goals || "",
                  interventions: record.interventions || "",
                  progress: record.progress || "",
                  planForNextSession: record.planForNextSession || "",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 