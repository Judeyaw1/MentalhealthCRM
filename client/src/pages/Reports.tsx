// @ts-nocheck
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

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
        "Therapist productivity, caseload distribution, and efficiency metrics",
      icon: Activity,
      color: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
      metric: "Coming soon",
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

            {/* Report Categories */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {reportCards.map((report, index) => {
                const Icon = report.icon;

                return (
                  <Card
                    key={index}
                    className="hover:shadow-lg transition-shadow cursor-pointer"
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
                              Generate
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
    </div>
  );
}
