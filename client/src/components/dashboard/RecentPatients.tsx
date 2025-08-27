import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, Edit, FileText } from "lucide-react";
import { Link } from "wouter";
import type { PatientWithClinical } from "@shared/types";

interface RecentPatientsProps {
  patients: PatientWithClinical[];
  isLoading?: boolean;
  onViewAll?: () => void;
  onPatientClick?: (patient: PatientWithClinical) => void;
  onGenerateReport?: (patient: PatientWithClinical) => void;
}

export function RecentPatients({
  patients,
  isLoading,
  onViewAll,
  onPatientClick,
  onGenerateReport,
}: RecentPatientsProps) {
  console.log("RecentPatients render:", {
    patients: patients.length,
    isLoading,
    hasOnViewAll: !!onViewAll,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Patients
            </h2>
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg animate-pulse"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-success-100 text-success-500">Active</Badge>
        );
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      case "discharged":
        return <Badge variant="outline">Discharged</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Patients</h3>
          {onViewAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewAll}
              className="text-primary-600 hover:text-primary-700"
            >
              View All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {patients.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No recent patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Visit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {patients.map((patient) => {
                  console.log(
                    "Patient ID in RecentPatients:",
                    patient.id,
                    typeof patient.id,
                    "Full patient:",
                    patient,
                  );
                  return (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary-100 text-primary-600">
                              {getInitials(patient.firstName, patient.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {patient.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.updatedAt
                          ? new Date(patient.updatedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(patient.status)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <Link href={`/patients/${patient.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link
                          href={`/patients/${patient.id}/edit`}
                          onClick={() =>
                            console.log(
                              "Edit link clicked, URL:",
                              `/patients/${patient.id}/edit`,
                            )
                          }
                        >
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        {onGenerateReport && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onGenerateReport(patient)}
                            className="h-6 w-6 p-0"
                            title="Generate Report"
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
