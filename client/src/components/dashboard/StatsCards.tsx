import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  Calendar,
  Heart,
  CheckCircle,
  ArrowUp,
  Clock,
} from "lucide-react";

export interface DashboardStats {
  totalPatients: number;
  todayAppointments: number;
  activeTreatments: number;
  treatmentCompletionRate: number;
  treatmentCompletionBreakdown?: {
    manuallyDischarged: number;
    autoDischarged: number;
    eligibleForDischarge: number;
  };
  monthlyAppointments: number;
  completedAppointments: number;
  upcomingAppointments: number;
  appointmentsNeedingReview: number;
  archivedPatients?: number;
}

interface StatsCardsProps {
  stats: DashboardStats;
  isLoading?: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const dischargedCount = stats.treatmentCompletionBreakdown
    ? (stats.treatmentCompletionBreakdown.manuallyDischarged || 0) + (stats.treatmentCompletionBreakdown.autoDischarged || 0)
    : 0;

  const statCards = [
    {
      title: "Total Patients",
      value: stats.totalPatients,
      change: `+${stats.monthlyAppointments} this month`,
      changeType: "positive" as const,
      icon: Users,
      iconBg: "bg-primary-50",
      iconColor: "text-primary-500",
    },
    {
      title: "Today's Appointments",
      value: stats.todayAppointments,
      change: `${stats.completedAppointments} completed, ${stats.upcomingAppointments} upcoming`,
      changeType: "neutral" as const,
      icon: Calendar,
      iconBg: "bg-success-100",
      iconColor: "text-success-500",
    },
    {
      title: "Active Treatments",
      value: stats.activeTreatments,
      change: `${stats.appointmentsNeedingReview} need review`,
      changeType: "warning" as const,
      icon: Heart,
      iconBg: "bg-warning-100",
      iconColor: "text-warning-500",
    },
    {
      title: "Discharged Patients",
      value: dischargedCount,
      change: "Total discharged",
      changeType: "neutral" as const,
      icon: Users,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      title: "Treatment Completion Rate",
      value: `${stats.treatmentCompletionRate}%`,
      change: stats.treatmentCompletionBreakdown 
        ? `${stats.treatmentCompletionBreakdown.autoDischarged} auto, ${stats.treatmentCompletionBreakdown.manuallyDischarged} manual`
        : "Patients who completed treatment",
      changeType: "positive" as const,
      icon: CheckCircle,
      iconBg: "bg-green-50",
      iconColor: "text-green-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 w-full">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-semibold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                  <p
                    className={`text-sm mt-1 flex items-center ${
                      stat.changeType === "positive"
                        ? "text-success-500"
                        : stat.changeType === "warning"
                          ? "text-warning-500"
                          : "text-gray-500"
                    }`}
                  >
                    {stat.changeType === "positive" && (
                      <ArrowUp className="h-3 w-3 mr-1" />
                    )}
                    {stat.changeType === "warning" && (
                      <Clock className="h-3 w-3 mr-1" />
                    )}
                    {stat.change}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}
                >
                  <Icon className={`${stat.iconColor} h-6 w-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
