// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Calendar,
  Clock,
  Eye,
  Edit,
  ArrowLeft,
  CheckCircle,
  XCircle,
  FileText,
  MoreHorizontal,
  Search,
  Filter,
  RefreshCw,
  Download,
  Settings,
  Grid3X3,
  List,
  Bell,
  Trash2,
  User,
  Phone,
  Mail,
  CalendarDays,
  MapPin,
  Stethoscope,
  ClipboardList,
} from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { AppointmentWithDetails } from "@shared/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PatientDetailsDialog } from "@/components/patients/PatientDetailsDialog";

export default function Appointments() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showPatientDialog, setShowPatientDialog] = useState(false);

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

  // Get date range for filtering
  const getDateRange = () => {
    if (!dateFilter || dateFilter === "all") return {};

    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (dateFilter) {
      case "today":
        startDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        );
        endDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
        );
        break;
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate(),
        );
        endDate = new Date(
          weekStart.getFullYear(),
          weekStart.getMonth(),
          weekStart.getDate() + 7,
        );
        break;
      case "month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        break;
      default:
        return {};
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const { data: appointments, isLoading } = useQuery({
    queryKey: [
      "/api/appointments",
      {
        ...getDateRange(),
        status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
      },
    ],
    queryFn: async ({ queryKey }) => {
      const [url, params] = queryKey;
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, value);
      });
      const res = await fetch(`${url}?${searchParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active

  });

  const { data: todayAppointments, isLoading: todayLoading } = useQuery({
    queryKey: ["/api/dashboard/today-appointments"],
    retry: false,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  // Real-time socket connection for instant updates
  useSocket({
    onAppointmentCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onAppointmentUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onAppointmentDeleted: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/today-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Scheduled
        </Badge>;
      case "completed":
        return (
          <Badge className="bg-success-100 text-success-500 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </Badge>
        );
      case "cancelled":
        return <Badge className="bg-error-100 text-error-500 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Cancelled
        </Badge>;
      case "no-show":
        return (
          <Badge className="bg-warning-100 text-warning-500 flex items-center gap-1">
            <User className="h-3 w-3" />
            No Show
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase() || "?";
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

  const columns = [
    {
      key: "patient",
      label: "Patient",
      render: (_, row: AppointmentWithDetails) => (
        <div className="flex items-center">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-100 text-primary-600 text-xs">
              {getInitials(
                row.patient?.firstName || "",
                row.patient?.lastName || "",
              )}
            </AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">
              {row.patient?.firstName || "Unknown"}{" "}
              {row.patient?.lastName || "Patient"}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {row.patient?.email || "No email"}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {row.patient?.phone || "No phone"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "therapist",
      label: "Therapist",
      render: (_, row: AppointmentWithDetails) => (
        <div className="flex items-center">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
              {getInitials(
                row.therapist?.firstName || "",
                row.therapist?.lastName || "",
              )}
            </AvatarFallback>
          </Avatar>
          <div className="ml-2">
            <div className="text-sm font-medium text-gray-900">
              {row.therapist?.firstName || "Unknown"}{" "}
              {row.therapist?.lastName || "Therapist"}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Stethoscope className="h-3 w-3" />
              {row.therapist?.role || "Therapist"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "appointmentDate",
      label: "Date & Time",
      render: (_, row: AppointmentWithDetails) => (
        <div className="flex items-center">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-gray-500" />
            <div>
              <div className="text-sm font-medium text-gray-900">
                {formatDateTime(row.appointmentDate)}
              </div>
              <div className="text-xs text-gray-500">
                Duration: {row.duration || "60"} min
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "sessionType",
      label: "Session Type",
      render: (_, row: AppointmentWithDetails) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-sm text-gray-900">
            {row.sessionType || "General"}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_, row: AppointmentWithDetails) => getStatusBadge(row.status),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row: AppointmentWithDetails) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => {
              setSelectedPatientId(row.patient?.id);
              setShowPatientDialog(true);
            }}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleReschedule(row.id)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit/Reschedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleViewRecord(row.id)}>
              <FileText className="h-4 w-4 mr-2" />
              View Records
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleAddTreatmentRecord(row)}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Add Treatment Record
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSendReminder(row.id)}>
              <Bell className="h-4 w-4 mr-2" />
              Send Reminder
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleStatusChange(row.id, "completed")}
              className="text-green-600"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Complete
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleStatusChange(row.id, "cancelled")}
              className="text-red-600"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleDelete(row.id)}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "scheduled", label: "Scheduled" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
        { value: "no-show", label: "No Show" },
      ],
    },
    {
      key: "date",
      label: "Time Period",
      options: [
        { value: "all", label: "All Dates" },
        { value: "today", label: "Today" },
        { value: "week", label: "This Week" },
        { value: "month", label: "This Month" },
      ],
    },
  ];

  const handleFilter = (filter: { key: string; value: string }) => {
    if (filter.key === "status") {
      setStatusFilter(filter.value);
    } else if (filter.key === "date") {
      setDateFilter(filter.value);
    }
    setCurrentPage(1);
  };

  // Action handlers
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      newStatus,
    }: {
      appointmentId: string;
      newStatus: string;
    }) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update appointment status");
      }

      return response.json();
    },
    onSuccess: (_, { newStatus }) => {
      toast({
        title: "Success",
        description: `Appointment ${newStatus} successfully`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/today-appointments"],
        exact: false,
      });
    },
    onError: (error) => {
      console.error("Error updating appointment status:", error);
      toast({
        title: "Error",
        description: "Failed to update appointment status",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete appointment");
      }

      return response.json();
    },
    onMutate: async (appointmentId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });

      // Snapshot the previous value
      const previousAppointments = queryClient.getQueryData([
        "/api/appointments",
        {
          ...getDateRange(),
          status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
        },
      ]);

      // Optimistically update to remove the appointment
      queryClient.setQueryData(
        [
          "/api/appointments",
          {
            ...getDateRange(),
            status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
          },
        ],
        (old: any) => {
          if (!old) return old;
          return old.filter((apt: any) => apt.id !== appointmentId);
        },
      );

      // Return a context object with the snapshotted value
      return { previousAppointments };
    },
    onError: (err, appointmentId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousAppointments) {
        queryClient.setQueryData(
          [
            "/api/appointments",
            {
              ...getDateRange(),
              status: statusFilter && statusFilter !== "all" ? statusFilter : undefined,
            },
          ],
          context.previousAppointments,
        );
      }
      console.error("Error deleting appointment:", err);
      toast({
        title: "Error",
        description: "Failed to delete appointment",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment deleted successfully",
      });
      // Invalidate all appointment-related queries
      queryClient.invalidateQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/today-appointments"],
        exact: false,
      });
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await fetch(
        `/api/appointments/${appointmentId}/reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to send reminder");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Reminder sent successfully",
      });
    },
    onError: (error) => {
      console.error("Error sending reminder:", error);
      toast({
        title: "Error",
        description: "Failed to send reminder",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (appointmentId: string, newStatus: string) => {
    // Find the appointment to check its current status
    const appointment = appointments?.find(apt => apt.id === appointmentId);
    
    if (!appointment) {
      toast({
        title: "Error",
        description: "Appointment not found",
        variant: "destructive",
      });
      return;
    }

    // Prevent cancelling completed appointments
    if (newStatus === "cancelled" && appointment.status === "completed") {
      toast({
        title: "Cannot Cancel",
        description: "Completed appointments cannot be cancelled",
        variant: "destructive",
      });
      return;
    }

    // Prevent marking cancelled appointments as completed
    if (newStatus === "completed" && appointment.status === "cancelled") {
      toast({
        title: "Cannot Complete",
        description: "Cancelled appointments cannot be marked as completed",
        variant: "destructive",
      });
      return;
    }

    updateStatusMutation.mutate({ appointmentId, newStatus });
  };

  const handleViewRecord = (appointmentId: string) => {
    // Navigate to treatment records page with filter for this appointment
    setLocation(`/records?appointmentId=${appointmentId}`);
  };

  const handleReschedule = (appointmentId: string) => {
    // Navigate to edit appointment page
    setLocation(`/appointments/${appointmentId}/edit?reschedule=true`);
  };

  const handleSendReminder = (appointmentId: string) => {
    sendReminderMutation.mutate(appointmentId);
  };

  const handleDelete = (appointmentId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this appointment? This action cannot be undone.",
      )
    ) {
      return;
    }
    deleteMutation.mutate(appointmentId);
  };

  const handleAddTreatmentRecord = (appointment: AppointmentWithDetails) => {
    // Navigate to new record page with pre-filled data from appointment
    const recordData = {
      patientId: appointment.patient?.id,
      therapistId: appointment.therapist?.id,
      sessionDate: new Date(appointment.appointmentDate).getTime(),
      sessionType: appointment.type,
      notes: `Treatment record for appointment on ${formatDateTime(appointment.appointmentDate)}`,
    };
    
    // Store the data in sessionStorage for the new record form
    sessionStorage.setItem('prefilledRecordData', JSON.stringify(recordData));
    
    // Navigate to new record page
    setLocation('/records/new');
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/appointments"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/dashboard/today-appointments"],
      exact: false,
    });
  };

  const handleExport = () => {
    if (!appointments || appointments.length === 0) {
      toast({
        title: "No Data",
        description: "No appointments to export",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for export
    const exportData = appointments.map((apt: any) => ({
      "Appointment ID": apt.id,
      "Patient Name": `${apt.patient?.firstName || ""} ${apt.patient?.lastName || ""}`.trim(),
      "Patient Email": apt.patient?.email || "",
      "Patient Phone": apt.patient?.phone || "",
      "Therapist": `${apt.therapist?.firstName || ""} ${apt.therapist?.lastName || ""}`.trim(),
      "Type": apt.type,
      "Status": apt.status,
      "Date": new Date(apt.appointmentDate).toLocaleDateString(),
      "Time": new Date(apt.appointmentDate).toLocaleTimeString(),
      "Duration": `${apt.duration} minutes`,
      "Notes": apt.notes || "",
      "Created": new Date(apt.createdAt).toLocaleDateString(),
    }));

    // Create CSV content
    const headers = Object.keys(exportData[0]);
    const csvContent = [
      headers.join(","),
      ...exportData.map(row => 
        headers.map(header => {
          const value = row[header] || "";
          // Escape commas and quotes in CSV
          return `"${value.toString().replace(/"/g, '""')}"`;
        }).join(",")
      )
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `appointments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Successful",
      description: `Exported ${appointments.length} appointments to CSV`,
    });
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
                      Appointments
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Manage patient appointments and scheduling.
                    </p>
                  </div>
                </div>
                <Link to="/appointments/new">
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>New Appointment</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Today's Appointments Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Today's Appointments
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {todayLoading ? "..." : todayAppointments?.length || 0}
                  </div>
                  <p className="text-xs text-gray-600">
                    {todayLoading
                      ? "Loading..."
                      : `${todayAppointments?.filter((apt: AppointmentWithDetails) => apt.status === "completed").length || 0} completed`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Upcoming
                  </CardTitle>
                  <Clock className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {todayLoading
                      ? "..."
                      : todayAppointments?.filter(
                          (apt: AppointmentWithDetails) =>
                            apt.status === "scheduled",
                        ).length || 0}
                  </div>
                  <p className="text-xs text-gray-600">Scheduled for today</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    This Week
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : appointments?.length || 0}
                  </div>
                  <p className="text-xs text-gray-600">Total appointments</p>
                </CardContent>
              </Card>
            </div>

            {/* Appointments Table */}
            <div className="bg-white rounded-lg shadow">
              <DataTable
                data={appointments || []}
                columns={columns}
                totalItems={appointments?.length || 0}
                currentPage={currentPage}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                searchPlaceholder="Search by patient name, email, phone, therapist, or session type..."
                onFilter={handleFilter}
                filters={filters}
                isLoading={isLoading}
                onRefresh={handleRefresh}
                onExport={handleExport}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                showQuickActions={true}
              />
            </div>
          </div>
        </main>
      </div>
      <PatientDetailsDialog
        patientId={selectedPatientId}
        isOpen={showPatientDialog}
        onClose={() => setShowPatientDialog(false)}
      />
    </div>
  );
}
