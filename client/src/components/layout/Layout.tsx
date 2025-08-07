import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { PatientDetailsDialog } from "@/components/patients/PatientDetailsDialog";
import { useState, createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";

// Global patient dialog context
interface PatientDialogContextType {
  openPatientDialog: (patientId: string) => void;
  closePatientDialog: () => void;
}

const PatientDialogContext = createContext<PatientDialogContextType | null>(null);

export const usePatientDialog = () => {
  const context = useContext(PatientDialogContext);
  if (!context) {
    throw new Error("usePatientDialog must be used within a PatientDialogProvider");
  }
  return context;
};

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showPatientDialog, setShowPatientDialog] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch discharge requests count for admin and supervisor users
  const { data: dischargeRequestsCount = 0 } = useQuery({
    queryKey: ["discharge-requests-count"],
    queryFn: async () => {
      // Only fetch if user is admin or supervisor
      if (user?.role !== "admin" && user?.role !== "supervisor") {
        return 0;
      }
      
      const response = await fetch("/api/discharge-requests/pending");
      if (!response.ok) throw new Error("Failed to fetch discharge requests count");
      const data = await response.json();
      return data.length; // Return count of pending requests
    },
    enabled: user?.role === "admin" || user?.role === "supervisor",
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Real-time socket connection for discharge requests updates
  useSocket({
    onDischargeRequestCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['discharge-requests-count'] });
    },
    onDischargeRequestUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['discharge-requests-count'] });
    },
  });

  const openPatientDialog = (patientId: string) => {
    setSelectedPatientId(patientId);
    setShowPatientDialog(true);
  };

  const closePatientDialog = () => {
    setShowPatientDialog(false);
    setSelectedPatientId(null);
  };

  return (
    <PatientDialogContext.Provider value={{ openPatientDialog, closePatientDialog }}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar dischargeRequestsCount={dischargeRequestsCount} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
      <PatientDetailsDialog
        patientId={selectedPatientId}
        isOpen={showPatientDialog}
        onClose={closePatientDialog}
      />
    </PatientDialogContext.Provider>
  );
} 