import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, UserPlus, RefreshCw, UserCheck, Star, Calendar, Download } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface PatientChange {
  id: string;
  name: string;
  createdBy?: string;
  createdAt?: string;
  status?: string;
  assignedTherapist?: string;
  therapist?: string;
  important?: boolean;
  updatedAt?: string;
  updatedBy?: string;
  assignedBy?: string;
  markedBy?: string;
}

interface ChangesSummary {
  newPatientsCount: number;
  statusChangesCount: number;
  therapistAssignmentsCount: number;
  importantUpdatesCount: number;
  totalChanges: number;
}

interface PatientChangesData {
  changes: {
    newPatients: PatientChange[];
    statusChanges: PatientChange[];
    therapistAssignments: PatientChange[];
    importantUpdates: PatientChange[];
  };
  summary: ChangesSummary;
  dateRange: {
    start: string;
    end: string;
  };
}

export default function PatientChangesSummary() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [resetTimestamp, setResetTimestamp] = useState<number | null>(null);

  // Debug: Log user info
  console.log("PatientChangesSummary - User:", user);

  // Only show for front desk staff
  if (user?.role !== "frontdesk") {
    return null;
  }

  const { data, isLoading, error, refetch } = useQuery<PatientChangesData>({
    queryKey: ["patient-changes", resetTimestamp],
    queryFn: async () => {
      console.log("Fetching patient changes...");
      const url = resetTimestamp 
        ? `/api/patient-changes?reset=${resetTimestamp}`
        : "/api/patient-changes?since=last-login";
      console.log("API URL:", url);
      
      const response = await fetch(url);
      console.log("Response status:", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response:", errorText);
        throw new Error(`Failed to fetch patient changes: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      console.log("Patient changes data:", data);
      return data;
    },
    enabled: isOpen, // Only fetch when modal is open
  });

  const handleOpen = () => {
    setIsOpen(true);
    // Set initial refresh time when modal opens
    if (!lastRefreshed) {
      setLastRefreshed(new Date());
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "discharged": return "bg-red-100 text-red-800";
      case "inactive": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
    }
  };

  const exportToPDF = () => {
    // Simple export functionality - could be enhanced with a proper PDF library
    const content = `
Patient Changes Summary
${format(new Date(data?.dateRange.start || ""), "PPP")} - ${format(new Date(data?.dateRange.end || ""), "PPP")}

New Patients (${data?.summary.newPatientsCount || 0}):
${data?.changes.newPatients.map(p => `• ${p.name} - Created by ${p.createdBy}`).join('\n') || 'None'}

Status Changes (${data?.summary.statusChangesCount || 0}):
${data?.changes.statusChanges.map(p => `• ${p.name} - Status: ${p.status}`).join('\n') || 'None'}

Therapist Assignments (${data?.summary.therapistAssignmentsCount || 0}):
${data?.changes.therapistAssignments.map(p => `• ${p.name} - Assigned to ${p.therapist}`).join('\n') || 'None'}

Important Updates (${data?.summary.importantUpdatesCount || 0}):
${data?.changes.importantUpdates.map(p => `• ${p.name} - Marked as important`).join('\n') || 'None'}
    `;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-changes-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Patient changes summary has been downloaded",
    });
  };

  const handleReset = () => {
    console.log("🔍 Reset button clicked!");
    
    // Set a new timestamp to trigger a fresh query with reset parameter
    const timestamp = Date.now();
    setResetTimestamp(timestamp);
    setLastRefreshed(new Date());
    
    toast({
      title: "Data Reset",
      description: "Patient changes data has been refreshed with latest information",
    });
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outline"
        className="w-full"
      >
        <Clock className="h-4 w-4 mr-2" />
        What Happened While I Was Away?
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                           <DialogHeader>
                   <DialogTitle className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Clock className="h-5 w-5" />
                       Patient Changes Summary
                     </div>
                     <div className="flex items-center gap-2">
                       {lastRefreshed && (
                         <span className="text-xs text-gray-500 mr-2">
                           Last refreshed: {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
                         </span>
                       )}
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => {
                           refetch();
                           setLastRefreshed(new Date());
                         }}
                         disabled={isLoading}
                         title="Refresh data"
                       >
                         <RefreshCw className="h-4 w-4 mr-1" />
                         Refresh
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => {
                           console.log("🔍 Reset button clicked - test!");
                           handleReset();
                         }}
                         disabled={isLoading}
                         title="Reset and get fresh data"
                       >
                         Reset
                       </Button>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={exportToPDF}
                         disabled={!data}
                         title="Export to file"
                       >
                         <Download className="h-4 w-4 mr-1" />
                         Export
                       </Button>
                     </div>
                   </DialogTitle>
                 </DialogHeader>

          {isLoading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading patient changes...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-600">
              <p>Failed to load patient changes</p>
              <Button onClick={() => refetch()} className="mt-2">
                Try Again
              </Button>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-600">New Patients</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{data.summary.newPatientsCount}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-600">Status Changes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">{data.summary.statusChangesCount}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-600">Therapist Assignments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">{data.summary.therapistAssignmentsCount}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-600">Important Updates</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">{data.summary.importantUpdatesCount}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Date Range */}
              <div className="text-sm text-gray-600 text-center">
                <Calendar className="h-4 w-4 inline mr-1" />
                {format(new Date(data.dateRange.start), "PPP")} - {format(new Date(data.dateRange.end), "PPP")}
              </div>

              {/* New Patients */}
              {data.changes.newPatients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      {/* UserPlus className="h-5 w-5" */}
                      New Patients ({data.changes.newPatients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.changes.newPatients.map((patient) => (
                        <div key={patient.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(patient.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium">{patient.name}</div>
                            <div className="text-sm text-gray-600">
                              Created by {patient.createdBy} • {formatDistanceToNow(new Date(patient.createdAt || ""), { addSuffix: true })}
                            </div>
                          </div>
                          <Badge variant="secondary" className={getStatusColor(patient.status || "")}>
                            {patient.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status Changes */}
              {data.changes.statusChanges.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      {/* RefreshCw className="h-5 w-5" */}
                      Status Changes ({data.changes.statusChanges.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.changes.statusChanges.map((patient) => (
                        <div key={patient.id} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(patient.name)}
                            </AvatarFallback>
                          </Avatar>
                                                           <div className="flex-1">
                                   <div className="font-medium">{patient.name}</div>
                                   <div className="text-sm text-gray-600">
                                     Updated by {patient.updatedBy || "Unknown"} • {formatDistanceToNow(new Date(patient.updatedAt || ""), { addSuffix: true })}
                                   </div>
                                 </div>
                          <Badge variant="secondary" className={getStatusColor(patient.status || "")}>
                            {patient.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Therapist Assignments */}
              {data.changes.therapistAssignments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-600">
                      {/* UserCheck className="h-5 w-5" */}
                      Therapist Assignments ({data.changes.therapistAssignments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.changes.therapistAssignments.map((patient) => (
                        <div key={patient.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(patient.name)}
                            </AvatarFallback>
                          </Avatar>
                                                           <div className="flex-1">
                                   <div className="font-medium">{patient.name}</div>
                                   <div className="text-sm text-gray-600">
                                     Assigned to {patient.therapist} by {patient.assignedBy || "Unknown"} • {formatDistanceToNow(new Date(patient.updatedAt || ""), { addSuffix: true })}
                                   </div>
                                 </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Important Updates */}
              {data.changes.importantUpdates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-purple-600">
                      {/* Star className="h-5 w-5" */}
                      Important Updates ({data.changes.importantUpdates.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.changes.importantUpdates.map((patient) => (
                        <div key={patient.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(patient.name)}
                            </AvatarFallback>
                          </Avatar>
                                                           <div className="flex-1">
                                   <div className="font-medium">{patient.name}</div>
                                   <div className="text-sm text-gray-600">
                                     Marked as important by {patient.markedBy || "Unknown"} • {formatDistanceToNow(new Date(patient.updatedAt || ""), { addSuffix: true })}
                                   </div>
                                 </div>
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                            Important
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No Changes */}
              {data.summary.totalChanges === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No Changes Found</p>
                  <p className="text-sm">No patient changes occurred during this time period.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 