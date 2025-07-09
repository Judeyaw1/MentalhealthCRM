import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Calendar,
  TrendingUp,
  AlertCircle,
  FileText,
  Download,
  Upload,
  Search,
  Filter,
} from "lucide-react";
import { Link } from "wouter";
import type { PatientWithTherapist } from "@shared/schema";

interface PatientDashboardProps {
  patientCount?: number;
  todayAppointments?: number;
}

export function PatientDashboard({
  patientCount = 0,
  todayAppointments = 0,
}: PatientDashboardProps) {
  const { toast } = useToast();
  const { data: recentPatients = [] } = useQuery<PatientWithTherapist[]>({
    queryKey: ["/api/dashboard/recent-patients"],
    retry: false,
  });

  const { data: todayAppointmentsData = [] } = useQuery<any[]>({
    queryKey: ["/api/dashboard/today-appointments"],
    retry: false,
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-gray-100 text-gray-800";
      case "discharged":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Total Patients
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {patientCount}
                </p>
              </div>
              <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-primary-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Today's Appointments
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {todayAppointments}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Active Patients
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {recentPatients?.filter(
                    (p: PatientWithTherapist) => p.status === "active",
                  ).length || 0}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Pending Records
                </p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/patients/new">
          <Button className="w-full h-16 flex flex-col items-center justify-center space-y-2 bg-primary-500 hover:bg-primary-600">
            <UserPlus className="h-6 w-6" />
            <span className="text-sm font-medium">New Patient</span>
          </Button>
        </Link>

        <Link href="/appointments/new">
          <Button
            variant="outline"
            className="w-full h-16 flex flex-col items-center justify-center space-y-2"
          >
            <Calendar className="h-6 w-6" />
            <span className="text-sm font-medium">Schedule Appointment</span>
          </Button>
        </Link>

        <Button
          variant="outline"
          className="w-full h-16 flex flex-col items-center justify-center space-y-2"
          onClick={async () => {
            try {
              const response = await fetch("/api/sample-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
              });
              if (response.ok) {
                toast({
                  title: "Success",
                  description: "Sample data created successfully!",
                });
                window.location.reload();
              } else {
                toast({
                  title: "Error",
                  description: "Failed to create sample data",
                  variant: "destructive",
                });
              }
            } catch (error) {
              console.error("Error creating sample data:", error);
              toast({
                title: "Error",
                description: "Failed to create sample data",
                variant: "destructive",
              });
            }
          }}
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm font-medium">Create Sample Data</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Patients */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>Recent Patients</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentPatients && recentPatients.length > 0 ? (
                recentPatients
                  .slice(0, 5)
                  .map((patient: PatientWithTherapist) => (
                    <div
                      key={patient.id}
                      className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary-100 text-primary-600">
                          {getInitials(patient.firstName, patient.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <Badge
                            className={`text-xs ${getStatusColor(patient.status)}`}
                          >
                            {patient.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {patient.email || "No email"}
                        </p>
                      </div>
                      <Link href={`/patients/${patient.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No patients yet</p>
                  <Link href="/patients/new">
                    <Button className="mt-2" size="sm">
                      Add First Patient
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Today's Appointments</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todayAppointmentsData && todayAppointmentsData.length > 0 ? (
                todayAppointmentsData.slice(0, 5).map((appointment: any) => (
                  <div
                    key={appointment.id}
                    className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-50"
                  >
                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {appointment.patient?.firstName}{" "}
                        {appointment.patient?.lastName}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {new Date(
                          appointment.appointmentDate,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        - {appointment.type}
                      </p>
                    </div>
                    <Badge
                      variant={
                        appointment.status === "scheduled"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No appointments today</p>
                  <Link href="/appointments/new">
                    <Button className="mt-2" size="sm">
                      Schedule Appointment
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Patient Status Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">
                {recentPatients?.filter(
                  (p: PatientWithTherapist) => p.status === "active",
                ).length || 0}
              </p>
              <p className="text-sm text-gray-600">Active Patients</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-2xl font-bold text-gray-600">
                {recentPatients?.filter(
                  (p: PatientWithTherapist) => p.status === "inactive",
                ).length || 0}
              </p>
              <p className="text-sm text-gray-600">Inactive Patients</p>
            </div>
            <div className="text-center">
              <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-600">
                {recentPatients?.filter(
                  (p: PatientWithTherapist) => p.status === "discharged",
                ).length || 0}
              </p>
              <p className="text-sm text-gray-600">Discharged Patients</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
