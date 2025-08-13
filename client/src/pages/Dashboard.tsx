import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/contexts/WebSocketContext";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PatientReport from "@/components/reports/PatientReport";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: "",
    endDate: "",
  });
  const [exportType, setExportType] = useState<string>("full"); // full, stats-only, patients-only, appointments-only
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedPatientForReport, setSelectedPatientForReport] = useState<any>(null);

  // Setup WebSocket for real-time updates
  const { isConnected, socket, addEventListener, removeEventListener } = useWebSocket();

  // Debug WebSocket connection
  useEffect(() => {
    console.log('🔌 Dashboard WebSocket state:', { isConnected, socket: !!socket });
  }, [isConnected, socket]);

  // Add event listeners for real-time updates
  useEffect(() => {
    const onPatientCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    };

    const onPatientUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/patients'] });
    };

    const onAppointmentCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    };

    const onAppointmentUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
    };

    const onDashboardStatsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    };

    // Add event listeners
    addEventListener('patient_created', onPatientCreated);
    addEventListener('patient_updated', onPatientUpdated);
    addEventListener('appointment_created', onAppointmentCreated);
    addEventListener('appointment_updated', onAppointmentUpdated);
    addEventListener('dashboard_stats_updated', onDashboardStatsUpdated);

    // Cleanup event listeners
    return () => {
      removeEventListener('patient_created', onPatientCreated);
      removeEventListener('patient_updated', onPatientUpdated);
      removeEventListener('appointment_created', onAppointmentCreated);
      removeEventListener('appointment_updated', onAppointmentUpdated);
      removeEventListener('dashboard_stats_updated', onDashboardStatsUpdated);
    };
  }, [addEventListener, removeEventListener, queryClient]);

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
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
    staleTime: 0, // Force fresh fetch
    refetchInterval: 10000,
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  const statsData: DashboardStats = stats ?? {
    totalPatients: 0,
    todayAppointments: 0,
    activeTreatments: 0,
    treatmentCompletionRate: 0,
    monthlyAppointments: 0,
    newPatientsThisMonth: 0,
    completedAppointments: 0,
    upcomingAppointments: 0,
    appointmentsNeedingReview: 0,
    archivedPatients: 0,
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
    // Gather comprehensive data with enhanced information
    const statsSection: string[][] = [
      ["Dashboard Metrics", "", ""],
      ["Metric", "Value", "Description", "Trend"],
      ["Total Patients", String(statsData.totalPatients), "All registered patients", "↗️ Growing"],
      ["Today's Appointments", String(statsData.todayAppointments), "Scheduled for today", "📅 Daily"],
      ["Active Treatments", String(statsData.activeTreatments), "Ongoing treatment plans", "🔄 Active"],
      ["Treatment Completion Rate", `${statsData.treatmentCompletionRate}%`, "Success rate", "📈 Performance"],
      ["Monthly Appointments", String(statsData.monthlyAppointments), "This month's total", "📊 Monthly"],
      ["New Patients This Month", String(statsData.newPatientsThisMonth), "Recent registrations", "🆕 Growth"],
      ["Completed Appointments", String(statsData.completedAppointments), "Finished sessions", "✅ Completed"],
      ["Upcoming Appointments", String(statsData.upcomingAppointments), "Future scheduled", "⏰ Scheduled"],
      ["Appointments Needing Review", String(statsData.appointmentsNeedingReview), "Require attention", "⚠️ Attention"],
      ["Archived Patients", String(statsData.archivedPatients || 0), "Discharged patients", "📁 Archived"],
      ["", "", "", ""],
      ["Report Generated", new Date().toLocaleString(), "Timestamp", ""],
      ["Real-time Status", isConnected ? "Connected" : "Disconnected", "WebSocket status", ""],
      ["Data Freshness", "Live", "Real-time data", ""],
    ];

    const patientsSection = [
      ["Recent Patients", "", "", "", "", "", ""],
      ["ID", "Name", "Email", "Status", "Join Date", "Age", "Therapist", "Last Activity"],
      ...(Array.isArray(recentPatients)
        ? recentPatients.map((p: any) => [
            p.id,
            `${p.firstName} ${p.lastName}`,
            p.email || "N/A",
            p.status,
            p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "N/A",
            p.dateOfBirth ? calculateAge(p.dateOfBirth) : "N/A",
            p.assignedTherapist ? `${p.assignedTherapist.firstName} ${p.assignedTherapist.lastName}` : "Unassigned",
            p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "N/A"
          ])
        : []),
    ];

    const appointmentsSection = [
      ["Today's Appointments", "", "", "", "", "", ""],
      ["ID", "Patient", "Therapist", "Date & Time", "Type", "Status", "Duration", "Notes"],
      ...(Array.isArray(todayAppointments)
        ? todayAppointments.map((a: any) => [
            a.id,
            a.patientName || "N/A",
            a.therapistName || "N/A",
            a.appointmentDate ? new Date(a.appointmentDate).toLocaleString() : "N/A",
            a.type || "Session",
            a.status,
            a.duration || "60 min",
            a.notes || "N/A"
          ])
        : []),
    ];

    // Add practice information with enhanced details
    const practiceInfo = [
      ["Practice Information", "", ""],
      ["Report Type", "Dashboard Overview", ""],
      ["Generated By", "Mental Health Tracker System", ""],
      ["Data Source", "Real-time Database", ""],
      ["Export Format", format.toUpperCase(), ""],
      ["Report Scope", exportType === "full" ? "Complete Dashboard" : exportType.replace("-", " "), ""],
      ["Date Range", dateRange.startDate && dateRange.endDate ? `${dateRange.startDate} to ${dateRange.endDate}` : "Current Data", ""],
      ["", "", ""],
    ];

    // Add performance insights
    const insightsSection = [
      ["Performance Insights", "", ""],
      ["Metric", "Value", "Analysis"],
      ["Patient Growth", `${statsData.newPatientsThisMonth} this month`, statsData.newPatientsThisMonth > 0 ? "Positive growth" : "No new patients"],
      ["Treatment Success", `${statsData.treatmentCompletionRate}%`, statsData.treatmentCompletionRate > 80 ? "Excellent" : "Needs improvement"],
      ["Appointment Efficiency", `${statsData.todayAppointments} today`, statsData.todayAppointments > 0 ? "Active schedule" : "No appointments"],
      ["Practice Capacity", `${statsData.totalPatients} total`, "Current patient load"],
      ["", "", ""],
    ];

    if (format === "csv") {
      // Enhanced CSV with better formatting and conditional sections
      const sections = [practiceInfo];
      
      if (exportType === "full" || exportType === "stats-only") {
        sections.push(statsSection, insightsSection);
      }
      if (exportType === "full" || exportType === "patients-only") {
        sections.push(patientsSection);
      }
      if (exportType === "full" || exportType === "appointments-only") {
        sections.push(appointmentsSection);
      }
      
      const csv = sections.map(section => section.map(row => row.map(cell => String(cell)).join(",")).join("\n")).join("\n\n");
      
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-report-${exportType}-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Export Successful", description: `Enhanced ${exportType} report exported as CSV.` });
    } else if (format === "excel") {
      // Enhanced Excel with multiple sheets and conditional content
      const wb = XLSX.utils.book_new();
      
      // Practice Info Sheet
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(practiceInfo), "Practice Info");
      
      if (exportType === "full" || exportType === "stats-only") {
        // Stats Sheet with better formatting
        const statsSheet = XLSX.utils.aoa_to_sheet(statsSection);
        XLSX.utils.book_append_sheet(wb, statsSheet, "Dashboard Stats");
        
        // Insights Sheet
        const insightsSheet = XLSX.utils.aoa_to_sheet(insightsSection);
        XLSX.utils.book_append_sheet(wb, insightsSheet, "Performance Insights");
      }
      
      if (exportType === "full" || exportType === "patients-only") {
        // Patients Sheet
        const patientsSheet = XLSX.utils.aoa_to_sheet(patientsSection);
        XLSX.utils.book_append_sheet(wb, patientsSheet, "Recent Patients");
      }
      
      if (exportType === "full" || exportType === "appointments-only") {
        // Appointments Sheet
        const appointmentsSheet = XLSX.utils.aoa_to_sheet(appointmentsSection);
        XLSX.utils.book_append_sheet(wb, appointmentsSheet, "Today's Appointments");
      }
      
      XLSX.writeFile(wb, `dashboard-report-${exportType}-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast({ title: "Export Successful", description: `Enhanced ${exportType} report exported as Excel.` });
    } else if (format === "pdf") {
      // Enhanced PDF export with conditional content
      try {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(20);
        doc.text("Dashboard Report", 20, 20);
        
        // Add practice info
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
        doc.text(`Status: ${isConnected ? 'Real-time Connected' : 'Disconnected'}`, 20, 45);
        doc.text(`Report Type: ${exportType}`, 20, 55);
        
        let pageNumber = 1;
        
        if (exportType === "full" || exportType === "stats-only") {
          // Add stats
          doc.setFontSize(16);
          doc.text("Dashboard Metrics", 20, 75);
          doc.setFontSize(10);
          let yPos = 85;
          doc.text(`Total Patients: ${statsData.totalPatients}`, 20, yPos); yPos += 7;
          doc.text(`Today's Appointments: ${statsData.todayAppointments}`, 20, yPos); yPos += 7;
          doc.text(`Active Treatments: ${statsData.activeTreatments}`, 20, yPos); yPos += 7;
          doc.text(`Treatment Completion Rate: ${statsData.treatmentCompletionRate}%`, 20, yPos); yPos += 7;
          doc.text(`New Patients This Month: ${statsData.newPatientsThisMonth}`, 20, yPos); yPos += 7;
          
          // Add insights
          doc.setFontSize(14);
          doc.text("Performance Insights", 20, yPos + 10);
          doc.setFontSize(10);
          yPos += 20;
          doc.text(`Patient Growth: ${statsData.newPatientsThisMonth > 0 ? 'Positive' : 'No growth'}`, 20, yPos); yPos += 7;
          doc.text(`Treatment Success: ${statsData.treatmentCompletionRate > 80 ? 'Excellent' : 'Needs improvement'}`, 20, yPos); yPos += 7;
        }
        
        if (exportType === "full" || exportType === "patients-only") {
          // Add new page for patients
          doc.addPage();
          pageNumber++;
          doc.setFontSize(16);
          doc.text("Recent Patients", 20, 20);
          doc.setFontSize(10);
          let yPos = 30;
          if (Array.isArray(recentPatients)) {
            recentPatients.slice(0, 20).forEach((p: any) => {
              doc.text(`${p.firstName} ${p.lastName} - ${p.status}`, 20, yPos);
              yPos += 6;
            });
          }
        }
        
        if (exportType === "full" || exportType === "appointments-only") {
          // Add new page for appointments
          doc.addPage();
          pageNumber++;
          doc.setFontSize(16);
          doc.text("Today's Appointments", 20, 20);
          doc.setFontSize(10);
          let yPos = 30;
          if (Array.isArray(todayAppointments)) {
            todayAppointments.slice(0, 20).forEach((a: any) => {
              const time = a.appointmentDate ? new Date(a.appointmentDate).toLocaleTimeString() : "N/A";
              doc.text(`${a.patientName || 'N/A'} - ${time} - ${a.status}`, 20, yPos);
              yPos += 6;
            });
          }
        }
        
        // Add page numbers
        for (let i = 1; i <= pageNumber; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.text(`Page ${i} of ${pageNumber}`, 180, 280);
        }
        
        doc.save(`dashboard-report-${exportType}-${new Date().toISOString().split("T")[0]}.pdf`);
        toast({ title: "Export Successful", description: `Enhanced ${exportType} report exported as PDF.` });
      } catch (error) {
        toast({ 
          title: "PDF Export Error", 
          description: "PDF export requires jsPDF library. Please install it first.",
          variant: "destructive"
        });
      }
    }
  };

  const handleGenerateReport = (patient: any) => {
    setSelectedPatientForReport(patient);
    setShowReportDialog(true);
  };

  // Helper function to calculate age
  const calculateAge = (dateOfBirth: string | Date) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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
          archivedCount={statsData.archivedPatients || 0}
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
                  
                  {/* Real-time status indicator */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs text-gray-600">
                      {isConnected ? 'Real-time connected' : 'Real-time disconnected'}
                    </span>
                  </div>
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
                      <DropdownMenuItem onClick={() => setShowExportDialog(true)}>Advanced Export</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReport("csv")}>Quick CSV Export</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReport("excel")}>Quick Excel Export</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExportReport("pdf")}>Quick PDF Export</DropdownMenuItem>
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
                  onPatientClick={(patient) => {
                    // Navigate to patient detail
                    window.location.href = `/patients/${patient.id}`;
                  }}
                  onGenerateReport={handleGenerateReport}
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

      {/* Advanced Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Advanced Export Options</DialogTitle>
            <DialogDescription>
              Configure export settings and choose your preferred format and date range.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Report Type</label>
              <Select value={exportType} onValueChange={setExportType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Dashboard Report</SelectItem>
                  <SelectItem value="stats-only">Statistics Only</SelectItem>
                  <SelectItem value="patients-only">Patients Only</SelectItem>
                  <SelectItem value="appointments-only">Appointments Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Date Range (Optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                  <Input
                    type="date"
                    placeholder="Start Date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Date</label>
                  <Input
                    type="date"
                    placeholder="End Date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowExportDialog(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  handleExportReport("csv");
                  setShowExportDialog(false);
                }}
                className="w-full sm:w-auto"
              >
                Export CSV
              </Button>
              <Button 
                onClick={() => {
                  handleExportReport("excel");
                  setShowExportDialog(false);
                }}
                className="w-full sm:w-auto"
              >
                Export Excel
              </Button>
              <Button 
                onClick={() => {
                  handleExportReport("pdf");
                  setShowExportDialog(false);
                }}
                className="w-full sm:w-auto"
              >
                Export PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>Patient Report</DialogTitle>
            <DialogDescription>
              Comprehensive treatment and progress report for {selectedPatientForReport?.fullPatient?.firstName} {selectedPatientForReport?.fullPatient?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            {selectedPatientForReport && (
              <PatientReport 
                patientId={selectedPatientForReport.id} 
                onClose={() => setShowReportDialog(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
