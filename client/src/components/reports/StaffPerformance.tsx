import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, TrendingUp, Award, Clock, Target, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { useState } from "react";

interface StaffMember {
  staffId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  appointmentCompletionRate: number;
  totalRecords: number;
  completedRecords: number;
  recordCompletionRate: number;
  assignedPatients: number;
  dischargedPatients: number;
  patientDischargeRate: number;
  averageSessionDuration: number;
  monthlyAppointments: number;
  // Additional metrics for enhanced performance tracking
  activePatients: number;
  patientRetentionRate: number;
  responseTime: number; // in hours
  documentationQuality: number; // percentage
}

interface StaffPerformanceData {
  totalStaff: number;
  totalStaffAppointments: number;
  totalStaffRecords: number;
  totalStaffPatients: number;
  averageAppointmentCompletionRate: number;
  averageRecordCompletionRate: number;
  averagePatientDischargeRate: number;
  staffPerformance: StaffMember[];
  topAppointmentPerformers: StaffMember[];
  topRecordPerformers: StaffMember[];
  topPatientDischargers: StaffMember[];
}

export function StaffPerformance() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: analytics, isLoading } = useQuery<StaffPerformanceData>({
    queryKey: ["/api/reports/staff-performance"],
    retry: false,
  });

  const handleExport = () => {
    if (!analytics) return;
    
    const csvRows = [
      ["Metric", "Value"],
      ["Total Staff", analytics.totalStaff],
      ["Total Staff Appointments", analytics.totalStaffAppointments],
      ["Total Staff Records", analytics.totalStaffRecords],
      ["Total Staff Patients", analytics.totalStaffPatients],
      ["Average Appointment Completion Rate (%)", analytics.averageAppointmentCompletionRate],
      ["Average Record Completion Rate (%)", analytics.averageRecordCompletionRate],
      ["Average Patient Discharge Rate (%)", analytics.averagePatientDischargeRate],
      ["", ""],
      ["Staff Performance Details", ""],
      ["Name", "Email", "Role", "Appointments", "Completion Rate", "Records", "Record Rate", "Patients", "Discharge Rate", "Avg Session Duration", "Monthly Appointments"],
      ...analytics.staffPerformance.map(staff => [
        `${staff.firstName} ${staff.lastName}`,
        staff.email,
        staff.role,
        staff.totalAppointments,
        `${staff.appointmentCompletionRate}%`,
        staff.totalRecords,
        `${staff.recordCompletionRate}%`,
        staff.assignedPatients,
        `${staff.patientDischargeRate}%`,
        `${staff.averageSessionDuration} min`,
        staff.monthlyAppointments
      ])
    ];

    const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff-performance-report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">No staff performance data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Info className="h-5 w-5" />
            Staff Performance Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{analytics.totalStaff || 0}</div>
              <div className="text-sm text-blue-700">Total Staff Members</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((analytics.averageAppointmentCompletionRate || 0) + (analytics.averageRecordCompletionRate || 0) + (analytics.averagePatientDischargeRate || 0) / 3)}%
              </div>
              <div className="text-sm text-green-700">Overall Performance Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{analytics.totalStaffPatients || 0}</div>
              <div className="text-sm text-purple-700">Total Patients Under Care</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalStaff || 0}</div>
            <p className="text-xs text-gray-600">Active staff members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Appointment Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.averageAppointmentCompletionRate || 0}%</div>
            <p className="text-xs text-gray-600">Completion rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Record Rate</CardTitle>
            <Target className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analytics.averageRecordCompletionRate || 0}%</div>
            <p className="text-xs text-gray-600">Treatment records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Discharge Rate</CardTitle>
            <Award className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{analytics.averagePatientDischargeRate || 0}%</div>
            <p className="text-xs text-gray-600">Patient discharges</p>
          </CardContent>
        </Card>
      </div>

      {/* Staff Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{analytics.totalStaffAppointments || 0}</div>
              <div className="text-sm text-gray-600">Total Appointments</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{analytics.totalStaffRecords || 0}</div>
              <div className="text-sm text-gray-600">Total Records</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{analytics.totalStaffPatients || 0}</div>
              <div className="text-sm text-gray-600">Assigned Patients</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round((analytics.totalStaffAppointments || 0) / (analytics.totalStaff || 1))}
              </div>
              <div className="text-sm text-gray-600">Avg Appointments/Staff</div>
            </div>
          </div>
          
          {/* Additional Performance Metrics */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-indigo-50 rounded-lg">
              <div className="text-lg font-bold text-indigo-600">
                {Math.round((analytics.totalStaffAppointments || 0) / (analytics.totalStaff || 1) * 0.8)}%
              </div>
              <div className="text-xs text-gray-600">Avg Efficiency</div>
            </div>
            <div className="text-center p-3 bg-teal-50 rounded-lg">
              <div className="text-lg font-bold text-teal-600">
                {Math.round((analytics.totalStaffPatients || 0) / (analytics.totalStaff || 1))}
              </div>
              <div className="text-xs text-gray-600">Avg Patients/Staff</div>
            </div>
            <div className="text-center p-3 bg-pink-50 rounded-lg">
              <div className="text-lg font-bold text-pink-600">
                {Math.round((analytics.totalStaffRecords || 0) / (analytics.totalStaff || 1))}
              </div>
              <div className="text-xs text-gray-600">Avg Records/Staff</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-lg font-bold text-amber-600">
                {Math.round((analytics.averageAppointmentCompletionRate || 0) + (analytics.averageRecordCompletionRate || 0) + (analytics.averagePatientDischargeRate || 0) / 3)}%
              </div>
              <div className="text-xs text-gray-600">Overall Performance</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Appointment Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Appointment Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(analytics.topAppointmentPerformers || []).map((staff, index) => (
                <div key={staff.staffId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-yellow-100 flex items-center justify-center text-xs font-bold text-yellow-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {staff.firstName} {staff.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{staff.role}</div>
                    </div>
                  </div>
                                      <div className="text-right">
                      <div className="text-sm font-bold text-green-600">
                        {staff.appointmentCompletionRate || 0}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {staff.completedAppointments || 0}/{staff.totalAppointments || 0}
                      </div>
                    </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Record Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Top Record Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(analytics.topRecordPerformers || []).map((staff, index) => (
                <div key={staff.staffId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {staff.firstName} {staff.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{staff.role}</div>
                    </div>
                  </div>
                                      <div className="text-right">
                      <div className="text-sm font-bold text-blue-600">
                        {staff.recordCompletionRate || 0}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {staff.completedRecords || 0}/{staff.totalRecords || 0}
                      </div>
                    </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Patient Dischargers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top Patient Dischargers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(analytics.topPatientDischargers || []).map((staff, index) => (
                <div key={staff.staffId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {staff.firstName} {staff.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{staff.role}</div>
                    </div>
                  </div>
                                      <div className="text-right">
                      <div className="text-sm font-bold text-purple-600">
                        {staff.patientDischargeRate || 0}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {staff.dischargedPatients || 0}/{staff.assignedPatients || 0}
                      </div>
                    </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends & Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Alerts */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Performance Alerts</h4>
              <div className="space-y-2">
                {analytics.staffPerformance?.filter(staff => (staff.appointmentCompletionRate || 0) < 70).map(staff => (
                  <div key={staff.staffId} className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-red-700">
                      {staff.firstName} {staff.lastName} - Low appointment completion rate ({staff.appointmentCompletionRate}%)
                    </span>
                  </div>
                ))}
                {analytics.staffPerformance?.filter(staff => (staff.assignedPatients || 0) > 15).map(staff => (
                  <div key={staff.staffId} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm text-orange-700">
                      {staff.firstName} {staff.lastName} - High case load ({staff.assignedPatients} patients)
                    </span>
                  </div>
                ))}
                {analytics.staffPerformance?.filter(staff => (staff.recordCompletionRate || 0) < 60).map(staff => (
                  <div key={staff.staffId} className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-yellow-700">
                      {staff.firstName} {staff.lastName} - Documentation needs improvement ({staff.recordCompletionRate}%)
                    </span>
                  </div>
                ))}
                {(!analytics.staffPerformance?.some(staff => (staff.appointmentCompletionRate || 0) < 70) && 
                  !analytics.staffPerformance?.some(staff => (staff.assignedPatients || 0) > 15) &&
                  !analytics.staffPerformance?.some(staff => (staff.recordCompletionRate || 0) < 60)) && (
                  <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">All staff performing well!</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Recommendations</h4>
              <div className="space-y-2">
                {analytics.staffPerformance?.some(staff => (staff.appointmentCompletionRate || 0) < 70) && (
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">Consider additional training for staff with low completion rates</p>
                  </div>
                )}
                {analytics.staffPerformance?.some(staff => (staff.assignedPatients || 0) > 15) && (
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">Redistribute case load to balance staff workload</p>
                  </div>
                )}
                {analytics.staffPerformance?.some(staff => (staff.recordCompletionRate || 0) < 60) && (
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">Implement documentation quality improvement program</p>
                  </div>
                )}
                <div className="p-2 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">Schedule regular performance review meetings</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Analytics */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Staff Performance Table */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Detailed Staff Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Staff Member</th>
                      <th className="text-center py-2">Appointments</th>
                      <th className="text-center py-2">Completion Rate</th>
                      <th className="text-center py-2">Records</th>
                      <th className="text-center py-2">Record Rate</th>
                      <th className="text-center py-2">Patients</th>
                      <th className="text-center py-2">Discharge Rate</th>
                      <th className="text-center py-2">Avg Session</th>
                      <th className="text-center py-2">Monthly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics.staffPerformance || []).map((staff) => (
                      <tr key={staff.staffId} className="border-b hover:bg-gray-50">
                        <td className="py-2">
                          <div>
                            <div className="font-medium">
                              {staff.firstName} {staff.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{staff.email}</div>
                            <div className="text-xs text-gray-400">{staff.role}</div>
                          </div>
                        </td>
                        <td className="text-center py-2">
                          <div className="font-medium">{staff.totalAppointments || 0}</div>
                          <div className="text-xs text-gray-500">
                            {staff.completedAppointments || 0} completed
                          </div>
                        </td>
                        <td className="text-center py-2">
                          <span className={`font-medium ${
                            (staff.appointmentCompletionRate || 0) >= 80 ? 'text-green-600' :
                            (staff.appointmentCompletionRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {staff.appointmentCompletionRate || 0}%
                          </span>
                        </td>
                        <td className="text-center py-2">
                          <div className="font-medium">{staff.totalRecords || 0}</div>
                          <div className="text-xs text-gray-500">
                            {staff.completedRecords || 0} completed
                          </div>
                        </td>
                        <td className="text-center py-2">
                          <span className={`font-medium ${
                            (staff.recordCompletionRate || 0) >= 80 ? 'text-green-600' :
                            (staff.recordCompletionRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {staff.recordCompletionRate || 0}%
                          </span>
                        </td>
                        <td className="text-center py-2">
                          <div className="font-medium">{staff.assignedPatients || 0}</div>
                          <div className="text-xs text-gray-500">
                            {staff.dischargedPatients || 0} discharged
                          </div>
                        </td>
                        <td className="text-center py-2">
                          <span className={`font-medium ${
                            (staff.patientDischargeRate || 0) >= 80 ? 'text-green-600' :
                            (staff.patientDischargeRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {staff.patientDischargeRate || 0}%
                          </span>
                        </td>
                        <td className="text-center py-2">
                          <div className="font-medium">{staff.averageSessionDuration || 0} min</div>
                        </td>
                        <td className="text-center py-2">
                          <div className="font-medium">{staff.monthlyAppointments || 0}</div>
                          <div className="text-xs text-gray-500">this month</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "Show Less" : "Show More Details"}
        </Button>
        
        <Button onClick={handleExport} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>
    </div>
  );
} 