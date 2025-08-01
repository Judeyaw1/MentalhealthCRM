import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Search,
  Filter,
  RotateCcw,
  Eye,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  User,
} from "lucide-react";
import { format } from "date-fns";

interface ArchivedPatient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  status: "discharged";
  createdAt: string;
  updatedAt: string;
  assignedTherapist?: {
    firstName: string;
    lastName: string;
  };
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}

export default function Archive() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPatient, setSelectedPatient] = useState<ArchivedPatient | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

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

    // Check if user has permission to access archive
    if (user && user.role !== "admin" && user.role !== "supervisor") {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the archive.",
        variant: "destructive",
      });
      setLocation("/dashboard");
      return;
    }
  }, [isAuthenticated, authLoading, user, toast, setLocation]);

  // Fetch archived patients
  const { data: archivedPatients, isLoading } = useQuery<ArchivedPatient[]>({
    queryKey: ["/api/patients/archived"],
    queryFn: async () => {
      const response = await fetch("/api/patients/archived");
      if (!response.ok) {
        throw new Error("Failed to fetch archived patients");
      }
      return response.json();
    },
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchIntervalInBackground: true,
  });

  // Fetch total patients count
  const { data: totalPatientsData } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const response = await fetch("/api/patients?limit=1");
      if (!response.ok) {
        throw new Error("Failed to fetch total patients");
      }
      return response.json();
    },
    retry: false,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  // Restore patient mutation
  const restorePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const response = await fetch(`/api/patients/${patientId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to restore patient");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Patient Restored",
        description: "Patient has been restored successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/patients/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      setShowRestoreDialog(false);
      setSelectedPatient(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to restore patient. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleRestore = (patient: ArchivedPatient) => {
    setSelectedPatient(patient);
    setShowRestoreDialog(true);
  };

  const confirmRestore = () => {
    if (selectedPatient) {
      restorePatientMutation.mutate(selectedPatient.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      discharged: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredPatients = archivedPatients
    ?.filter((patient) => {
      const matchesSearch =
        patient.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.phone.includes(searchQuery);

      const matchesStatus = statusFilter === "all" || patient.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    ?.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); // Sort by most recent first

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onSearch={() => {}} />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <div>
                                      <h1 className="text-2xl font-bold text-gray-900">Archive Patients</h1>
                  <p className="text-gray-600">
                    View and manage discharged patients
                  </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      Admin & Supervisor Access Only
                    </span>
                  </div>
                </div>
              </div>

                          {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalPatientsData?.total || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All patients in system
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Discharged</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {archivedPatients?.filter(p => p.status === "discharged").length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Completed treatment patients
                  </p>
                </CardContent>
              </Card>
            </div>

              {/* Filters */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                          placeholder="Search patients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="w-full sm:w-48">
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                                              <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="discharged">Discharged</SelectItem>
                      </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Patients Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Archived Patients</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Loading archived patients...</p>
                      </div>
                    </div>
                  ) : filteredPatients && filteredPatients.length > 0 ? (
                    <div className="border rounded-lg">
                      <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white z-10">
                            <TableRow>
                              <TableHead className="bg-white">Patient</TableHead>
                              <TableHead className="bg-white">Contact</TableHead>
                              <TableHead className="bg-white">Status</TableHead>
                              <TableHead className="bg-white">Assigned Therapist</TableHead>
                              <TableHead className="bg-white">Archived Date</TableHead>
                              <TableHead className="bg-white">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPatients.map((patient) => (
                              <TableRow key={patient.id}>
                                <TableCell>
                                  <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                                      <User className="h-5 w-5 text-gray-600" />
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {patient.firstName} {patient.lastName}
                                      </div>
                                      <div className="text-sm text-gray-500">
                                        {format(new Date(patient.dateOfBirth), "MMM dd, yyyy")}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="flex items-center text-sm">
                                      <Mail className="h-3 w-3 mr-1 text-gray-400" />
                                      {patient.email}
                                    </div>
                                    <div className="flex items-center text-sm">
                                      <Phone className="h-3 w-3 mr-1 text-gray-400" />
                                      {patient.phone}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(patient.status)}
                                </TableCell>
                                <TableCell>
                                  {patient.assignedTherapist ? (
                                    <div className="text-sm">
                                      {patient.assignedTherapist.firstName} {patient.assignedTherapist.lastName}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-gray-400">Not assigned</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {format(new Date(patient.updatedAt), "MMM dd, yyyy")}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setLocation(`/patients/${patient.id}`)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      View
                                    </Button>
                                    {/* Only show restore button for admin/supervisor */}
                                    {(user?.role === "admin" || user?.role === "supervisor") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleRestore(patient)}
                                        disabled={restorePatientMutation.isPending}
                                      >
                                        <RotateCcw className="h-4 w-4 mr-1" />
                                        Restore
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No archived patients found
                      </h3>
                                          <p className="text-gray-500">
                      {searchQuery || statusFilter !== "all"
                        ? "Try adjusting your search or filters"
                        : "Patients marked as discharged will appear here"}
                    </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore {selectedPatient?.firstName} {selectedPatient?.lastName}? 
              This will change their status back to "active" and they will appear in the main patients list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestore}
              disabled={restorePatientMutation.isPending}
            >
              {restorePatientMutation.isPending ? "Restoring..." : "Restore Patient"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 