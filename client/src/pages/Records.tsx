import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { RecordHistoryDialog } from "@/components/records/RecordHistoryDialog";
import { PatientDetailsDialog } from "@/components/patients/PatientDetailsDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  FileText,
  Clock,
  Search,
  Filter,
  Calendar,
  User,
  Edit,
  Eye,
  Download,
  RefreshCw,
  MoreHorizontal,
  TrendingUp,
  Target,
  MessageSquare,
  ArrowLeft,
  Printer,
  Copy,
  History,
  AlertTriangle,
} from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { TreatmentRecordWithDetails } from "@shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export default function Records() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("all");
  const [selectedTherapist, setSelectedTherapist] = useState("all");
  const [selectedSessionType, setSelectedSessionType] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const pageSize = 20;

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

  // Get appointmentId from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const appointmentIdFromUrl = urlParams.get("appointmentId");

  // Fetch appointment details if appointmentId is provided
  const { data: appointmentDetails } = useQuery({
    queryKey: ["/api/appointments", appointmentIdFromUrl],
    queryFn: async () => {
      if (!appointmentIdFromUrl) return null;
      const response = await fetch(`/api/appointments/${appointmentIdFromUrl}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!appointmentIdFromUrl,
    retry: false,
  });

  // Fetch records with filters
  const {
    data: recordsData,
    isLoading: recordsLoading,
    refetch,
  } = useQuery<{ records: TreatmentRecordWithDetails[]; total: number } | { records: TreatmentRecordWithDetails[]; total?: number }>({
    queryKey: [
      appointmentIdFromUrl && appointmentDetails?.patient?.id
        ? `/api/patients/${appointmentDetails.patient.id}/records`
        : "/api/records",
      {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: searchQuery || undefined,
        patientId:
          appointmentIdFromUrl && appointmentDetails?.patient?.id
            ? undefined // handled by endpoint
            : (selectedPatient && selectedPatient !== "all"
                ? selectedPatient
                : undefined),
        therapistId:
          selectedTherapist && selectedTherapist !== "all"
            ? selectedTherapist
            : undefined,
        sessionType:
          selectedSessionType && selectedSessionType !== "all"
            ? selectedSessionType
            : undefined,
        startDate:
          appointmentDetails?.appointmentDate 
            ? new Date(appointmentDetails.appointmentDate) // Use appointment date as start
            : dateRange === "week"
              ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              : dateRange === "month"
                ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                : undefined,
        endDate: undefined,
      },
    ],
    queryFn: async (context) => {
      const [endpoint, params] = context.queryKey as Readonly<[string, any]>;
      let url = endpoint;
      if (endpoint.startsWith("/api/records")) {
        const searchParams = new URLSearchParams();
        if (params.limit) searchParams.set("limit", params.limit);
        if (params.offset) searchParams.set("offset", params.offset);
        if (params.search) searchParams.set("search", params.search);
        if (params.patientId) searchParams.set("patientId", params.patientId);
        if (params.therapistId) searchParams.set("therapistId", params.therapistId);
        if (params.sessionType) searchParams.set("sessionType", params.sessionType);
        if (params.startDate) searchParams.set("startDate", new Date(params.startDate).toISOString());
        if (params.endDate) searchParams.set("endDate", new Date(params.endDate).toISOString());
        if (Array.from(searchParams).length > 0) url += `?${searchParams.toString()}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch records");
        return response.json();
      } else if (endpoint.startsWith("/api/patients/")) {
        // Only fetch for the patient, ignore other filters
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch patient records");
        const records = await response.json();
        return { records, total: records.length };
      }
      return { records: [], total: 0 };
    },
    retry: false,
    enabled: !appointmentIdFromUrl || !!appointmentDetails, // Wait for appointment details if appointmentId is provided
  });

  // Debug logging
  useEffect(() => {
    if (recordsData) {
      console.log('🔍 Records query result:', {
        appointmentIdFromUrl,
        appointmentDetails: appointmentDetails ? {
          patientId: appointmentDetails.patient?.id,
          patientName: `${appointmentDetails.patient?.firstName} ${appointmentDetails.patient?.lastName}`,
          appointmentDate: appointmentDetails.appointmentDate
        } : null,
        recordsCount: recordsData?.records?.length || 0,
        firstRecord: recordsData?.records?.[0] ? {
          patientId: recordsData.records[0].patient?.id,
          patientName: `${recordsData.records[0].patient?.firstName} ${recordsData.records[0].patient?.lastName}`,
          sessionDate: recordsData.records[0].sessionDate
        } : null
      });
    }
  }, [recordsData, appointmentDetails, appointmentIdFromUrl]);

  // Fetch patients for filter
  const { data: patients } = useQuery<{
    patients: { id: number; firstName: string; lastName: string }[];
    total: number;
  }>({
    queryKey: ["/api/patients", { limit: 1000 }],
    retry: false,
  });

  // Fetch therapists for filter
  const { data: therapists } = useQuery<
    { id: string; firstName: string; lastName: string }[]
  >({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  // Delete record mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const response = await apiRequest("DELETE", `/api/records/${recordId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast({
        title: "Success",
        description: "Treatment record deleted successfully.",
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
        description: "Failed to delete treatment record. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getSessionTypeBadge = (sessionType: string) => {
    const variants = {
      therapy: "bg-blue-100 text-blue-800",
      group: "bg-green-100 text-green-800",
      family: "bg-purple-100 text-purple-800",
      assessment: "bg-orange-100 text-orange-800",
      consultation: "bg-indigo-100 text-indigo-800",
      intake: "bg-red-100 text-red-800",
    };

    return (
      <Badge
        className={`text-xs ${variants[sessionType as keyof typeof variants] || "bg-gray-100 text-gray-800"}`}
      >
        {sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}
      </Badge>
    );
  };

  const handleDeleteRecord = (recordId: string) => {
    setDeleteRecordId(recordId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRecord = async () => {
    if (!deleteRecordId) return;
    
    try {
      await deleteRecordMutation.mutateAsync(deleteRecordId);
      setIsDeleteDialogOpen(false);
      setDeleteRecordId(null);
    } catch (error) {
      console.error("Error deleting record:", error);
    }
  };

  const handleDownloadRecord = async (record: TreatmentRecordWithDetails) => {
    try {
      const recordData = {
        patient: `${record.patient.firstName} ${record.patient.lastName}`,
        therapist: record.therapist ? `${record.therapist.firstName} ${record.therapist.lastName}` : "Unknown",
        sessionDate: formatDateTime(record.sessionDate),
        sessionType: record.sessionType,
        goals: record.goals || "N/A",
        notes: record.notes || "N/A",
        progress: record.progress || "N/A",
        planForNextSession: record.planForNextSession || "N/A",
        interventions: record.interventions || "N/A",
      };

      const blob = new Blob([JSON.stringify(recordData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `treatment-record-${record.patient.firstName}-${record.patient.lastName}-${formatDate(record.sessionDate)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log the download action
      await fetch(`/api/records/${record.id}`, { method: 'GET' }); // This will log the view action
      
      toast({
        title: "Record Downloaded",
        description: "Treatment record has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the treatment record.",
        variant: "destructive",
      });
    }
  };

  const handlePrintRecord = async (record: TreatmentRecordWithDetails) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Print Failed",
        description: "Please allow pop-ups to print records.",
        variant: "destructive",
      });
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Treatment Record - ${record.patient.firstName} ${record.patient.lastName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .section { margin-bottom: 20px; }
            .section h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .label { font-weight: bold; color: #555; }
            .value { margin-bottom: 10px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Treatment Record</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="section">
            <h3>Patient Information</h3>
            <div class="label">Patient Name:</div>
            <div class="value">${record.patient.firstName} ${record.patient.lastName}</div>
            
            <div class="label">Therapist:</div>
            <div class="value">${record.therapist ? `${record.therapist.firstName} ${record.therapist.lastName}` : "Unknown"}</div>
            
            <div class="label">Session Date:</div>
            <div class="value">${formatDateTime(record.sessionDate)}</div>
            
            <div class="label">Session Type:</div>
            <div class="value">${record.sessionType}</div>
          </div>
          
          ${record.goals ? `
          <div class="section">
            <h3>Session Goals</h3>
            <div class="value">${record.goals}</div>
          </div>
          ` : ''}
          
          ${record.notes ? `
          <div class="section">
            <h3>Session Notes</h3>
            <div class="value">${record.notes}</div>
          </div>
          ` : ''}
          
          ${record.progress ? `
          <div class="section">
            <h3>Progress</h3>
            <div class="value">${record.progress}</div>
          </div>
          ` : ''}
          
          ${record.interventions ? `
          <div class="section">
            <h3>Interventions</h3>
            <div class="value">${record.interventions}</div>
          </div>
          ` : ''}
          
          ${record.planForNextSession ? `
          <div class="section">
            <h3>Plan for Next Session</h3>
            <div class="value">${record.planForNextSession}</div>
          </div>
          ` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();

    // Log the print action
    await fetch(`/api/records/${record.id}`, { method: 'GET' }); // This will log the view action

    toast({
      title: "Print Initiated",
      description: "Print dialog has been opened for the treatment record.",
    });
  };

  const handleCopyRecordId = (recordId: string) => {
    navigator.clipboard.writeText(recordId);
    toast({
      title: "Record ID Copied",
      description: "Record ID has been copied to clipboard.",
    });
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Treatment records updated.",
    });
  };

  const handleExport = async () => {
    try {
      // Show loading toast
      toast({
        title: "Exporting...",
        description: "Preparing your export file.",
      });

      // Get current filter values
      const exportData = {
        format: "csv", // Default to CSV
        patientIds: selectedPatient !== "all" ? [selectedPatient] : undefined,
        startDate: dateRange === "week" 
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          : dateRange === "month"
            ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            : undefined,
        endDate: undefined,
        sessionType: selectedSessionType !== "all" ? selectedSessionType : undefined
      };

      // Make the export request
      const response = await fetch("/api/records/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get("Content-Disposition");
      const filename = contentDisposition
        ? contentDisposition.split("filename=")[1]?.replace(/"/g, "")
        : "treatment-records-export.csv";

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Your treatment records have been exported.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export treatment records. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil((recordsData?.total || 0) / pageSize);

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
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (window.location.href = "/dashboard")}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                      {appointmentDetails 
                        ? `Treatment Records - ${appointmentDetails.patient?.firstName} ${appointmentDetails.patient?.lastName}`
                        : "Treatment Records"
                      }
                    </h1>
                    <p className="text-gray-600 mt-1">
                      {appointmentDetails 
                        ? `Viewing treatment records for appointment on ${formatDate(appointmentDetails.appointmentDate)}`
                        : "View and manage patient treatment documentation and progress tracking."
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleRefresh}
                          disabled={recordsLoading}
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${recordsLoading ? "animate-spin" : ""}`}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Refresh records</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleExport}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Export records</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Link href="/records/new">
                    <Button className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>New Record</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Records
                  </CardTitle>
                  <FileText className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading ? "..." : recordsData?.total || 0}
                  </div>
                  <p className="text-xs text-gray-600">All treatment records</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    This Week
                  </CardTitle>
                  <Clock className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading
                      ? "..."
                      : recordsData?.records?.filter(
                          (record: TreatmentRecordWithDetails) => {
                            const recordDate = new Date(record.sessionDate);
                            const weekAgo = new Date();
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            return recordDate >= weekAgo;
                          },
                        ).length || 0}
                  </div>
                  <p className="text-xs text-gray-600">Recent records</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Patients
                  </CardTitle>
                  <User className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading
                      ? "..."
                      : new Set(
                          recordsData?.records?.map(
                            (record: TreatmentRecordWithDetails) =>
                              record.patient.id,
                          ),
                        ).size || 0}
                  </div>
                  <p className="text-xs text-gray-600">With records</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg. Sessions
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading
                      ? "..."
                      : recordsData?.total && recordsData.records
                        ? Math.round(
                            recordsData.total /
                              new Set(
                                recordsData.records.map(
                                  (record: TreatmentRecordWithDetails) =>
                                    record.patient.id,
                                ),
                              ).size,
                          )
                        : 0}
                  </div>
                  <p className="text-xs text-gray-600">Per patient</p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by patient name, session type, or notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select
                    value={selectedPatient}
                    onValueChange={setSelectedPatient}
                  >
                    <SelectTrigger className="w-full lg:w-[200px]">
                      <SelectValue placeholder="Filter by patient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Patients</SelectItem>
                      {patients?.patients?.map((patient) => (
                        <SelectItem
                          key={patient.id}
                          value={patient.id.toString()}
                        >
                          {patient.firstName} {patient.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedTherapist}
                    onValueChange={setSelectedTherapist}
                  >
                    <SelectTrigger className="w-full lg:w-[200px]">
                      <SelectValue placeholder="Filter by therapist" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Therapists</SelectItem>
                      {therapists?.map((therapist) => (
                        <SelectItem key={therapist.id} value={therapist.id}>
                          {therapist.firstName} {therapist.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={selectedSessionType}
                    onValueChange={setSelectedSessionType}
                  >
                    <SelectTrigger className="w-full lg:w-[200px]">
                      <SelectValue placeholder="Filter by session type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Session Types</SelectItem>
                      <SelectItem value="therapy">
                        Individual Therapy
                      </SelectItem>
                      <SelectItem value="group">Group Therapy</SelectItem>
                      <SelectItem value="family">Family Therapy</SelectItem>
                      <SelectItem value="assessment">Assessment</SelectItem>
                      <SelectItem value="consultation">Consultation</SelectItem>
                      <SelectItem value="intake">Initial Intake</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-full lg:w-[150px]">
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="week">Last Week</SelectItem>
                      <SelectItem value="month">Last Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Records List */}
            <div className="space-y-4">
              {recordsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          <div className="h-20 bg-gray-200 rounded"></div>
                        </div>
                        <div className="h-6 bg-gray-200 rounded w-20"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (recordsData?.records?.length ?? 0) > 0 ? (
                <>
                  {(recordsData?.records ?? []).map(
                    (record: TreatmentRecordWithDetails) => (
                      <Card
                        key={record.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start space-x-4">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary-100 text-primary-600">
                                {getInitials(
                                  record.patient.firstName,
                                  record.patient.lastName,
                                )}
                              </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div>
                                    <h3 className="text-lg font-medium text-gray-900">
                                      {record.patient.firstName}{" "}
                                      {record.patient.lastName}
                                    </h3>
                                    <div className="flex items-center space-x-2 mt-1">
                                      {getSessionTypeBadge(record.sessionType)}
                                      <span className="text-sm text-gray-500">
                                        {formatDateTime(record.sessionDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {record.therapist
                                      ? `${record.therapist.firstName} ${record.therapist.lastName}`
                                      : "Unknown Therapist"}
                                  </Badge>

                                                                    <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button 
                                              variant="ghost" 
                                              size="icon"
                                              aria-label="More options"
                                              className="h-8 w-8"
                                            >
                                              <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-56">
                                      {/* Primary Actions */}
                                      <DropdownMenuItem
                                        asChild
                                      >
                                        <Link
                                          href={`/patients/${typeof record.patient === 'object' ? (record.patient.id || record.patient._id) : record.patient}`}
                                          className="flex items-center"
                                        >
                                          <Eye className="h-4 w-4 mr-2" />
                                          View Patient
                                        </Link>
                                      </DropdownMenuItem>
                                      <DropdownMenuItem asChild>
                                        <Link
                                          href={`/records/${record.id}/edit`}
                                          className="flex items-center"
                                        >
                                          <Edit className="h-4 w-4 mr-2" />
                                          Edit Record
                                        </Link>
                                      </DropdownMenuItem>
                                      
                                      <DropdownMenuSeparator />
                                      
                                      {/* Export Actions */}
                                      <DropdownMenuItem
                                        onClick={() => handleDownloadRecord(record)}
                                        className="flex items-center"
                                      >
                                        <Download className="h-4 w-4 mr-2" />
                                        Download Record
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handlePrintRecord(record)}
                                        className="flex items-center"
                                      >
                                        <Printer className="h-4 w-4 mr-2" />
                                        Print Record
                                      </DropdownMenuItem>
                                      
                                      <DropdownMenuSeparator />
                                      
                                      {/* Utility Actions */}
                                      <DropdownMenuItem
                                        onClick={() => handleCopyRecordId(record.id)}
                                        className="flex items-center"
                                      >
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copy Record ID
                                      </DropdownMenuItem>
                                      
                                      <DropdownMenuSeparator />
                                      
                                      {/* Destructive Actions */}
                                      <DropdownMenuItem
                                        onClick={() => handleDeleteRecord(record.id)}
                                        className="flex items-center text-red-600 focus:text-red-600 focus:bg-red-50"
                                      >
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        Delete Record
                                      </DropdownMenuItem>
                                                                            </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>More options</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {record.goals && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                                      <Target className="h-3 w-3 mr-1" />
                                      Session Goals
                                    </h4>
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                      {record.goals}
                                    </p>
                                  </div>
                                )}

                                {record.notes && (
                                  <div>
                                    <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                                      <MessageSquare className="h-3 w-3 mr-1" />
                                      Session Notes
                                    </h4>
                                    <p className="text-sm text-gray-600 line-clamp-3">
                                      {record.notes}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {(record.progress ||
                                record.planForNextSession) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  {record.progress && (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-1">
                                        Progress
                                      </h4>
                                      <p className="text-sm text-gray-600 line-clamp-2">
                                        {record.progress}
                                      </p>
                                    </div>
                                  )}

                                  {record.planForNextSession && (
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-1">
                                        Next Session Plan
                                      </h4>
                                      <p className="text-sm text-gray-600 line-clamp-2">
                                        {record.planForNextSession}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ),
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-600">
                        Showing {(currentPage - 1) * pageSize + 1} to{" "}
                        {Math.min(currentPage * pageSize, recordsData?.total ?? 0)} of{" "}
                        {recordsData?.total ?? 0} records
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Treatment Records Found
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {searchQuery ||
                      selectedPatient ||
                      selectedTherapist ||
                      selectedSessionType
                        ? "No records match your current filters."
                        : "Start documenting patient sessions by creating your first treatment record."}
                    </p>
                    <Link href="/records/new">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Record
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              treatment record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRecord}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
