import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Clock, Search, Filter } from "lucide-react";
import { Link } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { TreatmentRecordWithDetails } from "@shared/schema";

export default function Records() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState("");

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

  const { data: patients } = useQuery({
    queryKey: ["/api/patients", { limit: 1000 }],
    retry: false,
  });

  const { data: allRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ["/api/records/all"],
    queryFn: async () => {
      // Since we don't have a dedicated endpoint for all records,
      // we'll need to fetch records for each patient individually
      // This is a simplified approach - in production, you'd want a dedicated endpoint
      if (!patients?.patients) return [];
      
      const recordPromises = patients.patients.map(async (patient) => {
        try {
          const response = await fetch(`/api/patients/${patient.id}/records`, {
            credentials: "include",
          });
          if (response.ok) {
            return response.json();
          }
          return [];
        } catch {
          return [];
        }
      });
      
      const recordsArrays = await Promise.all(recordPromises);
      return recordsArrays.flat();
    },
    retry: false,
    enabled: !!patients?.patients?.length,
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDateTime = (date: string | Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const filteredRecords = allRecords?.filter((record: TreatmentRecordWithDetails) => {
    const matchesSearch = !searchQuery || 
      `${record.patient.firstName} ${record.patient.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.sessionType.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPatient = !selectedPatient || record.patient.id.toString() === selectedPatient;
    
    return matchesSearch && matchesPatient;
  }) || [];

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
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Treatment Records</h1>
                  <p className="text-gray-600 mt-1">
                    View and manage patient treatment documentation.
                  </p>
                </div>
                <Link href="/records/new">
                  <Button className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>New Record</span>
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                  <FileText className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading ? "..." : allRecords?.length || 0}
                  </div>
                  <p className="text-xs text-gray-600">
                    All treatment records
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">This Week</CardTitle>
                  <Clock className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading ? "..." : 
                      allRecords?.filter((record: TreatmentRecordWithDetails) => {
                        const recordDate = new Date(record.sessionDate);
                        const weekAgo = new Date();
                        weekAgo.setDate(weekAgo.getDate() - 7);
                        return recordDate >= weekAgo;
                      }).length || 0
                    }
                  </div>
                  <p className="text-xs text-gray-600">
                    Recent records
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
                  <FileText className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recordsLoading ? "..." : 
                      new Set(allRecords?.map((record: TreatmentRecordWithDetails) => record.patient.id)).size || 0
                    }
                  </div>
                  <p className="text-xs text-gray-600">
                    With records
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by patient name or session type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue placeholder="Filter by patient" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Patients</SelectItem>
                      {patients?.patients?.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id.toString()}>
                          {patient.firstName} {patient.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Records List */}
            <div className="space-y-4">
              {recordsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          <div className="h-20 bg-gray-200 rounded"></div>
                        </div>
                        <div className="h-6 bg-gray-200 rounded w-20"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : filteredRecords.length > 0 ? (
                filteredRecords.map((record: TreatmentRecordWithDetails) => (
                  <Card key={record.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary-100 text-primary-600">
                            {getInitials(record.patient.firstName, record.patient.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {record.patient.firstName} {record.patient.lastName}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {record.sessionType} • {formatDateTime(record.sessionDate)}
                              </p>
                            </div>
                            <Badge variant="outline">
                              {record.therapist.firstName} {record.therapist.lastName}
                            </Badge>
                          </div>
                          
                          {record.goals && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Session Goals</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{record.goals}</p>
                            </div>
                          )}
                          
                          {record.notes && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Session Notes</h4>
                              <p className="text-sm text-gray-600 line-clamp-3">{record.notes}</p>
                            </div>
                          )}
                          
                          {record.progress && (
                            <div className="mb-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Progress</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{record.progress}</p>
                            </div>
                          )}
                          
                          {record.planForNextSession && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 mb-1">Next Session Plan</h4>
                              <p className="text-sm text-gray-600 line-clamp-2">{record.planForNextSession}</p>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Link href={`/patients/${record.patient.id}`}>
                            <Button variant="ghost" size="sm">
                              View Patient
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Treatment Records Found</h3>
                    <p className="text-gray-600 mb-4">
                      {searchQuery || selectedPatient 
                        ? "No records match your current filters."
                        : "Start documenting patient sessions by creating your first treatment record."
                      }
                    </p>
                    <Link href="/records/new">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Record
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
