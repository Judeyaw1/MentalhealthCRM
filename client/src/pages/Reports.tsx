// @ts-nocheck
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Download,
  FileText,
  Clock,
  Activity,
  ArrowLeft,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "wouter";
import { Trash2 } from "lucide-react";

import { PatientDemographics } from "@/components/reports/PatientDemographics";
import { AppointmentAnalytics } from "@/components/reports/AppointmentAnalytics";
import { TreatmentCompletion } from "@/components/reports/TreatmentCompletion";
import { StaffPerformance } from "@/components/reports/StaffPerformance";
import { TreatmentOutcomes } from "@/components/reports/TreatmentOutcomes";

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [levelCounts, setLevelCounts] = useState<{ [key: string]: number }>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [searchAdd, setSearchAdd] = useState("");
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [patientToRemove, setPatientToRemove] = useState<any>(null);
  const [showDemographicsDialog, setShowDemographicsDialog] = useState(false);
  const [showAppointmentAnalyticsDialog, setShowAppointmentAnalyticsDialog] = useState(false);
  const [showTreatmentCompletionDialog, setShowTreatmentCompletionDialog] = useState(false);
  const [showStaffPerformanceDialog, setShowStaffPerformanceDialog] = useState(false);
  const [showTreatmentOutcomesDialog, setShowTreatmentOutcomesDialog] = useState(false);

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

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
    staleTime: 0, // Force fresh data
  });

  // Get staff count for the Staff Performance card
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["/api/staff/list"],
    retry: false,
    staleTime: 0,
  });

  // Real-time socket connection
  const { isConnected } = useSocket({
    onPatientCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // Refresh level counts when new patients are added
      refreshLevelCounts();
    },
    onPatientUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // Refresh current patient list if a level is selected
      if (selectedLevel) {
        handleLevelClick(selectedLevel);
      }
      // Refresh level counts when patients are updated
      refreshLevelCounts();
    },
    onPatientDeleted: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      // Refresh current patient list if a level is selected
      if (selectedLevel) {
        handleLevelClick(selectedLevel);
      }
      // Refresh level counts when patients are deleted
      refreshLevelCounts();
    },
  });

  const levelsOfCare = [
    {
      label: "Level 2.1 - Intensive Outpatient/Partial Hospitalization",
      value: "2.1",
    },
    {
      label: "Level 3.1 - Residential/Inpatient (Low Intensity)",
      value: "3.1",
    },
    {
      label: "Level 3.3 - Residential/Inpatient (Medium Intensity)",
      value: "3.3",
    },
  ];

  // Function to refresh level counts
  const refreshLevelCounts = async () => {
    const counts: { [key: string]: number } = {};
    for (const level of levelsOfCare) {
      try {
        const res = await fetch(`/api/patients?loc=${level.value}`);
        const data = await res.json();
        counts[level.value] = data.patients?.length || 0;
      } catch {
        counts[level.value] = 0;
      }
    }
    setLevelCounts(counts);
  };

  // Fetch counts for each level on mount
  useEffect(() => {
    refreshLevelCounts();
  }, []);

  // Fetch all patients (for add dialog)
  useEffect(() => {
    if (showAddDialog) {
      (async () => {
        const res = await fetch(`/api/patients?limit=1000`);
        const data = await res.json();
        setAllPatients(data.patients || []);
      })();
    }
  }, [showAddDialog]);

  const handleLevelClick = async (level: string) => {
    if (selectedLevel === level) {
      setSelectedLevel(null);
      setPatients([]);
      return;
    }
    setSelectedLevel(level);
    setLoadingPatients(true);
    try {
      const res = await fetch(`/api/patients?loc=${level}`);
      const data = await res.json();
      setPatients((data.patients || []).filter((p: any) => p.loc === level));
    } catch (err) {
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleExport = () => {
    if (!patients.length) return;
    const csvRows = [
              ["Name", "Clinical", "Status"],
      ...patients.map((p) => [
        `${p.firstName} ${p.lastName}`,
                  p.assignedClinical ? `${p.assignedClinical.firstName} ${p.assignedClinical.lastName}` : "-",
        p.status
      ])
    ];
    const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patients-level-${selectedLevel}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };







  const handleAddPatient = async (e: any) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedLevel) return;
    await fetch(`/api/patients/${selectedPatientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loc: selectedLevel }),
    });
    setShowAddDialog(false);
    setSelectedPatientId("");
    handleLevelClick(selectedLevel); // refresh list
  };

  const filteredAddPatients = allPatients.filter(
    (p) => p.status === "active" && (!p.loc || p.loc === "") &&
      (`${p.firstName} ${p.lastName}`.toLowerCase().includes(searchAdd.toLowerCase()) ||
       p.email?.toLowerCase().includes(searchAdd.toLowerCase()) ||
       p.phone?.toLowerCase().includes(searchAdd.toLowerCase()))
  );
  const handleBulkAdd = async (e: any) => {
    e.preventDefault();
    if (!selectedPatientIds.length || !selectedLevel) return;
    await Promise.all(selectedPatientIds.map(id =>
      fetch(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loc: selectedLevel }),
      })
    ));
    setShowAddDialog(false);
    setSelectedPatientIds([]);
    setSearchAdd("");
    handleLevelClick(selectedLevel); // refresh list
  };

  const handleRemoveFromProgram = async (patientId: string) => {
    try {
      await fetch(`/api/patients/${patientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loc: "" }), // Remove LOC by setting to empty string
      });
      
      toast({
        title: "Patient Removed",
        description: "Patient has been removed from the program successfully.",
      });
      
      // Refresh the patient list
      handleLevelClick(selectedLevel!);
      setShowRemoveDialog(false);
      setPatientToRemove(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove patient from program. Please try again.",
        variant: "destructive",
      });
    }
  };

  const confirmRemovePatient = (patient: any) => {
    setPatientToRemove(patient);
    setShowRemoveDialog(true);
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

  const reportCards = [
    {
      title: "Patient Demographics",
      description: "Age groups, gender distribution, and geographic analysis",
      icon: Users,
      color: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      metric: `${stats?.totalPatients || 0} patients`,
    },
    {
      title: "Appointment Analytics",
      description:
        "Booking patterns, no-show rates, and session duration trends",
      icon: Calendar,
      color: "bg-green-50 text-green-700 hover:bg-green-100",
      metric: `${stats?.todayAppointments || 0} today`,
    },
    {
      title: "Treatment Outcomes",
      description:
        "Progress tracking, goal completion, and therapeutic effectiveness",
      icon: TrendingUp,
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100",
      metric: `${stats?.activeTreatments || 0} active`,
    },
    {
      title: "Treatment Completion Rate",
      description: "Percentage of patients who successfully completed their treatment plans",
      icon: BarChart3,
      color: "bg-orange-50 text-orange-700 hover:bg-orange-100",
      metric: `${stats?.treatmentCompletionRate || 0}%`,
    },
    {
      title: "Staff Performance",
      description:
        "Clinical productivity, caseload distribution, and efficiency metrics",
      icon: Activity,
      color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
      metric: `${staffData?.length || 0} staff`,
    },
    {
      title: "Compliance Reports",
      description:
        "HIPAA audit trails, documentation completeness, and regulatory compliance",
      icon: FileText,
      color: "bg-red-50 text-red-700 hover:bg-red-100",
      metric: "All compliant",
    },
  ];

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
                      Reports & Analytics
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Comprehensive insights into your practice performance and
                      patient outcomes.
                    </p>
                  </div>
                </div>
                <Button className="flex items-center space-x-2">
                  <Download className="h-4 w-4" />
                  <span>Export All Reports</span>
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Patients
                  </CardTitle>
                  <Users className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.totalPatients || 0}
                  </div>
                  <p className="text-xs text-gray-600">+12% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Appointments
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading ? "..." : stats?.todayAppointments || 0}
                  </div>
                  <p className="text-xs text-gray-600">Today's schedule</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Treatment Completion Rate
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {statsLoading
                      ? "..."
                      : `${stats?.treatmentCompletionRate || 0}%`}
                  </div>
                  <p className="text-xs text-gray-600">Patients who completed treatment</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Efficiency
                  </CardTitle>
                  <Clock className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">94%</div>
                  <p className="text-xs text-gray-600">
                    Appointment completion rate
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Levels of Care Section */}
            <div className="mb-10">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Levels of Care</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {levelsOfCare.map((level) => (
                  <Card
                    key={level.value}
                    className={`cursor-pointer hover:shadow-lg transition-shadow border-2 ${selectedLevel === level.value ? "border-blue-600" : "border-transparent"}`}
                    onClick={() => handleLevelClick(level.value)}
                  >
                    <CardContent className="p-6 flex flex-col items-center">
                      <div className="text-lg font-semibold text-gray-900 mb-2 text-center">{level.label}</div>
                      <div className="mb-2 text-sm text-gray-600">{levelCounts[level.value] ?? "..."} patients</div>
                      <Button variant="outline" size="sm">View Patients</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {selectedLevel && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Patients in {levelsOfCare.find(l => l.value === selectedLevel)?.label}</h3>
                    <div className="flex gap-2">
                      {patients.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleExport} className="flex items-center gap-2">
                          <Download className="h-4 w-4" /> Export CSV
                        </Button>
                      )}
                      <Button variant="default" size="sm" onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
                        + Add Patient to Program
                      </Button>
                    </div>
                  </div>
                  {loadingPatients ? (
                    <div>Loading patients...</div>
                  ) : patients.length === 0 ? (
                    <div className="text-gray-500">No patients found in this level.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-4 py-2 text-left">Name</th>
                            <th className="px-4 py-2 text-left">Clinical</th>
                            <th className="px-4 py-2 text-left">Status</th>
                            <th className="px-4 py-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {patients.map((p) => (
                            <tr key={p.id} className="border-b">
                              <td className="px-4 py-2">
                                <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline">
                                  {p.firstName} {p.lastName}
                                </Link>
                              </td>
                              <td className="px-4 py-2">{p.assignedClinical ? `${p.assignedClinical.firstName} ${p.assignedClinical.lastName}` : "-"}</td>
                              <td className="px-4 py-2 capitalize">{p.status}</td>
                              <td className="px-4 py-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => confirmRemovePatient(p)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Report Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reportCards.map((report, index) => {
                const Icon = report.icon;

                return (
                  <Card
                    key={index}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => {
                      if (report.title === "Patient Demographics") {
                        setShowDemographicsDialog(true);
                      } else if (report.title === "Appointment Analytics") {
                        setShowAppointmentAnalyticsDialog(true);
                      } else if (report.title === "Treatment Outcomes") {
                        setShowTreatmentOutcomesDialog(true);
                      } else if (report.title === "Treatment Completion Rate") {
                        setShowTreatmentCompletionDialog(true);
                      } else if (report.title === "Staff Performance") {
                        setShowStaffPerformanceDialog(true);
                      }
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div
                          className={`p-3 rounded-lg ${report.color} transition-colors`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {report.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            {report.description}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900">
                              {report.metric}
                            </span>
                            <Button variant="outline" size="sm">
                              {report.title === "Patient Demographics" || report.title === "Appointment Analytics" || report.title === "Treatment Outcomes" || report.title === "Treatment Completion Rate" || report.title === "Staff Performance" ? "View Report" : "Generate"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Recent Activity */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Recent Report Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Monthly Patient Demographics Report
                      </p>
                      <p className="text-xs text-gray-600">
                        Generated 2 hours ago
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Appointment Analytics Summary
                      </p>
                      <p className="text-xs text-gray-600">
                        Generated yesterday
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        Treatment Outcomes Report
                      </p>
                      <p className="text-xs text-gray-600">
                        Generated 3 days ago
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Patients to {levelsOfCare.find(l => l.value === selectedLevel)?.label}</DialogTitle>
            <DialogDescription>
              Search and select patients to add to this level of care program.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleBulkAdd} className="space-y-4">
            <Input
              placeholder="Search patients by name, email, or phone..."
              value={searchAdd}
              onChange={e => setSearchAdd(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto border rounded p-2 bg-gray-50">
              {filteredAddPatients.length === 0 ? (
                <div className="text-gray-500 text-sm">No patients available to add.</div>
              ) : (
                filteredAddPatients.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 py-1 cursor-pointer">
                    <Checkbox
                      checked={selectedPatientIds.includes(p.id)}
                      onCheckedChange={checked => {
                        setSelectedPatientIds(ids =>
                          checked ? [...ids, p.id] : ids.filter(id => id !== p.id)
                        );
                      }}
                    />
                    <span>{p.firstName} {p.lastName} ({p.status})</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!selectedPatientIds.length}>Add Selected Patients</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Patient Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Patient from Program</DialogTitle>
            <DialogDescription>
              Confirm removal of the patient from this level of care program. They can be reassigned later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600">
              Are you sure you want to remove{" "}
              <span className="font-semibold">
                {patientToRemove?.firstName} {patientToRemove?.lastName}
              </span>{" "}
              from the {levelsOfCare.find(l => l.value === selectedLevel)?.label} program?
            </p>
            <p className="text-sm text-gray-500">
              This will remove their Level of Care assignment. They can be reassigned to a different program later.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRemoveDialog(false);
                  setPatientToRemove(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRemoveFromProgram(patientToRemove?.id)}
              >
                Remove from Program
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Patient Demographics Dialog */}
      <Dialog open={showDemographicsDialog} onOpenChange={setShowDemographicsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Patient Demographics Report</DialogTitle>
            <DialogDescription>
              View detailed demographic information and statistics about patients in the system.
            </DialogDescription>
          </DialogHeader>
          <PatientDemographics />
        </DialogContent>
      </Dialog>

      {/* Appointment Analytics Dialog */}
      <Dialog open={showAppointmentAnalyticsDialog} onOpenChange={setShowAppointmentAnalyticsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appointment Analytics Report</DialogTitle>
            <DialogDescription>
              Analyze appointment patterns, attendance rates, and scheduling trends.
            </DialogDescription>
          </DialogHeader>
          <AppointmentAnalytics />
        </DialogContent>
      </Dialog>

      {/* Treatment Completion Dialog */}
      <Dialog open={showTreatmentCompletionDialog} onOpenChange={setShowTreatmentCompletionDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Treatment Completion Rate Report</DialogTitle>
            <DialogDescription>
              Track and analyze treatment completion rates and outcomes across different programs.
            </DialogDescription>
          </DialogHeader>
          <TreatmentCompletion />
        </DialogContent>
      </Dialog>

      {/* Staff Performance Dialog */}
      <Dialog open={showStaffPerformanceDialog} onOpenChange={setShowStaffPerformanceDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staff Performance Report</DialogTitle>
            <DialogDescription>
              Monitor staff performance metrics, productivity, and effectiveness across different roles.
            </DialogDescription>
          </DialogHeader>
          <StaffPerformance />
        </DialogContent>
      </Dialog>

      {/* Treatment Outcomes Dialog */}
      <Dialog open={showTreatmentOutcomesDialog} onOpenChange={setShowTreatmentOutcomesDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Treatment Outcomes Report</DialogTitle>
            <DialogDescription>
              Comprehensive analysis of treatment effectiveness, symptom improvement, and goal achievement across all patients.
            </DialogDescription>
          </DialogHeader>
          <TreatmentOutcomes />
        </DialogContent>
      </Dialog>
    </div>
  );
}
