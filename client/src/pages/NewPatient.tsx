import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PatientForm } from "@/components/patients/PatientForm";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  UserPlus,
  Info,
  Shield,
  FileText,
  Phone,
  User as UserIcon,
  Plus,
  Clock,
} from "lucide-react";
import type { InsertPatient } from "@shared/types";

export default function NewPatient() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });

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
    onPatientCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onPatientUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: InsertPatient) => {
      const response = await apiRequest("POST", "/api/patients", patientData);
      return response.json();
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-patients"],
      });

      toast({
        title: "Patient Created Successfully",
        description: `${patient.firstName} ${patient.lastName} has been added to the system.`,
      });

      setLocation(`/patients/${patient.id}`);
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
        description: "Failed to create patient. Please try again.",
        variant: "destructive",
      });
    },
  });

  const quickAddMutation = useMutation({
    mutationFn: async (patientData: InsertPatient) => {
      const response = await apiRequest("POST", "/api/patients", patientData);
      return response.json();
    },
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/recent-patients"],
      });

      toast({
        title: "Patient Added Successfully",
        description: `${patient.firstName} ${patient.lastName} has been added with basic information.`,
      });

      setShowQuickAdd(false);
      setQuickAddData({ firstName: "", lastName: "", phone: "", email: "" });
      setLocation(`/patients/${patient.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create patient. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleQuickAdd = () => {
    if (
      !quickAddData.firstName ||
      !quickAddData.lastName ||
      !quickAddData.phone
    ) {
      toast({
        title: "Missing Information",
        description:
          "Please fill in at least first name, last name, and phone number.",
        variant: "destructive",
      });
      return;
    }

    const patientData: InsertPatient = {
      firstName: quickAddData.firstName,
      lastName: quickAddData.lastName,
      phone: quickAddData.phone,
      email: quickAddData.email || "",
      dateOfBirth: new Date(), // Default to today
      gender: "",
      emergencyContact: undefined,
      address: "",
      insurance: "",
      reasonForVisit: "Quick add - details to be completed",
      status: "active",
      hipaaConsent: true, // Default to true for quick add
      assignedTherapistId: "",
    };

    quickAddMutation.mutate(patientData);
  };

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
            {/* Breadcrumbs */}
            <div className="flex items-center space-x-2 text-sm text-gray-600 mb-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation("/patients")}
                className="flex items-center gap-1 hover:text-primary"
              >
                <ChevronLeft className="w-4 h-4" />
                Patients
              </Button>
              <span>/</span>
              <span className="text-primary font-medium">New Patient</span>
            </div>

            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <UserPlus className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      New Patient Registration
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Create a comprehensive patient profile with complete
                      medical and contact information.
                    </p>
                  </div>
                </div>

                {/* Quick Add Button */}
                <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Quick Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Quick Add Patient</DialogTitle>
                      <DialogDescription>
                        Add a patient with basic information. You can complete
                        the full profile later.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName">First Name *</Label>
                          <Input
                            id="firstName"
                            value={quickAddData.firstName}
                            onChange={(e) =>
                              setQuickAddData((prev) => ({
                                ...prev,
                                firstName: e.target.value,
                              }))
                            }
                            placeholder="First name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="lastName">Last Name *</Label>
                          <Input
                            id="lastName"
                            value={quickAddData.lastName}
                            onChange={(e) =>
                              setQuickAddData((prev) => ({
                                ...prev,
                                lastName: e.target.value,
                              }))
                            }
                            placeholder="Last name"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={quickAddData.phone}
                          onChange={(e) =>
                            setQuickAddData((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="Phone number"
                        />
                      </div>
                      <div>
                        <Label htmlFor="email">Email (Optional)</Label>
                        <Input
                          id="email"
                          type="email"
                          value={quickAddData.email}
                          onChange={(e) =>
                            setQuickAddData((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="Email address"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowQuickAdd(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleQuickAdd}
                          disabled={quickAddMutation.isPending}
                        >
                          {quickAddMutation.isPending
                            ? "Adding..."
                            : "Add Patient"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <Badge variant="secondary">Step-by-step form</Badge>
                <Badge variant="outline">HIPAA compliant</Badge>
                <Badge variant="outline">Auto-save enabled</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-3">
                <PatientForm
                  onSubmit={(data) => createPatientMutation.mutate(data)}
                  isLoading={createPatientMutation.isPending}
                  submitLabel="Create Patient Record"
                />
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Quick Tips */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Info className="w-5 h-5" />
                      Quick Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-gray-600">
                        All fields marked with * are required
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-gray-600">
                        You can navigate between steps using Previous/Next
                        buttons
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-gray-600">
                        HIPAA consent is mandatory for patient registration
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-gray-600">
                        Assign a therapist to automatically schedule follow-ups
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-gray-600">
                        Use "Quick Add" for urgent patient registration
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Required Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="w-5 h-5" />
                      Required Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">Personal details</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">Contact information</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">Medical history</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">Privacy consent</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy Notice */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Shield className="w-5 h-5" />
                      Privacy Notice
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        All patient information is protected under HIPAA
                        regulations. We maintain strict confidentiality and
                        security measures to protect your privacy.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
