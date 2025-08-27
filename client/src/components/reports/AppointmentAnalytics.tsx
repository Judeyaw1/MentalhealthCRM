import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Calendar, Clock, Users, TrendingUp, Activity } from "lucide-react";
import { useState } from "react";

interface AppointmentAnalyticsData {
  totalAppointments: number;
  todayAppointments: number;
  upcomingAppointments: number;
  averageSessionDuration: number;
  noShowRate: number;
  completionRate: number;
  statusDistribution: { [key: string]: number };
  monthlyTrends: { [key: string]: number };
  dayOfWeekDistribution: { [key: string]: number };
  topTimeSlots: { time: string; count: number }[];
  topClinicals: { clinicalId: string; count: number }[];
  sessionTypeDistribution: { [key: string]: number };
  sessionDurations: {
    average: number;
    min: number;
    max: number;
    distribution: { [key: string]: number };
  };
}

export function AppointmentAnalytics() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: analytics, isLoading } = useQuery<AppointmentAnalyticsData>({
    queryKey: ["/api/reports/appointment-analytics"],
    retry: false,
  });

  const handleExport = () => {
    if (!analytics) return;
    
    const csvRows = [
      ["Metric", "Value"],
      ["Total Appointments", analytics.totalAppointments],
      ["Today's Appointments", analytics.todayAppointments],
      ["Upcoming Appointments (30 days)", analytics.upcomingAppointments],
      ["Average Session Duration (minutes)", analytics.averageSessionDuration],
      ["No-Show Rate (%)", analytics.noShowRate],
      ["Completion Rate (%)", analytics.completionRate],
      ["", ""],
      ["Status Distribution", ""],
      ...Object.entries(analytics.statusDistribution).map(([status, count]) => [
        status,
        count
      ]),
      ["", ""],
      ["Day of Week Distribution", ""],
      ...Object.entries(analytics.dayOfWeekDistribution).map(([day, count]) => [
        day,
        count
      ]),
      ["", ""],
      ["Session Type Distribution", ""],
      ...Object.entries(analytics.sessionTypeDistribution).map(([type, count]) => [
        type,
        count
      ]),
      ["", ""],
      ["Top Time Slots", ""],
      ...analytics.topTimeSlots.map(({ time, count }) => [
        time,
        count
      ])
    ];

    const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "appointment-analytics-report.csv";
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
              <Calendar className="h-5 w-5" />
              Appointment Analytics
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
          <p className="text-gray-500">No appointment analytics data available.</p>
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
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalAppointments}</div>
            <p className="text-xs text-gray-600">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.todayAppointments}</div>
            <p className="text-xs text-gray-600">Scheduled for today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.completionRate}%</div>
            <p className="text-xs text-gray-600">Appointments completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
            <Activity className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics.noShowRate}%</div>
            <p className="text-xs text-gray-600">Missed appointments</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Appointment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.statusDistribution).map(([status, count]) => {
                const percentage = ((count / analytics.totalAppointments) * 100).toFixed(1);
                const color = status === "completed" ? "bg-green-600" : 
                             status === "scheduled" ? "bg-blue-600" : 
                             status === "cancelled" ? "bg-yellow-600" : "bg-red-600";
                return (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{status}</span>
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

        {/* Day of Week Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Day of Week Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.dayOfWeekDistribution).map(([day, count]) => {
                const percentage = ((count / analytics.totalAppointments) * 100).toFixed(1);
                return (
                  <div key={day} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{day}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full" 
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

        {/* Session Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Session Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.sessionTypeDistribution).map(([type, count]) => {
                const percentage = ((count / analytics.totalAppointments) * 100).toFixed(1);
                return (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{type}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full" 
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

        {/* Session Duration Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Session Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(analytics.sessionDurations.distribution).map(([duration, count]) => {
                const percentage = ((count / analytics.totalAppointments) * 100).toFixed(1);
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Time Slots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Top Time Slots
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.topTimeSlots.map(({ time, count }) => (
                  <div key={time} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{time}</span>
                    <span className="text-sm text-gray-600">
                      {count} appointments
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Trends (Last 12 Months)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(analytics.monthlyTrends)
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
                        {count} appointments
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {analytics.upcomingAppointments}
                  </div>
                  <div className="text-sm text-gray-600">Upcoming (30 days)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {analytics.averageSessionDuration}
                  </div>
                  <div className="text-sm text-gray-600">Avg Duration (min)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {analytics.sessionDurations.min}
                  </div>
                  <div className="text-sm text-gray-600">Shortest Session</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {analytics.sessionDurations.max}
                  </div>
                  <div className="text-sm text-gray-600">Longest Session</div>
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