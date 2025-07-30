import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientForm } from "./PatientForm";

interface PatientDetailsDialogProps {
  patientId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PatientDetailsDialog({ patientId, isOpen, onClose }: PatientDetailsDialogProps) {
  console.log("🎭 PatientDetailsDialog props:", { patientId, isOpen });
  console.log("🎭 PatientDetailsDialog render triggered");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);

  const { data: patient, isLoading, refetch } = useQuery({
    queryKey: ["/api/patients", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) throw new Error("Failed to fetch patient details");
      return response.json();
    },
    enabled: !!patientId && isOpen,
    retry: false,
  });

  const canEdit = user && patient && patient.assignedTherapistId && user.id === patient.assignedTherapistId;

  const handleEdit = () => setEditMode(true);
  const handleCancelEdit = () => setEditMode(false);
  
  const handleSave = async (data: any) => {
    try {
      const response = await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update patient");
      toast({ title: "Patient updated" });
      setEditMode(false);
      refetch();
    } catch (error) {
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  console.log("🎭 PatientDetailsDialog returning JSX, isOpen:", isOpen);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Patient Details</DialogTitle>
          <DialogDescription>
            View all current details about this patient.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-center py-8">Loading...</div>
        ) : !patient ? (
          <div className="text-center py-8">Patient not found.</div>
        ) : editMode ? (
          <PatientForm initialData={patient} onSubmit={handleSave} submitLabel="Save Changes" isLoading={false} />
        ) : (
          <div className="space-y-4">
            {/* Patient Photo */}
            {patient.photoUrl && (
              <div className="flex justify-center mb-4">
                <img
                  src={patient.photoUrl}
                  alt="Patient Photo"
                  className="h-32 w-32 rounded-full object-cover border shadow"
                />
              </div>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><strong>Name:</strong> {patient.firstName} {patient.lastName}</div>
                  <div><strong>Date of Birth:</strong> {new Date(patient.dateOfBirth).toLocaleDateString()}</div>
                  <div><strong>Gender:</strong> {patient.gender}</div>
                  <div><strong>Status:</strong> {patient.status}</div>
                  {/* LOS Calculation */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Length of Stay (LOS):</strong> {(() => {
                      const intake = patient.intakeDate ? new Date(patient.intakeDate) : (patient.createdAt ? new Date(patient.createdAt) : null);
                      const discharge = patient.dischargeDate ? new Date(patient.dischargeDate) : (patient.status === 'discharged' ? new Date() : null);
                      if (!intake) return 'N/A';
                      const end = discharge || new Date();
                      const diff = Math.max(0, Math.floor((end.getTime() - intake.getTime()) / (1000 * 60 * 60 * 24)));
                      return `${diff} day${diff !== 1 ? 's' : ''}`;
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><strong>Email:</strong> {patient.email}</div>
                  <div><strong>Phone:</strong> {patient.phone}</div>
                  <div><strong>Address:</strong> {patient.address}</div>
                  <div><strong>Emergency Contact:</strong> {patient.emergencyContact}</div>
                  <div><strong>Insurance:</strong> {patient.insurance}</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Medical & Insurance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><strong>Insurance:</strong> {patient.insurance}</div>
                  <div><strong>Authorization Number:</strong> {patient.authNumber || '-'}</div>
                  <div><strong>Level of Care (LOC):</strong> {patient.loc || '-'}</div>
                  <div><strong>Reason for Visit:</strong> {patient.reasonForVisit}</div>
                </div>
              </CardContent>
            </Card>
            {/* Uploads Card: Insurance Card and Patient Photo (now directly above Consent & Privacy) */}
            {(patient.insuranceCardUrl || patient.photoUrl) && (
              <Card>
                <CardHeader>
                  <CardTitle>Uploads</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    {patient.insuranceCardUrl && (
                      <div className="flex-1 text-center">
                        <strong>Insurance/Medicare Card:</strong>
                        {patient.insuranceCardUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                          <div className="mt-2">
                            <img
                              src={patient.insuranceCardUrl}
                              alt="Insurance Card"
                              className="max-h-40 rounded border shadow mx-auto"
                            />
                          </div>
                        ) : (
                          <a
                            href={patient.insuranceCardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline ml-2"
                          >
                            Download/View Insurance Card
                          </a>
                        )}
                      </div>
                    )}
                    {patient.photoUrl && (
                      <div className="flex-1 text-center">
                        <strong>Patient Photo:</strong>
                        <div className="mt-2">
                          <img
                            src={patient.photoUrl}
                            alt="Patient Photo"
                            className="h-32 w-32 rounded-full object-cover border shadow mx-auto"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Consent & Privacy (HIPAA) */}
            <Card>
              <CardHeader>
                <CardTitle>Consent & Privacy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><strong>HIPAA Consent:</strong> {patient.hipaaConsent ? "Yes" : "No"}</div>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2 mt-4">
              {canEdit && (
                <Button onClick={handleEdit} variant="outline">
                  Edit Patient
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
} 