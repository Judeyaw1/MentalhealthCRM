import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import type { AppointmentWithDetails } from "@shared/types";

interface TodayScheduleProps {
  appointments: AppointmentWithDetails[];
  isLoading?: boolean;
}

export function TodaySchedule({ appointments, isLoading }: TodayScheduleProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            Today's Schedule
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg animate-pulse"
              >
                <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="text-right space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success-500";
      case "scheduled":
        return "bg-gray-400";
      case "in-progress":
        return "bg-primary-500";
      case "cancelled":
        return "bg-error-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-success-100 text-success-500">Completed</Badge>
        );
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "cancelled":
        return <Badge className="bg-error-100 text-error-500">Cancelled</Badge>;
      case "no-show":
        return (
          <Badge className="bg-warning-100 text-warning-500">No Show</Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">
          Today's Schedule
        </h2>
      </CardHeader>

      <CardContent>
        {appointments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">
              No appointments scheduled for today.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div
                  className={`w-3 h-3 ${getStatusColor(appointment.status)} rounded-full`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {appointment.patient.firstName}{" "}
                    {appointment.patient.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{appointment.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {formatTime(appointment.appointmentDate)}
                  </p>
                  {getStatusBadge(appointment.status)}
                </div>
              </div>
            ))}

            <Link href="/appointments">
              <Button variant="outline" className="w-full mt-4">
                View Full Schedule
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
