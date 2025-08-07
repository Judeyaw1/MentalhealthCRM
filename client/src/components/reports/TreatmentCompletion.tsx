import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, CheckCircle, Clock, TrendingUp, Target } from "lucide-react";
import { useState } from "react";

interface TreatmentCompletionData {
  totalPatients: number;
  dischargedPatients: number;
  activePatients: number;
  inactivePatients: number;
  completionRate: number;
  averageLOS: number;
  totalRecords: number;
  completedRecords: number;
  inProgressRecords: number;
  pendingRecords: number;
  recordCompletionRate: number;
  totalGoals: number;
  completedGoals: number;
  goalCompletionRate: number;
  monthlyDischarges: { [key: string]: number };
  durationDistribution: { [key: string]: number };
  treatmentDurations: {
    average: number;
    min: number;
    max: number;
    total: number;
  };
}

export function TreatmentCompletion() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: analytics, isLoading } = useQuery<TreatmentCompletionData>({
    queryKey: ["/api/reports/treatment-completion"],
    retry: false,
  });

  const handleExport = () => {
    if (!analytics) return;
    
    const csvRows = [
      ["Metric", "Value"],
      ["Total Patients", analytics.totalPatients],
      ["Discharged Patients", analytics.dischargedPatients],
      ["Active Patients", analytics.activePatients],
      ["Inactive Patients", analytics.inactivePatients],
      ["Treatment Completion Rate (%)", analytics.completionRate],
      ["Average Length of Stay (days)", analytics.averageLOS],
      ["Total Treatment Records", analytics.totalRecords],
      ["Completed Records", analytics.completedRecords],
      ["In Progress Records", analytics.inProgressRecords],
      ["Pending Records", analytics.pendingRecords],
      ["Record Completion Rate (%)", analytics.recordCompletionRate],
      ["Total Treatment Goals", analytics.totalGoals],
      ["Completed Goals", analytics.completedGoals],
      ["Goal Completion Rate (%)", analytics.goalCompletionRate],
      ["", ""],
      ["Treatment Duration Distribution", ""],
      ...(analytics.durationDistribution ? Object.entries(analytics.durationDistribution).map(([duration, count]) => [
        duration,
        count
      ]) : []),
      ["", ""],
      ["Monthly Discharge Trends", ""],
      ...(analytics.monthlyDischarges ? Object.entries(analytics.monthlyDischarges).map(([month, count]) => [
        month,
        count
      ]) : [])
    ];

    const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "treatment-completion-report.csv";
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
              <CheckCircle className="h-5 w-5" />
              Treatment Completion Rate
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
          <p className="text-gray-500">No treatment completion data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Treatment Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{analytics.completionRate || 0}%</div>
            <p className="text-xs text-gray-600">
              {analytics.dischargedPatients || 0} of {analytics.totalPatients || 0} patients
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Length of Stay</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageLOS || 0} days</div>
            <p className="text-xs text-gray-600">For discharged patients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Record Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analytics.recordCompletionRate || 0}%</div>
            <p className="text-xs text-gray-600">
              {analytics.completedRecords || 0} of {analytics.totalRecords || 0} records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Completion Rate</CardTitle>
            <Target className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{analytics.goalCompletionRate || 0}%</div>
            <p className="text-xs text-gray-600">
              {analytics.completedGoals || 0} of {analytics.totalGoals || 0} goals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patient Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{analytics.dischargedPatients || 0}</div>
              <div className="text-sm text-gray-600">Discharged</div>
              <div className="text-xs text-gray-500">
                {((analytics.dischargedPatients || 0) / (analytics.totalPatients || 1) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{analytics.activePatients || 0}</div>
              <div className="text-sm text-gray-600">Active</div>
              <div className="text-xs text-gray-500">
                {((analytics.activePatients || 0) / (analytics.totalPatients || 1) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{analytics.inactivePatients || 0}</div>
              <div className="text-sm text-gray-600">Inactive</div>
              <div className="text-xs text-gray-500">
                {((analytics.inactivePatients || 0) / (analytics.totalPatients || 1) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treatment Record Status */}
        <Card>
          <CardHeader>
            <CardTitle>Treatment Record Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { status: "Completed", count: analytics.completedRecords, color: "bg-green-600" },
                { status: "In Progress", count: analytics.inProgressRecords, color: "bg-blue-600" },
                { status: "Pending", count: analytics.pendingRecords, color: "bg-yellow-600" }
              ].map(({ status, count, color }) => {
                const percentage = ((count / analytics.totalRecords) * 100).toFixed(1);
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{status}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${color} h-2 rounded-full`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Treatment Duration Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Treatment Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.durationDistribution && Object.entries(analytics.durationDistribution).map(([duration, count]) => {
                const percentage = ((count / (analytics.treatmentDurations?.total || 1)) * 100).toFixed(1);
                return (
                  <div key={duration} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{duration}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {count} ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
              {(!analytics.durationDistribution || Object.keys(analytics.durationDistribution).length === 0) && (
                <p className="text-gray-500 text-sm">No duration data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Discharge Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Discharge Trends (Last 12 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.monthlyDischarges && Object.entries(analytics.monthlyDischarges)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, count]) => (
                    <div key={month} className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {new Date(month + "-01").toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short' 
                        })}
                      </span>
                      <span className="text-sm text-gray-600">
                        {count} discharges
                      </span>
                    </div>
                  ))}
                {(!analytics.monthlyDischarges || Object.keys(analytics.monthlyDischarges).length === 0) && (
                  <p className="text-gray-500 text-sm">No monthly discharge data available</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Treatment Duration Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Treatment Duration Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.treatmentDurations?.average || 0}
                  </div>
                  <div className="text-sm text-gray-600">Average (days)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.treatmentDurations?.min || 0}
                  </div>
                  <div className="text-sm text-gray-600">Shortest (days)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.treatmentDurations?.max || 0}
                  </div>
                  <div className="text-sm text-gray-600">Longest (days)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics.treatmentDurations?.total || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Discharged</div>
                </div>
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