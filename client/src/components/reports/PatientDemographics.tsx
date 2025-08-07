import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, Calendar, MapPin, CreditCard, Activity } from "lucide-react";
import { useState } from "react";

interface DemographicsData {
  totalPatients: number;
  averageAge: number;
  averageTreatmentDuration: number;
  ageGroups: { [key: string]: number };
  genderDistribution: { [key: string]: number };
  locDistribution: { [key: string]: number };
  statusDistribution: { [key: string]: number };
  topInsuranceProviders: { provider: string; count: number }[];
  topGeographicAreas: { area: string; count: number }[];
  treatmentDurations: {
    average: number;
    min: number;
    max: number;
    distribution: { [key: string]: number };
  };
}

export function PatientDemographics() {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: demographics, isLoading } = useQuery<DemographicsData>({
    queryKey: ["/api/reports/demographics"],
    retry: false,
  });

  const handleExport = () => {
    if (!demographics) return;
    
    const csvRows = [
      ["Demographic", "Count", "Percentage"],
      ["Total Patients", demographics.totalPatients, "100%"],
      ["Average Age", demographics.averageAge, ""],
      ["Average Treatment Duration (days)", demographics.averageTreatmentDuration, ""],
      ["", "", ""],
      ["Age Groups", "", ""],
      ...Object.entries(demographics.ageGroups).map(([age, count]) => [
        age,
        count,
        `${((count / demographics.totalPatients) * 100).toFixed(1)}%`
      ]),
      ["", "", ""],
      ["Gender Distribution", "", ""],
      ...Object.entries(demographics.genderDistribution).map(([gender, count]) => [
        gender,
        count,
        `${((count / demographics.totalPatients) * 100).toFixed(1)}%`
      ]),
      ["", "", ""],
      ["Level of Care", "", ""],
      ...Object.entries(demographics.locDistribution).map(([loc, count]) => [
        loc,
        count,
        `${((count / demographics.totalPatients) * 100).toFixed(1)}%`
      ]),
      ["", "", ""],
      ["Status Distribution", "", ""],
      ...Object.entries(demographics.statusDistribution).map(([status, count]) => [
        status,
        count,
        `${((count / demographics.totalPatients) * 100).toFixed(1)}%`
      ]),
      ["", "", ""],
      ["Top Insurance Providers", "", ""],
      ...demographics.topInsuranceProviders.map(({ provider, count }) => [
        provider,
        count,
        `${((count / demographics.totalPatients) * 100).toFixed(1)}%`
      ])
    ];

    const csvContent = csvRows.map(row => row.map(field => `"${field}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "patient-demographics-report.csv";
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
              Patient Demographics
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

  if (!demographics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-gray-500">No demographics data available.</p>
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
            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographics.totalPatients}</div>
            <p className="text-xs text-gray-600">All registered patients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Age</CardTitle>
            <Calendar className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographics.averageAge}</div>
            <p className="text-xs text-gray-600">Years old</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Treatment Duration</CardTitle>
            <Activity className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographics.averageTreatmentDuration}</div>
            <p className="text-xs text-gray-600">Days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{demographics.statusDistribution.active}</div>
            <p className="text-xs text-gray-600">
              {((demographics.statusDistribution.active / demographics.totalPatients) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Age Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(demographics.ageGroups).map(([age, count]) => {
                const percentage = ((count / demographics.totalPatients) * 100).toFixed(1);
                return (
                  <div key={age} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{age}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
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

        {/* Gender Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(demographics.genderDistribution).map(([gender, count]) => {
                const percentage = ((count / demographics.totalPatients) * 100).toFixed(1);
                return (
                  <div key={gender} className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">{gender}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
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

        {/* Level of Care Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Level of Care Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(demographics.locDistribution).map(([loc, count]) => {
                const percentage = ((count / demographics.totalPatients) * 100).toFixed(1);
                return (
                  <div key={loc} className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {loc === "unassigned" ? "Unassigned" : `Level ${loc}`}
                    </span>
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

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(demographics.statusDistribution).map(([status, count]) => {
                const percentage = ((count / demographics.totalPatients) * 100).toFixed(1);
                const color = status === "active" ? "bg-green-600" : 
                             status === "inactive" ? "bg-yellow-600" : "bg-red-600";
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
      </div>

      {/* Insurance and Geographic Data */}
      {isExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Insurance Providers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Top Insurance Providers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demographics.topInsuranceProviders.map(({ provider, count }) => (
                  <div key={provider} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{provider}</span>
                    <span className="text-sm text-gray-600">
                      {count} patients
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Geographic Areas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Top Geographic Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {demographics.topGeographicAreas.map(({ area, count }) => (
                  <div key={area} className="flex items-center justify-between">
                    <span className="text-sm font-medium">Area {area}</span>
                    <span className="text-sm text-gray-600">
                      {count} patients
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Treatment Duration Distribution */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Treatment Duration Distribution (Discharged Patients)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {demographics.treatmentDurations.distribution["0-30 days"]}
                  </div>
                  <div className="text-sm text-gray-600">0-30 days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {demographics.treatmentDurations.distribution["31-60 days"]}
                  </div>
                  <div className="text-sm text-gray-600">31-60 days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {demographics.treatmentDurations.distribution["61-90 days"]}
                  </div>
                  <div className="text-sm text-gray-600">61-90 days</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {demographics.treatmentDurations.distribution["90+ days"]}
                  </div>
                  <div className="text-sm text-gray-600">90+ days</div>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                Average: {demographics.averageTreatmentDuration} days | 
                Range: {demographics.treatmentDurations.min} - {demographics.treatmentDurations.max} days
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