// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  FileText,
  Edit,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { AppointmentWithDetails } from "@shared/types";

export default function AppointmentDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Extract appointment ID from URL
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/appointments\/([^\/]+)/);
    if (match) {
      setAppointmentId(match[1]);
    }
  }, []);

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

  // Real-time socket connection for instant updates
  useSocket({
    onAppointmentUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/appointments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/today-appointments'] });
    },
  });

  const {
    data: appointment,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      const response = await fetch(`/api/appointments/${appointmentId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch appointment");
      }
      return response.json();
    },
    enabled: !!appointmentId,
    retry: false,
  });

  // Update appointment status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, newStatus }: { appointmentId: string; newStatus: string }) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        throw new Error("Failed to update appointment status");
      }
      return response.json();
    },
    onSuccess: (_, { newStatus }) => {
      toast({
        title: "Success",
        description: `Appointment marked as ${newStatus} successfully`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/appointments"],
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/today-appointments"],
        exact: false,
      });
    },
    onError: (error) => {
      console.error("Error updating appointment status:", error);
      toast({
        title: "Error",
        description: "Failed to update appointment status",
        variant: "destructive",
      });
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await fetch(`/api/appointments/${appointmentId}/reminder`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to send reminder");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Reminder sent successfully",
      });
    },
    onError: (error) => {
      console.error("Error sending reminder:", error);
      toast({
        title: "Error",
        description: "Failed to send reminder",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="secondary">Scheduled</Badge>;
      case "completed":
        return (
          <Badge className="bg-success-100 text-success-500">Completed</Badge>
        );
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

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase() || "?";
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/appointments")}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Appointments
                </Button>
              </div>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                      Appointment Not Found
                    </h2>
                    <p className="text-gray-600 mb-4">
                      The appointment you're looking for doesn't exist or you
                      don't have permission to view it.
                    </p>
                    <Button onClick={() => setLocation("/appointments")}>
                      Back to Appointments
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isLoading || !appointment) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
              <p className="mt-4 text-gray-600 text-center">
                Loading appointment details...
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
                    onClick={() => setLocation("/appointments")}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Appointment Details
                    </h1>
                    <p className="text-gray-600 mt-1">
                      View comprehensive information about this appointment.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/appointments/${appointment.id}/edit`}>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit Appointment
                    </Button>
                  </Link>
                  {appointment.status === "completed" && (
                    <Link href={`/records?appointmentId=${appointment.id}`}>
                      <Button className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        View Treatment Record
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Appointment Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Appointment Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Appointment Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Status
                        </p>
                        <div className="mt-1">
                          {getStatusBadge(appointment.status)}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Type
                        </p>
                        <p className="mt-1 text-sm text-gray-900 capitalize">
                          {appointment.type.replace("-", " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          Duration
                        </p>
                        <p className="mt-1 text-sm text-gray-900">
                          {appointment.duration} minutes
                        </p>
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">
                        Date & Time
                      </p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDate(appointment.appointmentDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatTime(appointment.appointmentDate)}
                        </span>
                      </div>
                    </div>

                    {appointment.notes && (
                      <div className="border-t pt-4">
                        <p className="text-sm font-medium text-gray-500 mb-2">
                          Notes
                        </p>
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">
                          {appointment.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Patient Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Patient Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarFallback className="bg-primary-100 text-primary-600 text-lg">
                          {getInitials(
                            appointment.patient?.firstName || "",
                            appointment.patient?.lastName || "",
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {appointment.patient?.firstName || "Unknown"}{" "}
                            {appointment.patient?.lastName || "Patient"}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Patient ID: #
                            {appointment.patient?.id
                              ?.toString()
                              .padStart(4, "0") || "0000"}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {appointment.patient?.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {appointment.patient.email}
                              </span>
                            </div>
                          )}
                          {appointment.patient?.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {appointment.patient.phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Therapist Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Assigned Therapist
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {getInitials(
                            appointment.therapist?.firstName || "",
                            appointment.therapist?.lastName || "",
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {appointment.therapist?.firstName || "Unknown"}{" "}
                          {appointment.therapist?.lastName || "Therapist"}
                        </h4>
                        <p className="text-sm text-gray-500">Therapist</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {appointment.status === "scheduled" && (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to mark this appointment as completed?")) {
                              updateStatusMutation.mutate({ 
                                appointmentId: appointment.id, 
                                newStatus: "completed" 
                              });
                            }
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          {updateStatusMutation.isPending ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Mark as Completed
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to cancel this appointment?")) {
                              updateStatusMutation.mutate({ 
                                appointmentId: appointment.id, 
                                newStatus: "cancelled" 
                              });
                            }
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          {updateStatusMutation.isPending ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Cancel Appointment
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setLocation(`/appointments/${appointment.id}/edit?reschedule=true`);
                      }}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        sendReminderMutation.mutate(appointment.id);
                      }}
                      disabled={sendReminderMutation.isPending}
                    >
                      {sendReminderMutation.isPending ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Send Reminder
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        setLocation(`/records?patientId=${appointment.patient?.id}`);
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View Patient Records
                    </Button>
                    {appointment.status === "completed" && (
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => {
                          setLocation(`/records?appointmentId=${appointment.id}`);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        View Treatment Record
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
