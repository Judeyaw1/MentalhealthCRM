import { useState, createContext, useContext } from "react";
import { PatientDetailsDialog } from "@/components/patients/PatientDetailsDialog";

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

interface PatientDialogProviderProps {
  children: React.ReactNode;
}

export function PatientDialogProvider({ children }: PatientDialogProviderProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showPatientDialog, setShowPatientDialog] = useState(false);

  const openPatientDialog = (patientId: string) => {
    console.log("🚀 openPatientDialog called with patientId:", patientId);
    console.log("🚀 Current state before update - selectedPatientId:", selectedPatientId, "showPatientDialog:", showPatientDialog);
    setSelectedPatientId(patientId);
    setShowPatientDialog(true);
    console.log("✅ Dialog state updated - selectedPatientId:", patientId, "showPatientDialog: true");
  };

  const closePatientDialog = () => {
    setShowPatientDialog(false);
    setSelectedPatientId(null);
  };

  console.log("🎭 PatientDialogProvider render - selectedPatientId:", selectedPatientId, "showPatientDialog:", showPatientDialog);
  
  return (
    <PatientDialogContext.Provider value={{ openPatientDialog, closePatientDialog }}>
      {children}
      <PatientDetailsDialog
        patientId={selectedPatientId}
        isOpen={showPatientDialog}
        onClose={closePatientDialog}
      />
    </PatientDialogContext.Provider>
  );
} 