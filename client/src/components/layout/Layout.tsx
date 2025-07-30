import { ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { PatientDetailsDialog } from "@/components/patients/PatientDetailsDialog";
import { useState, createContext, useContext } from "react";

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
        <Sidebar />
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