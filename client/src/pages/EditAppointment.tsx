// @ts-nocheck
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Calendar, Clock } from "lucide-react";
import { useLocation } from "wouter";
import type { AppointmentWithDetails } from "@shared/schema";

export default function EditAppointment() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    appointmentDate: "",
    appointmentTime: "",
    duration: 60,
    type: "therapy-session",
    status: "scheduled",
    notes: "",
    patientId: "",
    therapistId: "",
  });

  // Extract appointment ID from URL
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/appointments\/([^\/]+)\/edit/);
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
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch appointment data
  const { data: appointment, isLoading: appointmentLoading } = useQuery({
    queryKey: ["/api/appointments", appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null;
      const response = await fetch(`/api/appointments/${appointmentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch appointment');
      }
      return response.json();
    },
    enabled: !!appointmentId,
    retry: false,
  });

  // Fetch patients for dropdown
  const { data: patientsData } = useQuery({
    queryKey: ["/api/patients"],
    queryFn: async () => {
      const response = await fetch("/api/patients");
      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }
      return response.json();
    },
    retry: false,
  });

  // Fetch therapists for dropdown
  const { data: therapistsData } = useQuery({
    queryKey: ["/api/therapists"],
    queryFn: async () => {
      const response = await fetch("/api/therapists");
      if (!response.ok) {
        throw new Error('Failed to fetch therapists');
      }
      return response.json();
    },
    retry: false,
  });

  // Update form data when appointment is loaded
  useEffect(() => {
    if (appointment) {
      const appointmentDate = new Date(appointment.appointmentDate);
      setFormData({
        appointmentDate: appointmentDate.toISOString().split('T')[0],
        appointmentTime: appointmentDate.toTimeString().slice(0, 5),
        duration: appointment.duration,
        type: appointment.type,
        status: appointment.status,
        notes: appointment.notes || "",
        patientId: appointment.patient?.id || "",
        therapistId: appointment.therapist?.id || "",
      });
    }
  }, [appointment]);

  // Update appointment mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update appointment');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Appointment updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"], exact: false });
      setLocation(`/appointments/${appointmentId}`);
    },
    onError: (error) => {
      console.error('Error updating appointment:', error);
      toast({
        title: "Error",
        description: "Failed to update appointment",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);
    
    const updateData = {
      appointmentDate: appointmentDateTime.toISOString(),
      duration: formData.duration,
      type: formData.type,
      status: formData.status,
      notes: formData.notes,
      patientId: formData.patientId,
      therapistId: formData.therapistId,
    };

    updateMutation.mutate(updateData);
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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

  if (appointmentLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500 mx-auto"></div>
              <p className="mt-4 text-gray-600 text-center">Loading appointment details...</p>
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
              <div className="flex items-center gap-2 mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLocation(`/appointments/${appointmentId}`)}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Edit Appointment</h1>
                  <p className="text-gray-600 mt-1">
                    Update appointment details and scheduling information.
                  </p>
                </div>
              </div>
            </div>

            <div className="max-w-2xl">
              <Card>
                <CardHeader>
                  <CardTitle>Appointment Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Patient Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="patientId">Patient</Label>
                      <Select 
                        value={formData.patientId} 
                        onValueChange={(value) => handleInputChange('patientId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a patient" />
                        </SelectTrigger>
                        <SelectContent>
                          {patientsData?.patients?.map((patient: any) => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.firstName} {patient.lastName} (#{patient.id.toString().padStart(4, '0')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Therapist Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="therapistId">Therapist</Label>
                      <Select 
                        value={formData.therapistId} 
                        onValueChange={(value) => handleInputChange('therapistId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a therapist" />
                        </SelectTrigger>
                        <SelectContent>
                          {therapistsData?.map((therapist: any) => (
                            <SelectItem key={therapist.id} value={therapist.id}>
                              {therapist.firstName} {therapist.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="appointmentDate">Date</Label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="appointmentDate"
                            type="date"
                            value={formData.appointmentDate}
                            onChange={(e) => handleInputChange('appointmentDate', e.target.value)}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="appointmentTime">Time</Label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            id="appointmentTime"
                            type="time"
                            value={formData.appointmentTime}
                            onChange={(e) => handleInputChange('appointmentTime', e.target.value)}
                            className="pl-10"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Duration and Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (minutes)</Label>
                        <Select 
                          value={formData.duration.toString()} 
                          onValueChange={(value) => handleInputChange('duration', parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 minutes</SelectItem>
                            <SelectItem value="45">45 minutes</SelectItem>
                            <SelectItem value="60">60 minutes</SelectItem>
                            <SelectItem value="90">90 minutes</SelectItem>
                            <SelectItem value="120">120 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="type">Appointment Type</Label>
                        <Select 
                          value={formData.type} 
                          onValueChange={(value) => handleInputChange('type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="therapy-session">Therapy Session</SelectItem>
                            <SelectItem value="consultation">Consultation</SelectItem>
                            <SelectItem value="group-therapy">Group Therapy</SelectItem>
                            <SelectItem value="intake">Intake</SelectItem>
                            <SelectItem value="follow-up">Follow-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select 
                        value={formData.status} 
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no-show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        placeholder="Add any notes about this appointment..."
                        rows={4}
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex gap-3 pt-4">
                      <Button 
                        type="submit" 
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        {updateMutation.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setLocation(`/appointments/${appointmentId}`)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
} 