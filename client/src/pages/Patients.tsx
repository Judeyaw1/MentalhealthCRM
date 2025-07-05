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
  Settings,
  RefreshCw,
  Search,
  Grid3X3,
  Table,
  Trash2,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import type { PatientWithTherapist } from "@shared/schema";

export default function Patients() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [therapistFilter, setTherapistFilter] = useState("");
  const [viewMode, setViewMode] = useState<"dashboard" | "list" | "grid">("dashboard");
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
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

  const { data: patientsData, isLoading, refetch } = useQuery<{ patients: PatientWithTherapist[]; total: number }>({
    queryKey: ["/api/patients", { 
      limit: pageSize, 
      offset: (currentPage - 1) * pageSize,
      search: searchQuery || undefined,
      status: statusFilter || undefined,
      therapist: therapistFilter || undefined
    }],
    retry: false,
  });

  const { data: dashboardStats } = useQuery<{ totalPatients: number; todayAppointments: number }>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: therapists } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({ format, patientIds }: { format: string; patientIds?: number[] }) => {
      const response = await fetch(`/api/patients/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format, patientIds }),
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      return response.blob();
    },
    onSuccess: (blob, variables) => {
      // Create and download file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients-export-${new Date().toISOString().split('T')[0]}.${variables.format}`;
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
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Active</Badge>;
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
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleSelectPatient = (patientId: number, checked: boolean) => {
    if (checked) {
      setSelectedPatients([...selectedPatients, patientId]);
    } else {
      setSelectedPatients(selectedPatients.filter(id => id !== patientId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPatients(patientsData?.patients.map(p => p.id) || []);
    } else {
      setSelectedPatients([]);
    }
  };

  const handleExport = async (format: string, patientIds?: number[]) => {
    setExportLoading(true);
    try {
      await exportMutation.mutateAsync({ format, patientIds });
    } catch (error) {
      console.error('Export error:', error);
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
        handleExport('csv', selectedPatients);
        break;
      case "export-excel":
        handleExport('excel', selectedPatients);
        break;
      case "export-pdf":
        handleExport('pdf', selectedPatients);
        break;
      case "assign":
        toast({
          title: "Assign Therapist",
          description: `Assigning therapist to ${selectedPatients.length} patients...`,
        });
        break;
      case "status":
        toast({
          title: "Update Status",
          description: `Updating status for ${selectedPatients.length} patients...`,
        });
        break;
    }
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Patient data has been refreshed.",
    });
  };

  const columns = [
    {
      key: "select",
      label: "",
      render: (_: any, row: PatientWithTherapist) => (
        <Checkbox
          checked={selectedPatients.includes(row.id)}
          onCheckedChange={(checked) => handleSelectPatient(row.id, checked as boolean)}
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
              ID: #P-{row.id.toString().padStart(4, '0')} • {getAge(row.dateOfBirth)} years
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
          <span className="text-sm">{new Date(value).toLocaleDateString()}</span>
        </div>
      ),
    },
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

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Phone className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Call patient</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>More actions</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('csv', [row.id])}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('excel', [row.id])}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf', [row.id])}>
                <FileDown className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuItem>
                <User className="h-4 w-4 mr-2" />
                Assign Therapist
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Patient
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
        { value: "discharged", label: "Discharged" },
      ],
    },
    {
      key: "therapist",
      label: "Therapist",
      options: [
        { value: "all", label: "All Therapists" },
        ...(therapists?.map(t => ({ value: t.id, label: `${t.firstName} ${t.lastName}` })) || [])
      ],
    },
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
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
        <div key={patient.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary-100 text-primary-600">
                {getInitials(patient.firstName, patient.lastName)}
              </AvatarFallback>
            </Avatar>
            <Checkbox
              checked={selectedPatients.includes(patient.id)}
              onCheckedChange={(checked) => handleSelectPatient(patient.id, checked as boolean)}
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">
              {patient.firstName} {patient.lastName}
            </h3>
            <p className="text-sm text-gray-500">ID: #P-{patient.id.toString().padStart(4, '0')}</p>
            <p className="text-sm text-gray-500">{getAge(patient.dateOfBirth)} years old</p>
            
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
                    onClick={() => window.location.href = "/"}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
                    <p className="text-gray-600 mt-1">
                      Manage patient profiles and medical information.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
                    <Button
                      variant={viewMode === "dashboard" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("dashboard")}
                      className="flex items-center space-x-2"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="flex items-center space-x-2"
                    >
                      <Table className="h-4 w-4" />
                      <span>List</span>
                    </Button>
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="flex items-center space-x-2"
                    >
                      <Grid3X3 className="h-4 w-4" />
                      <span>Grid</span>
                    </Button>
                  </div>
                  
                  {/* Export All Button */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center space-x-2">
                        <Download className="h-4 w-4" />
                        <span>Export All</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        <FileText className="h-4 w-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('excel')}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Export as Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('pdf')}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                  
                  <Link href="/patients/new">
                    <Button className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>New Patient</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Content */}
            {viewMode === "dashboard" ? (
              <PatientDashboard 
                patientCount={dashboardStats?.totalPatients || 0}
                todayAppointments={dashboardStats?.todayAppointments || 0}
              />
            ) : (
              <div className="space-y-6">
                {/* Bulk Actions */}
                {selectedPatients.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium text-blue-900">
                          {selectedPatients.length} patient{selectedPatients.length !== 1 ? 's' : ''} selected
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
                              disabled={exportLoading}
                              className="flex items-center space-x-2"
                            >
                              <Download className="h-4 w-4" />
                              <span>Export Selected</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleBulkAction("export-csv")}>
                              <FileText className="h-4 w-4 mr-2" />
                              Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkAction("export-excel")}>
                              <FileSpreadsheet className="h-4 w-4 mr-2" />
                              Export as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleBulkAction("export-pdf")}>
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
                          onClick={() => handleBulkAction("status")}
                          className="flex items-center space-x-2"
                        >
                          <AlertCircle className="h-4 w-4" />
                          <span>Update Status</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Data Display */}
                {viewMode === "list" ? (
                  <DataTable
                    data={patientsData?.patients || []}
                    columns={columns}
                    totalItems={patientsData?.total || 0}
                    currentPage={currentPage}
                    pageSize={pageSize}
                    onPageChange={handlePageChange}
                    onSearch={handleSearch}
                    onFilter={handleFilter}
                    searchPlaceholder="Search patients by name, email, or phone..."
                    filters={filters}
                    isLoading={isLoading}
                    onSelectAll={handleSelectAll}
                    selectAllChecked={selectedPatients.length === (patientsData?.patients?.length || 0) && selectedPatients.length > 0}
                    onRefresh={handleRefresh}
                    onExport={() => handleExport('csv')}
                    onBulkAction={handleBulkAction}
                    selectedCount={selectedPatients.length}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showQuickActions={true}
                  />
                ) : (
                  <PatientGrid />
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <User className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Total Patients</p>
                        <p className="text-lg font-semibold text-gray-900">{patientsData?.total || 0}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Active</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {patientsData?.patients?.filter(p => p.status === "active").length || 0}
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
                        <p className="text-sm font-medium text-gray-500">Inactive</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {patientsData?.patients?.filter(p => p.status === "inactive").length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="flex items-center">
                      <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                        <User className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-500">Discharged</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {patientsData?.patients?.filter(p => p.status === "discharged").length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
