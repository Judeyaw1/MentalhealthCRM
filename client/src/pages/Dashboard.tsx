import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentPatients } from "@/components/dashboard/RecentPatients";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { Button } from "@/components/ui/button";
import { Download, Plus } from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { DashboardStats } from "@/components/dashboard/StatsCards";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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
  });

  const statsData: DashboardStats = stats ?? {
    totalPatients: 0,
    todayAppointments: 0,
    activeTreatments: 0,
    monthlyRevenue: 0,
    monthlyAppointments: 0,
    completedAppointments: 0,
    upcomingAppointments: 0,
    appointmentsNeedingReview: 0,
  };

  const { data: recentPatients, isLoading: patientsLoading } = useQuery({
    queryKey: ["/api/dashboard/recent-patients"],
    retry: false,
    refetchInterval: 10000,
  });

  const { data: todayAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["/api/dashboard/today-appointments"],
    retry: false,
    refetchInterval: 10000,
  });

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
                  <h1 className="text-2xl font-semibold text-gray-900">Dashboard Overview</h1>
                  <p className="text-gray-600 mt-1">
                    Welcome back. Here's what's happening at your practice today.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Download className="h-4 w-4" />
                    <span>Export Report</span>
                  </Button>
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
              <StatsCards 
                stats={statsData}
                isLoading={statsLoading}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Recent Patients */}
              <div className="lg:col-span-2">
                <RecentPatients 
                  patients={Array.isArray(recentPatients) ? recentPatients : []} 
                  isLoading={patientsLoading}
                  onViewAll={() => {
                    localStorage.setItem('showAllPatients', 'true');
                    window.location.href = "/patients";
                  }}
                />
              </div>

              {/* Today's Schedule */}
              <div>
                <TodaySchedule appointments={Array.isArray(todayAppointments) ? todayAppointments : []} isLoading={appointmentsLoading} />
              </div>
            </div>

            {/* Quick Actions */}
            <QuickActions />
          </div>
        </main>
      </div>
    </div>
  );
}
