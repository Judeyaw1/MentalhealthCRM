import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PatientDashboard } from "@/components/patients/PatientDashboard";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
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
  Plus,
  Eye,
  Edit,
  LayoutDashboard,
  List,
  Filter,
  Download,
  MoreHorizontal,
  Calendar,
  Phone,
  Mail,
  User,
  Clock,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  FileDown,

  RefreshCw,
  Search,
  Grid3X3,
  Table,

  ArrowLeft,
  CheckCircle,
  XCircle,
  Star,
} from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError, canSeeCreatedBy } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { PatientWithTherapist } from "@shared/types";
import { RecentPatients } from "@/components/dashboard/RecentPatients";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function Patients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const isFrontDesk = user?.role === "frontdesk";
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [therapistFilter, setTherapistFilter] = useState("");
  const [viewMode, setViewMode] = useState<"dashboard" | "list" | "grid">(
    "list",
  );
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showRecentPatients, setShowRecentPatients] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentPatient, setAssessmentPatient] = useState<any>(null);
  const [showAssignTherapistDialog, setShowAssignTherapistDialog] = useState(false);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("");
  const [followupDate, setFollowupDate] = useState<string>("");
  const pageSize = 10;
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

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

  const {
    data: patientsData,
    isLoading,
    refetch,
  } = useQuery<{ patients: PatientWithTherapist[]; total: number }>({
    queryKey: [
      "/api/patients",
      {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        therapist: therapistFilter || undefined,
      },
    ],
    queryFn: async ({ queryKey }) => {
      const [_url, params] = queryKey as [string, Record<string, any>];
      const url = new URL(_url, window.location.origin);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== "")
          url.searchParams.append(key, value);
      });
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch patients");
      return res.json();
    },
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  const { data: dashboardStats } = useQuery<{
    totalPatients: number;
    todayAppointments: number;
  }>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  const { data: therapists } = useQuery<
    { id: string; firstName: string; lastName: string }[]
  >({
    queryKey: ["/api/therapists"],
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });



  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({
      format,
      patientIds,
    }: {
      format: string;
      patientIds?: string[];
    }) => {
      const response = await fetch(`/api/patients/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ format, patientIds }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      return response.blob();
    },
    onSuccess: (blob, variables) => {
      // Create and download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `patients-export-${new Date().toISOString().split("T")[0]}.${variables.format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Patient data exported as ${variables.format.toUpperCase()}`,
      });
      setExportLoading(false);
    },
    onError: (error) => {
      toast({
        title: "Export Failed",
        description: "Failed to export patient data. Please try again.",
        variant: "destructive",
      });
      setExportLoading(false);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
            Active
          </Badge>
        );
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

  const getAge = (dateOfBirth: string | number | Date) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  };

  const handleSelectPatient = (patientId: string, checked: boolean) => {
    if (checked) {
      setSelectedPatients([...selectedPatients, patientId]);
    } else {
      setSelectedPatients(selectedPatients.filter((id) => id !== patientId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPatients(
        patientsData?.patients.map((p) => p.id.toString()) || [],
      );
    } else {
      setSelectedPatients([]);
    }
  };

  const handleExport = async (format: string, patientIds?: string[]) => {
    setExportLoading(true);
    try {
      await exportMutation.mutateAsync({ format, patientIds });
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedPatients.length === 0) {
      toast({
        title: "No Patients Selected",
        description: "Please select patients to perform bulk actions.",
        variant: "destructive",
      });
      return;
    }

    switch (action) {
      case "export-csv":
        handleExport("csv", selectedPatients);
        break;
      case "export-excel":
        handleExport("excel", selectedPatients);
        break;
      case "export-pdf":
        handleExport("pdf", selectedPatients);
        break;
      case "assign":
        setShowAssignTherapistDialog(true);
        break;
      case "important":
        handleMarkImportant();
        break;
      case "followup":
        setShowFollowupDialog(true);
        break;
      case "status":
        toast({
          title: "Update Status",
          description: `Updating status for ${selectedPatients.length} patients...`,
        });
        break;
              case "archive":
          handleArchivePatients();
          break;
    }
  };

  const handleMarkImportant = async () => {
    try {
      const response = await fetch("/api/patients/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ patientIds: selectedPatients, updates: { important: true } }),
      });
      if (!response.ok) throw new Error("Failed to mark as important");
      toast({ title: "Marked as Important", description: `Marked ${selectedPatients.length} patient(s) as important.` });
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark as important.", variant: "destructive" });
    }
  };

  const handleAssignTherapist = async () => {
    setAssigning(true);
    try {
      const response = await fetch("/api/patients/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ patientIds: selectedPatients, updates: { assignedTherapistId: selectedTherapistId } }),
      });
      if (!response.ok) throw new Error("Failed to assign therapist");
      toast({ title: "Therapist Assigned", description: `Assigned therapist to ${selectedPatients.length} patient(s).` });
      setShowAssignTherapistDialog(false);
      setSelectedTherapistId("");
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to assign therapist.", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const handleScheduleFollowup = async () => {
    setScheduling(true);
    try {
      for (const patientId of selectedPatients) {
        await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ patientId, appointmentDate: followupDate, type: "Follow-up", status: "scheduled" }),
        });
      }
      toast({ title: "Follow-up Scheduled", description: `Scheduled follow-up for ${selectedPatients.length} patient(s).` });
      setShowFollowupDialog(false);
      setFollowupDate("");
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to schedule follow-up.", variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const handleArchivePatients = async () => {
    if (
      !confirm(
        `Are you sure you want to archive ${selectedPatients.length} patient${selectedPatients.length !== 1 ? "s" : ""}? This will move them to the archive.`,
      )
    ) {
      return;
    }

    try {
      const patientIdsToArchive = selectedPatients;
      const response = await fetch(`/api/patients/bulk-archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ patientIds: patientIdsToArchive, status: "inactive" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to archive patients");
      }

      toast({
        title: "Success",
        description: `Successfully archived ${patientIdsToArchive.length} patient${patientIdsToArchive.length !== 1 ? "s" : ""}.`,
      });

      // Refresh the patients list
      refetch();
      setSelectedPatients([]); // Clear selection after successful archiving
    } catch (error) {
      console.error("Error archiving patients:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to archive patients. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Patient data has been refreshed.",
    });
  };

  const handleArchivePatient = async (patientId: string) => {
    if (
      !confirm(
        "Are you sure you want to archive this patient? This will move them to the archive.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/patients/${patientId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "inactive" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to archive patient");
      }

      toast({
        title: "Success",
        description: "Patient archived successfully.",
      });

      // Refresh the patients list
      refetch();
    } catch (error) {
      console.error("Error archiving patient:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to archive patient. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSample = () => {
    // Sample data that matches the patient registration form
    const sampleData = [
      {
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: "1990-01-15",
        gender: "male",
        email: "john.doe@email.com",
        phone: "555-123-4567",
        emergencyContact: "555-999-8888",
        address: "123 Main Street, Anytown, ST 12345",
        insurance: "Blue Cross Blue Shield",
        reasonForVisit: "Anxiety and stress management",
        status: "active",
        hipaaConsent: "true",
        loc: "3.3",
        authNumber: "12345"
      },
      {
        firstName: "Jane",
        lastName: "Smith",
        dateOfBirth: "1985-03-22",
        gender: "female",
        email: "jane.smith@email.com",
        phone: "555-567-8901",
        emergencyContact: "555-888-7777",
        address: "456 Oak Avenue, Somewhere, ST 12345",
        insurance: "Aetna",
        reasonForVisit: "Depression treatment",
        status: "active",
        hipaaConsent: "true",
        loc: "3.3",
        authNumber: "67890"
      },
      {
        firstName: "Mike",
        lastName: "Johnson",
        dateOfBirth: "1995-07-10",
        gender: "male",
        email: "mike.j@email.com",
        phone: "555-901-2345",
        emergencyContact: "555-777-6666",
        address: "789 Pine Road, Elsewhere, ST 12345",
        insurance: "Medicare",
        reasonForVisit: "Stress management and coping skills",
        status: "active",
        hipaaConsent: "true",
        loc: "3.3",
        authNumber: "11111"
      }
    ];

    // Create CSV content
    const headers = [
      "firstName", "lastName", "dateOfBirth", "gender", "email", "phone", 
      "emergencyContact", "address", "insurance", "reasonForVisit", 
      "status", "hipaaConsent", "loc", "authNumber"
    ];
    
    const csvContent = [
      headers.join(","),
      ...sampleData.map(row => 
        headers.map(header => {
          const value = row[header as keyof typeof row];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(",")
      )
    ].join("\n");

    // Create and download the file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "patient_import_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Sample Template Downloaded",
      description: "Check your downloads folder for 'patient_import_template.csv'",
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      let rows: any[] = [];
      if (file.name.endsWith(".csv")) {
        // Parse CSV
        const text = data as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        const headers = lines[0].split(",").map(h => h.trim());
        rows = lines.slice(1).map(line => {
          // Handle CSV with commas in quoted fields
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim()); // Add the last value
          
          const obj: any = {};
          headers.forEach((h, i) => { 
            obj[h] = values[i]?.replace(/^"|"$/g, '') || ""; // Remove quotes
          });
          return obj;
        });
      } else {
        // Parse Excel
        const workbook = XLSX.read(data, { type: "binary" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet);
      }
      setImportData(rows);
    };
    if (file.name.endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const handleConfirmImport = async () => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const response = await fetch("/api/patients/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ patients: importData }),
      });
      const result = await response.json();
      setImportResult(result);
      if (response.ok) {
        const message = result.successCount > 0 
          ? `Import Successful: ${result.successCount} patients imported.`
          : "Import completed with errors.";
        toast({ title: "Import Complete", description: message });
        
        // Show detailed errors if any
        if (result.errors && result.errors.length > 0) {
          console.log("Import errors:", result.errors);
          // You could show these in a dialog or toast
        }
        
        setShowImportDialog(false);
        setImportFile(null);
        setImportData([]);
        refetch();
      } else {
        toast({ title: "Import Error", description: result.message || "Some patients could not be imported.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Import Error", description: "Failed to import patients.", variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const columns = [
    {
      key: "select",
      label: "",
      render: (_: any, row: PatientWithTherapist) => (
        <Checkbox
          checked={selectedPatients.includes(row.id as any)}
          onCheckedChange={(checked) =>
            handleSelectPatient(row.id as any, checked as boolean)
          }
        />
      ),
    },
    {
      key: "patient",
      label: "Patient",
      render: (_: any, row: PatientWithTherapist) => (
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary-100 text-primary-600">
              {getInitials(row.firstName, row.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {row.firstName} {row.lastName}
            </div>
            <div className="text-sm text-gray-500">
              ID: {row.id} • {getAge(row.dateOfBirth)} years
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      label: "Contact",
      render: (_: any, row: PatientWithTherapist) => (
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            <Mail className="h-3 w-3 text-gray-400 mr-2" />
            <span className="text-gray-900">{row.email || "No email"}</span>
          </div>
          <div className="flex items-center text-sm">
            <Phone className="h-3 w-3 text-gray-400 mr-2" />
            <span className="text-gray-600">{row.phone || "No phone"}</span>
          </div>
        </div>
      ),
    },
    {
      key: "assignedTherapist",
      label: "Therapist",
      render: (_: any, row: PatientWithTherapist) => (
        <div className="flex items-center">
          <User className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm">
            {row.assignedTherapist
              ? `${row.assignedTherapist.firstName} ${row.assignedTherapist.lastName}`
              : "Unassigned"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (value: string) => (
        <div className="flex items-center">
          <Clock className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm">
            {new Date(value).toLocaleDateString()}
          </span>
        </div>
      ),
    },
    // Only show "Created By" column for staff and admin users
    ...(canSeeCreatedBy(user)
      ? [
          {
            key: "createdBy",
            label: "Created By",
            render: (_: any, row: PatientWithTherapist) => (
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm">
                  {row.createdBy
                    ? `${row.createdBy.firstName} ${row.createdBy.lastName}`
                    : "Unknown"}
                </span>
              </div>
            ),
          },
        ]
      : []),
    {
      key: "actions",
      label: "Actions",
      render: (_: any, row: PatientWithTherapist) => (
        <div className="flex items-center space-x-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/patients/${row.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>View patient details</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/patients/${row.id}/edit`}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Edit patient</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/appointments/new?patientId=${row.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>Schedule appointment</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>



          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAssessmentPatient(row); setShowAssessment(true); }}
          >
            Assess
          </Button>
        </div>
      ),
    },
  ];

  const filters = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ],
    },
    {
      key: "therapist",
      label: "Therapist",
      options: [
        { value: "all", label: "All Therapists" },
        ...(therapists?.map((t) => ({
          value: t.id,
          label: `${t.firstName} ${t.lastName}`,
        })) || []),
      ],
    },
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
    console.log("DataTable search input:", query);
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleFilter = (filter: { key: string; value: string }) => {
    if (filter.key === "status") {
      setStatusFilter(filter.value === "all" ? "" : filter.value);
      setCurrentPage(1);
    } else if (filter.key === "therapist") {
      setTherapistFilter(filter.value === "all" ? "" : filter.value);
      setCurrentPage(1);
    }
  };

  // Grid view component
  const PatientGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {patientsData?.patients.map((patient) => (
        <div
          key={patient.id}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary-100 text-primary-600">
                {getInitials(patient.firstName, patient.lastName)}
              </AvatarFallback>
            </Avatar>
            <Checkbox
              checked={selectedPatients.includes(patient.id as any)}
              onCheckedChange={(checked) =>
                handleSelectPatient(patient.id as any, checked as boolean)
              }
            />
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-sm text-gray-500">
              ID: {patient.id} • {getAge(patient.dateOfBirth)} years old
            </p>

            <div className="space-y-1">
              {patient.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-3 w-3 mr-2" />
                  <span className="truncate">{patient.email}</span>
                </div>
              )}
              {patient.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-3 w-3 mr-2" />
                  <span>{patient.phone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              {getStatusBadge(patient.status)}
              <div className="flex space-x-1">
                <Link href={`/patients/${patient.id}`}>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href={`/patients/${patient.id}/edit`}>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  console.log("User:", user, "Role:", user?.role, "isFrontDesk:", isFrontDesk);
  console.log("ViewMode:", viewMode);
  console.log(
    "Patients data:",
    patientsData?.patients?.length || 0,
    "patients",
  );
  console.log(
    "RecentPatients should show:",
    isFrontDesk && viewMode === "dashboard",
  );

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
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Patients
                </h1>
                <p className="text-gray-600 mt-1">
                  Manage patient profiles and medical information.
                </p>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Link href="/patients/new">
                  <Button variant="default">
                    <Plus className="h-4 w-4 mr-2" /> New Patient
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                  <Download className="h-4 w-4 mr-2" /> Import
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {/* Quick Stats - Now at the TOP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">
                        Total Patients
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {patientsData?.total || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">
                        Active
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {patientsData?.patients?.filter(
                          (p) => p.status === "active",
                        ).length || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-500">
                        Inactive
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {patientsData?.patients?.filter(
                          (p) => p.status === "inactive",
                        ).length || 0}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedPatients.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm font-medium text-blue-900">
                        {selectedPatients.length} patient
                        {selectedPatients.length !== 1 ? "s" : ""} selected
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPatients([])}
                      >
                        Clear Selection
                      </Button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBulkAction("export-csv")}
                            className="flex items-center space-x-2"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Export Selected</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleBulkAction("export-csv")}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Export as CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleBulkAction("export-excel")}
                          >
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Export as Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleBulkAction("export-pdf")}
                          >
                            <FileDown className="h-4 w-4 mr-2" />
                            Export as PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction("assign")}
                        className="flex items-center space-x-2"
                      >
                        <User className="h-4 w-4" />
                        <span>Assign Therapist</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction("important")}
                        className="flex items-center space-x-2"
                      >
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span>Mark as Important</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBulkAction("followup")}
                        className="flex items-center space-x-2"
                      >
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>Schedule Follow-up</span>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Cards/List */}
              <div id="patients-list-section">
                {viewMode === "list" ? (
                  <>
                    <DataTable
                      data={patientsData?.patients || []}
                      columns={columns}
                      totalItems={patientsData?.total || 0}
                      currentPage={currentPage}
                      pageSize={pageSize}
                      onPageChange={handlePageChange}
                      onFilter={handleFilter}
                      filters={filters}
                      isLoading={isLoading}
                      onSelectAll={handleSelectAll}
                      selectAllChecked={
                        selectedPatients.length ===
                          (patientsData?.patients?.length || 0) &&
                        selectedPatients.length > 0
                      }
                      onRefresh={handleRefresh}
                      onExport={() => handleExport("csv")}
                      onBulkAction={handleBulkAction}
                      selectedCount={selectedPatients.length}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                      showQuickActions={true}
                      onSearch={handleSearch}
                      searchPlaceholder="Search patients by name, email, or phone..."
                    />
                    {!isLoading && patientsData?.patients?.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <div className="text-lg mb-2">
                          {searchQuery ? `No patients found matching "${searchQuery}"` : "No patients found."}
                        </div>
                        {searchQuery && (
                          <div className="text-sm text-gray-400">
                            Try searching by name, email, or phone. You can also try partial matches.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <PatientGrid />
                    {!isLoading && patientsData?.patients?.length === 0 && (
                      <div className="text-center text-gray-500 py-8 text-lg">
                        No patients found.
                      </div>
                    )}
                  </>
                )}
              </div>


            </div>
          </div>
        </main>
      </div>
      <Dialog open={showAssessment} onOpenChange={setShowAssessment}>
        <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>New Patient Assessment</DialogTitle>
          </DialogHeader>
          {assessmentPatient && (
            <form className="space-y-4">
              <div>
                <strong>Patient:</strong> {assessmentPatient.firstName} {assessmentPatient.lastName}
              </div>
              <div>
                <label className="block font-medium">Presenting Problem</label>
                <Textarea required />
              </div>
              <div>
                <label className="block font-medium">Medical History</label>
                <Textarea />
              </div>
              <div>
                <label className="block font-medium">Psychiatric History</label>
                <Textarea />
              </div>
              <div>
                <label className="block font-medium">Family History</label>
                <Textarea />
              </div>
              <div>
                <label className="block font-medium">Social History</label>
                <Textarea />
              </div>
              <div>
                <label className="block font-medium">Mental Status Exam</label>
                <Textarea />
              </div>
              <div>
                <label className="block font-medium">Risk Assessment</label>
                <Textarea />
              </div>
              <div>
                <label className="block font-medium">Diagnosis</label>
                <Input />
              </div>
              <div>
                <label className="block font-medium">Initial Impressions & Recommendations</label>
                <Textarea required />
              </div>
              <div>
                <label className="block font-medium">Follow-Up Date</label>
                <Input type="date" />
              </div>
              <div>
                <label className="block font-medium">Follow-Up Notes</label>
                <Textarea />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Save Assessment</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={showAssignTherapistDialog} onOpenChange={setShowAssignTherapistDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Therapist to Selected Patients</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block font-medium">Select Therapist</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md"
                value={selectedTherapistId}
                onChange={(e) => setSelectedTherapistId(e.target.value)}
              >
                <option value="">Select a therapist</option>
                {therapists?.map((therapist) => (
                  <option key={therapist.id} value={therapist.id}>
                    {therapist.firstName} {therapist.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowAssignTherapistDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAssignTherapist}
                disabled={!selectedTherapistId || assigning}
              >
                {assigning ? "Assigning..." : "Assign Therapist"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showFollowupDialog} onOpenChange={setShowFollowupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Follow-up for Selected Patients</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block font-medium">Follow-up Date</label>
              <input
                type="date"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFollowupDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleScheduleFollowup}
                disabled={!followupDate || scheduling}
              >
                {scheduling ? "Scheduling..." : "Schedule Follow-up"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Patients (CSV or Excel)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Sample Template Download */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Need help with the format?</p>
                  <p className="text-xs text-blue-700">Download a sample template to see the correct arrangement</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSample}
                className="text-blue-600 border-blue-300 hover:bg-blue-100"
              >
                Download Sample
              </Button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select File (CSV or Excel)
              </label>
              <input
                type="file"
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleImportFile}
                disabled={importLoading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500">
                Required fields: firstName, lastName, dateOfBirth. All other fields are optional.
              </p>
            </div>
            {importData.length > 0 && (
              <div className="max-h-64 overflow-auto border rounded p-2 bg-gray-50">
                <div className="mb-2 font-semibold">Preview ({importData.length} rows):</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-full">
                    <thead>
                      <tr>
                        {Object.keys(importData[0]).map((h) => (
                          <th key={h} className="border-b px-2 py-1 text-left whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importData.slice(0, 10).map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="border-b px-2 py-1 whitespace-nowrap max-w-xs truncate" title={v as string}>
                              {v as string}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importData.length > 10 && <div className="text-gray-400 mt-1">...and {importData.length - 10} more rows</div>}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={importLoading}>Cancel</Button>
              <Button onClick={handleConfirmImport} disabled={importLoading || !importData.length}>
                {importLoading ? "Importing..." : "Import Patients"}
              </Button>
            </div>
            {importResult && (
              <div className="mt-2 text-sm">
                <div className={importResult.successCount ? "text-green-700" : "text-red-700"}>
                  {importResult.message}
                </div>
                {importResult.errors && importResult.errors.length > 0 && (
                  <ul className="mt-1 text-red-600 list-disc list-inside">
                    {importResult.errors.map((err: any, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


    </div>
  );
}
