import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentPatients } from "@/components/dashboard/RecentPatients";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { QuickActions } from "@/components/dashboard/QuickActions";
import PatientChangesSummary from "@/components/dashboard/PatientChangesSummary";
import { Button } from "@/components/ui/button";
import { Download, Plus, UserCheck, User } from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { DashboardStats } from "@/components/dashboard/StatsCards";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRange.startDate) params.append("startDate", dateRange.startDate);
    if (dateRange.endDate) params.append("endDate", dateRange.endDate);
    fetch(`/api/audit-logs/unique-logins?${params.toString()}`)
      .then((res) => res.json())
      .catch(() => {});
  }, [dateRange]);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
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
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
    refetchInterval: 10000,
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  const statsData: DashboardStats = stats ?? {
    totalPatients: 0,
    todayAppointments: 0,
    activeTreatments: 0,
    treatmentCompletionRate: 0,
    monthlyAppointments: 0,
    completedAppointments: 0,
    upcomingAppointments: 0,
    appointmentsNeedingReview: 0,
  };

  const { data: recentPatients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/dashboard/recent-patients"],
    retry: false,
    refetchInterval: 10000,
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  const { data: todayAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["/api/dashboard/today-appointments"],
    retry: false,
    refetchInterval: 10000,
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  const handleExportReport = async (format: string) => {
    // Gather data
    const statsSection = [
      ["Metric", "Value"],
      ["Total Patients", statsData.totalPatients],
      ["Today's Appointments", statsData.todayAppointments],
      ["Active Treatments", statsData.activeTreatments],
      ["Treatment Completion Rate", statsData.treatmentCompletionRate],
      ["Monthly Appointments", statsData.monthlyAppointments],
      ["Completed Appointments", statsData.completedAppointments],
      ["Upcoming Appointments", statsData.upcomingAppointments],
      ["Appointments Needing Review", statsData.appointmentsNeedingReview],
    ];
    const patientsSection = [
      ["ID", "Name", "Email", "Status", "Joined"],
      ...(Array.isArray(recentPatients)
        ? recentPatients.map((p: any) => [
            p.id,
            `${p.firstName} ${p.lastName}`,
            p.email,
            p.status,
            p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""
          ])
        : []),
    ];
    const appointmentsSection = [
      ["ID", "Patient", "Therapist", "Date", "Type", "Status"],
      ...(Array.isArray(todayAppointments)
        ? todayAppointments.map((a: any) => [
            a.id,
            a.patientName || "",
            a.therapistName || "",
            a.appointmentDate ? new Date(a.appointmentDate).toLocaleString() : "",
            a.type,
            a.status
          ])
        : []),
    ];

    if (format === "csv") {
      // CSV: concatenate all sections with headers
      const csv = [
        "Dashboard Stats",
        statsSection.map(row => row.join(",")).join("\n"),
        "",
        "Recent Patients",
        patientsSection.map(row => row.join(",")).join("\n"),
        "",
        "Today's Appointments",
        appointmentsSection.map(row => row.join(",")).join("\n"),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Export Successful", description: "Dashboard report exported as CSV." });
    } else if (format === "excel") {
      // Excel: each section as a sheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statsSection), "Stats");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(patientsSection), "Recent Patients");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(appointmentsSection), "Today's Appointments");
      XLSX.writeFile(wb, `dashboard-report-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast({ title: "Export Successful", description: "Dashboard report exported as Excel." });
    } else if (format === "pdf") {
      // Placeholder: PDF export can be implemented with jsPDF or similar
      toast({ title: "PDF Export Not Implemented", description: "PDF export will be available soon." });
    }
  };

  if (isLoading) {
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
        <Sidebar
          patientCount={statsData.totalPatients}
          todayAppointments={statsData.todayAppointments}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Dashboard Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    Dashboard Overview
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Welcome back. Here's what's happening at your practice
                    today.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex items-center space-x-2">
                        <Download className="h-4 w-4" />
                        <span>Export Report</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExportReport("csv")}>Export as CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReport("excel")}>Export as Excel</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReport("pdf")}>Export as PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Link href="/patients/new">
                    <Button className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>New Patient</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="mb-8">
              <StatsCards stats={statsData} isLoading={statsLoading} />
            </div>

            {/* Patient Changes Summary - Only for Front Desk */}
            <div className="mb-8">
              <PatientChangesSummary />
            </div>

            {/* Main Content Grid: Recent Patients and Today's Schedule side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <RecentPatients
                  patients={Array.isArray(recentPatients) ? recentPatients : []}
                  isLoading={patientsLoading}
                  onViewAll={() => {
                    localStorage.setItem("showAllPatients", "true");
                    window.location.href = "/patients";
                  }}
                />
              </div>
              <div>
                <TodaySchedule
                  appointments={Array.isArray(todayAppointments) ? todayAppointments : []}
                  isLoading={appointmentsLoading}
                />
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <QuickActions />
        </main>
      </div>
    </div>
  );
}
