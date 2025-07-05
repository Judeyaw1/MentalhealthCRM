// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Calendar, Clock, Eye, Edit, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { AppointmentWithDetails } from "@shared/schema";

export default function Appointments() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
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

  // Get date range for filtering
  const getDateRange = () => {
    if (!dateFilter) return {};
    
    const today = new Date();
    let startDate: Date;
    let endDate: Date;
    
    switch (dateFilter) {
      case "today":
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        break;
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        endDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
        break;
      case "month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        break;
      default:
        return {};
    }
    
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["/api/appointments", { 
      ...getDateRange(),
      status: statusFilter || undefined
    }],
    retry: false,
  });

  const { data: todayAppointments, isLoading: todayLoading } = useQuery({
    queryKey: ["/api/dashboard/today-appointments"],
    retry: false,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "completed":
        return <Badge className="bg-success-100 text-success-500">Completed</Badge>;
      case "cancelled":
        return <Badge className="bg-error-100 text-error-500">Cancelled</Badge>;
      case "no-show":
        return <Badge className="bg-warning-100 text-warning-500">No Show</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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

  const columns = [
    {
      key: "patient",
      label: "Patient",
      render: (_, row: AppointmentWithDetails) => (
        <div className="flex items-center">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-100 text-primary-600 text-xs">
              {getInitials(row.patient.firstName, row.patient.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900">
              {row.patient.firstName} {row.patient.lastName}
            </div>
            <div className="text-xs text-gray-500">
              #P-{row.patient.id.toString().padStart(4, '0')}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "therapist",
      label: "Therapist",
      render: (_, row: AppointmentWithDetails) => (
        <div className="text-sm text-gray-900">
          {row.therapist.firstName} {row.therapist.lastName}
        </div>
      ),
    },
    {
      key: "appointmentDate",
      label: "Date & Time",
      render: (value: string) => (
        <div className="text-sm text-gray-900">
          {formatDateTime(value)}
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (value: string) => (
        <div className="text-sm text-gray-900 capitalize">
          {value.replace("-", " ")}
        </div>
      ),
    },
    {
      key: "duration",
      label: "Duration",
      render: (value: number) => (
        <div className="text-sm text-gray-900">
          {value} min
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => getStatusBadge(value),
    },
    {
      key: "actions",
      label: "Actions",
      render: (_, row: AppointmentWithDetails) => (
        <div className="flex space-x-2">
          <Button variant="ghost" size="sm">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Edit className="h-4 w-4" />
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
                    <h1 className="text-2xl font-semibold text-gray-900">Appointments</h1>
                    <p className="text-gray-600 mt-1">
                      Manage patient appointments and scheduling.
                    </p>
                  </div>
                </div>
                <Link href="/appointments/new">
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
                  <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {todayLoading ? "..." : todayAppointments?.length || 0}
                  </div>
                  <p className="text-xs text-gray-600">
                    {todayLoading ? "Loading..." : `${todayAppointments?.filter((apt: AppointmentWithDetails) => apt.status === "completed").length || 0} completed`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
                  <Clock className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {todayLoading ? "..." : todayAppointments?.filter((apt: AppointmentWithDetails) => apt.status === "scheduled").length || 0}
                  </div>
                  <p className="text-xs text-gray-600">
                    Scheduled for today
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : appointments?.length || 0}
                  </div>
                  <p className="text-xs text-gray-600">
                    Total appointments
                  </p>
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
                onFilter={handleFilter}
                filters={filters}
                isLoading={isLoading}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
