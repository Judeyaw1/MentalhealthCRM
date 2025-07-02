import { useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Edit, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard,
  FileText,
  Clock,
  User
} from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { PatientWithTherapist, AppointmentWithDetails, TreatmentRecordWithDetails } from "@shared/schema";

export default function PatientDetail() {
  const params = useParams();
  const patientId = parseInt(params.id as string);
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
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

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["/api/appointments", { patientId }],
    retry: false,
    enabled: !isNaN(patientId),
  });

  const { data: records, isLoading: recordsLoading } = useQuery({
    queryKey: [`/api/patients/${patientId}/records`],
    retry: false,
    enabled: !isNaN(patientId),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/patients/${patientId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      toast({
        title: "Success",
        description: "Patient status updated successfully.",
      });
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
        description: "Failed to update patient status.",
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
                <Link href="/patients">
                  <Button className="mt-4">Back to Patients</Button>
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success-100 text-success-500">Active</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "discharged":
        return <Badge variant="outline">Discharged</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Patient Header */}
            <div className="mb-8">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary-100 text-primary-600 text-xl">
                      {getInitials(patient.firstName, patient.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h1 className="text-3xl font-semibold text-gray-900">
                      {patient.firstName} {patient.lastName}
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Patient ID: #P-{patient.id.toString().padStart(4, '0')}
                    </p>
                    <div className="flex items-center space-x-4 mt-2">
                      {getStatusBadge(patient.status)}
                      <span className="text-sm text-gray-500">
                        Age: {calculateAge(patient.dateOfBirth)}
                      </span>
                      {patient.assignedTherapist && (
                        <span className="text-sm text-gray-500">
                          Therapist: {patient.assignedTherapist.firstName} {patient.assignedTherapist.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <Link href={`/patients/${patient.id}/edit`}>
                    <Button variant="outline" className="flex items-center space-x-2">
                      <Edit className="h-4 w-4" />
                      <span>Edit Patient</span>
                    </Button>
                  </Link>
                  
                  <Button
                    variant={patient.status === "active" ? "outline" : "default"}
                    onClick={() => updateStatusMutation.mutate(
                      patient.status === "active" ? "inactive" : "active"
                    )}
                    disabled={updateStatusMutation.isPending}
                  >
                    {patient.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="appointments">Appointments</TabsTrigger>
                <TabsTrigger value="records">Treatment Records</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Personal Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <User className="h-5 w-5" />
                        <span>Personal Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">First Name</label>
                          <p className="text-sm text-gray-900">{patient.firstName}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Last Name</label>
                          <p className="text-sm text-gray-900">{patient.lastName}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                          <p className="text-sm text-gray-900">{formatDate(patient.dateOfBirth)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Gender</label>
                          <p className="text-sm text-gray-900 capitalize">{patient.gender || "Not specified"}</p>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-500">Registration Date</label>
                        <p className="text-sm text-gray-900">{formatDate(patient.createdAt!)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contact Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Phone className="h-5 w-5" />
                        <span>Contact Information</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="text-sm font-medium text-gray-500">Email</label>
                          <p className="text-sm text-gray-900">{patient.email || "Not provided"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="text-sm font-medium text-gray-500">Phone</label>
                          <p className="text-sm text-gray-900">{patient.phone || "Not provided"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <div>
                          <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                          <p className="text-sm text-gray-900">{patient.emergencyContact || "Not provided"}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-3">
                        <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                        <div>
                          <label className="text-sm font-medium text-gray-500">Address</label>
                          <p className="text-sm text-gray-900">{patient.address || "Not provided"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Medical Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <CreditCard className="h-5 w-5" />
                        <span>Medical & Insurance</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Insurance Provider</label>
                        <p className="text-sm text-gray-900">{patient.insurance || "Not provided"}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-500">Reason for Visit</label>
                        <p className="text-sm text-gray-900">{patient.reasonForVisit || "Not provided"}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-500">HIPAA Consent</label>
                        <p className="text-sm text-gray-900">
                          {patient.hipaaConsent ? "Provided" : "Not provided"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Link href={`/appointments/new?patientId=${patient.id}`}>
                        <Button variant="outline" className="w-full justify-start">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Appointment
                        </Button>
                      </Link>
                      
                      <Link href={`/records/new?patientId=${patient.id}`}>
                        <Button variant="outline" className="w-full justify-start">
                          <FileText className="h-4 w-4 mr-2" />
                          Add Treatment Note
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="appointments">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Appointments</CardTitle>
                      <Link href={`/appointments/new?patientId=${patient.id}`}>
                        <Button>
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule New
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {appointmentsLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                            <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-gray-200 rounded w-20"></div>
                          </div>
                        ))}
                      </div>
                    ) : appointments && appointments.length > 0 ? (
                      <div className="space-y-4">
                        {appointments.map((appointment: AppointmentWithDetails) => (
                          <div key={appointment.id} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-gray-50">
                            <div className={`w-3 h-3 rounded-full crm-status-${appointment.status}`}></div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{appointment.type}</p>
                              <p className="text-sm text-gray-600">
                                {formatDateTime(appointment.appointmentDate)} • {appointment.duration} minutes
                              </p>
                              <p className="text-sm text-gray-500">
                                with {appointment.therapist.firstName} {appointment.therapist.lastName}
                              </p>
                            </div>
                            <Badge variant={appointment.status === "completed" ? "default" : "secondary"}>
                              {appointment.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No appointments found for this patient.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="records">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Treatment Records</CardTitle>
                      <Link href={`/records/new?patientId=${patient.id}`}>
                        <Button>
                          <FileText className="h-4 w-4 mr-2" />
                          Add Record
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {recordsLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="p-4 border rounded-lg animate-pulse">
                            <div className="space-y-3">
                              <div className="flex justify-between">
                                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                                <div className="h-4 bg-gray-200 rounded w-20"></div>
                              </div>
                              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                              <div className="h-20 bg-gray-200 rounded"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : records && records.length > 0 ? (
                      <div className="space-y-4">
                        {records.map((record: TreatmentRecordWithDetails) => (
                          <div key={record.id} className="p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-medium text-gray-900">{record.sessionType}</h4>
                                <p className="text-sm text-gray-600">
                                  {formatDateTime(record.sessionDate)} • by {record.therapist.firstName} {record.therapist.lastName}
                                </p>
                              </div>
                              <Clock className="h-4 w-4 text-gray-400" />
                            </div>
                            
                            {record.notes && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-700 mb-1">Session Notes</h5>
                                <p className="text-sm text-gray-600 line-clamp-3">{record.notes}</p>
                              </div>
                            )}
                            
                            {record.goals && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium text-gray-700 mb-1">Goals</h5>
                                <p className="text-sm text-gray-600">{record.goals}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No treatment records found for this patient.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
