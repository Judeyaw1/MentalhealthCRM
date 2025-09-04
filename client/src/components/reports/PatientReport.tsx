import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, FileText, TrendingUp, Target, User, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import PDFService from '@/lib/pdfService';

interface PatientReportData {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    email: string;
    phone: string;
    address: string;
    insurance: string;
    reasonForVisit: string;
    authNumber: string;
    loc: string;
    status: string;
    hipaaConsent: boolean;
    important: boolean;
    createdAt: string;
    dischargeCriteria?: {
      targetSessions?: number;
      targetDate?: string;
      autoDischarge?: boolean;
      dischargeReason?: string;
      dischargeDate?: string;
    };
    assignedClinical?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    status: string;
    notes?: string;
    clinical: {
      firstName: string;
      lastName: string;
    };
  }>;
  treatmentRecords: Array<{
    id: string;
    assessmentDate: string;
    symptoms: string[];
    moodScore: number;
    anxietyScore: number;
    depressionScore: number;
    functionalScore: number;
    riskLevel: string;
    notes: string;
    clinical: {
      firstName: string;
      lastName: string;
    };
  }>;
  treatmentOutcomes: Array<{
    id: string;
    assessmentDate: string;
    symptomScores: {
      anxiety: number;
      depression: number;
      stress: number;
      sleep: number;
      social: number;
    };
    moodRating: number;
    goalAchievement: number;
    functionalImprovement: number;
    notes: string;
  }>;
  dischargeRequests: Array<{
    id: string;
    requestDate: string;
    status: string;
    reason: string;
    requestedBy: {
      firstName: string;
      lastName: string;
    };
  }>;
  patientNotes: Array<{
    id: string;
    date: string;
    note: string;
    author: {
      firstName: string;
      lastName: string;
    };
    type: string;
  }>;
  statistics: {
    totalSessions: number;
    attendanceRate: number;
    averageMoodScore: number;
    averageAnxietyScore: number;
    averageDepressionScore: number;
    goalAchievementRate: number;
    functionalImprovementRate: number;
  };
}

interface PatientReportProps {
  patientId: string;
  onClose?: () => void;
}

const PatientReport: React.FC<PatientReportProps> = ({ patientId, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: reportData, isLoading, error } = useQuery({
    queryKey: [`/api/patients/${patientId}/report`],
    queryFn: async () => {
      console.log('🔍 Fetching report for patient ID:', patientId);
      const response = await fetch(`/api/patients/${patientId}/report`, {
        credentials: 'include'
      });
      console.log('🔍 Report API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 Report API error:', errorText);
        throw new Error(`Failed to fetch patient report: ${response.status} ${errorText}`);
      }
      return response.json() as Promise<PatientReportData>;
    },
    enabled: !!patientId,
  });

  const generatePDF = async () => {
    if (!reportData || !reportRef.current) return;
    
    setIsGeneratingPDF(true);
    try {
      await PDFService.generatePatientReport(reportData);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Generating comprehensive patient report...</p>
        </div>
      </div>
    );
  }

  if (error || !reportData) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Report</h3>
        <p className="text-muted-foreground mb-4">
          {error?.message || 'Failed to load patient report data'}
        </p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const { patient, appointments, treatmentRecords, treatmentOutcomes, dischargeRequests, patientNotes, statistics } = reportData;

  // Debug logging for discharge date
  console.log("🔍 PatientReport - Received patient data:", {
    patientId: patient.id,
    status: patient.status,
    dischargeDate: patient.dischargeCriteria?.dischargeDate,
    dischargeDateType: typeof patient.dischargeCriteria?.dischargeDate,
    hasDischargeDate: !!patient.dischargeCriteria?.dischargeDate,
    fullPatient: patient
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'discharged': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div ref={reportRef} className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Patient Report: {patient.firstName} {patient.lastName}
          </h1>
          <p className="text-gray-600 mt-2">
            Comprehensive treatment and progress report
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Generated on {format(new Date(), 'MMMM dd, yyyy')} at {format(new Date(), 'HH:mm')}
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isGeneratingPDF ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generating PDF...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </>
            )}
          </Button>
          <Button
            onClick={() => PDFService.exportAsJSON(reportData, `patient-report-${patient.firstName}-${patient.lastName}`)}
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50"
          >
            Export JSON
          </Button>
          <Button
            onClick={() => window.print()}
            variant="outline"
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            Print Report
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Patient Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Personal Details</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {patient.firstName} {patient.lastName}</p>
                <p><span className="font-medium">Date of Birth:</span> {format(new Date(patient.dateOfBirth), 'MMM dd, yyyy')}</p>
                <p><span className="font-medium">Gender:</span> {patient.gender}</p>
                <p><span className="font-medium">Status:</span> 
                  <Badge className={`ml-2 ${getStatusColor(patient.status)}`}>
                    {patient.status}
                  </Badge>
                </p>
                <p><span className="font-medium">Registration Date:</span> {format(new Date(patient.createdAt), 'MMM dd, yyyy')}</p>
                {patient.dischargeCriteria?.dischargeDate && (
                  <p><span className="font-medium">Discharge Date:</span> {format(new Date(patient.dischargeCriteria.dischargeDate), 'MMM dd, yyyy')}</p>
                )}
                {patient.status === 'discharged' && !patient.dischargeCriteria?.dischargeDate && (
                  <p><span className="font-medium">Discharge Date:</span> <span className="text-gray-500">Not recorded</span></p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Contact Information</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Email:</span> {patient.email}</p>
                <p><span className="font-medium">Phone:</span> {patient.phone}</p>
                <p><span className="font-medium">Address:</span> {patient.address}</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Clinical Information</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Insurance:</span> {patient.insurance?.provider || "Not specified"}</p>
                <p><span className="font-medium">Auth Number:</span> {patient.authNumber}</p>
                <p><span className="font-medium">Level of Care:</span> {patient.loc}</p>
                <p><span className="font-medium">Reason for Visit:</span> {patient.reasonForVisit}</p>
              </div>
            </div>
          </div>
          {patient.assignedClinical && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="font-semibold text-gray-700 mb-2">Assigned Clinical</h4>
              <p className="text-sm">
                {patient.assignedClinical.firstName} {patient.assignedClinical.lastName} 
                ({patient.assignedClinical.email})
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="records">Treatment Records</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Sessions</p>
                    <p className="text-2xl font-bold">{statistics.totalSessions}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                    <p className="text-2xl font-bold">{statistics.attendanceRate}%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Goal Achievement</p>
                    <p className="text-2xl font-bold">{statistics.goalAchievementRate}%</p>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Functional Improvement</p>
                    <p className="text-2xl font-bold">{statistics.functionalImprovementRate}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Charts */}
          <Card>
            <CardHeader>
              <CardTitle>Symptom Score Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Mood Score</span>
                    <span className="text-sm text-gray-600">{statistics.averageMoodScore}/10</span>
                  </div>
                  <Progress value={statistics.averageMoodScore * 10} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Anxiety Score</span>
                    <span className="text-sm text-gray-600">{statistics.averageAnxietyScore}/10</span>
                  </div>
                  <Progress value={statistics.averageAnxietyScore * 10} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Depression Score</span>
                    <span className="text-sm text-gray-600">{statistics.averageDepressionScore}/10</span>
                  </div>
                  <Progress value={statistics.averageDepressionScore * 10} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointments.slice(0, 3).map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="font-medium">
                          {format(new Date(appointment.date), 'MMM dd, yyyy')} at {appointment.time}
                        </p>
                        <p className="text-sm text-gray-600">
                          {appointment.clinical.firstName} {appointment.clinical.lastName}
                        </p>
                      </div>
                    </div>
                    <Badge variant={appointment.status === 'completed' ? 'default' : 'secondary'}>
                      {appointment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          {/* Treatment Outcomes */}
          <Card>
            <CardHeader>
              <CardTitle>Treatment Outcomes Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {treatmentOutcomes.map((outcome, index) => (
                  <div key={outcome.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold">
                        Assessment {treatmentOutcomes.length - index}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(outcome.assessmentDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Symptom Scores</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Anxiety:</span>
                            <span className="font-medium">{outcome.symptomScores.anxiety}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Depression:</span>
                            <span className="font-medium">{outcome.symptomScores.depression}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Stress:</span>
                            <span className="font-medium">{outcome.symptomScores.stress}/10</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Progress Metrics</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Mood Rating:</span>
                            <span className="font-medium">{outcome.moodRating}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Goal Achievement:</span>
                            <span className="font-medium">{outcome.goalAchievement}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Functional Improvement:</span>
                            <span className="font-medium">{outcome.functionalImprovement}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {outcome.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm text-gray-600">{outcome.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appointment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">
                            {format(new Date(appointment.date), 'EEEE, MMMM dd, yyyy')}
                          </span>
                          <span className="text-gray-500">at {appointment.time}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Clinical: {appointment.clinical.firstName} {appointment.clinical.lastName}
                        </p>
                        {appointment.notes && (
                          <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                            {appointment.notes}
                          </p>
                        )}
                      </div>
                      <Badge variant={appointment.status === 'completed' ? 'default' : 'secondary'}>
                        {appointment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Treatment Records Tab */}
        <TabsContent value="records" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Treatment Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {treatmentRecords.map((record, index) => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold">
                        Assessment {treatmentRecords.length - index}
                      </h4>
                      <span className="text-sm text-gray-500">
                        {format(new Date(record.assessmentDate), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Symptom Scores</h5>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Mood Score:</span>
                            <span className="font-medium">{record.moodScore}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Anxiety Score:</span>
                            <span className="font-medium">{record.anxietyScore}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Depression Score:</span>
                            <span className="font-medium">{record.depressionScore}/10</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Functional Score:</span>
                            <span className="font-medium">{record.functionalScore}/10</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Assessment Details</h5>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Risk Level:</span>
                            <Badge className={`ml-2 ${getRiskLevelColor(record.riskLevel)}`}>
                              {record.riskLevel}
                            </Badge>
                          </div>
                          <div>
                                                          <span className="font-medium">Clinical:</span>
                            <p className="text-gray-600">
                              {record.clinical.firstName} {record.clinical.lastName}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {record.symptoms.length > 0 && (
                      <div className="mb-3">
                        <h5 className="font-medium text-gray-700 mb-2">Symptoms</h5>
                        <div className="flex flex-wrap gap-2">
                          {record.symptoms.map((symptom, idx) => (
                            <Badge key={idx} variant="outline">
                              {symptom}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {record.notes && (
                      <div className="pt-3 border-t">
                        <h5 className="font-medium text-gray-700 mb-2">Clinical Notes</h5>
                        <p className="text-sm text-gray-600">{record.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Notes & Observations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patientNotes.map((note) => (
                  <div key={note.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {note.author.firstName} {note.author.lastName}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {note.type}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-500">
                        {format(new Date(note.date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{note.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Discharge Requests */}
          {dischargeRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Discharge Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dischargeRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium mb-1">
                            Requested by {request.requestedBy.firstName} {request.requestedBy.lastName}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            {format(new Date(request.requestDate), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-sm text-gray-700">{request.reason}</p>
                        </div>
                        <Badge variant={request.status === 'approved' ? 'default' : 'secondary'}>
                          {request.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-6 border-t">
        <p>This report was generated for professional use only.</p>
        <p>Confidentiality and privacy of patient information must be maintained at all times.</p>
      </div>

      {/* Print Header - Only visible when printing */}
      <div className="hidden print:block print:fixed print:top-0 print:left-0 print:right-0 print:bg-white print:border-b print:p-4 print:z-50">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">
            {patient.firstName} {patient.lastName} - Patient Report
          </h1>
          <p className="text-sm text-gray-600">
            Generated on {format(new Date(), 'MMMM dd, yyyy')} at {format(new Date(), 'HH:mm')}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Mental Health Tracker System - Confidential
          </p>
        </div>
      </div>

      {/* Print Footer - Only visible when printing */}
      <div className="hidden print:block print:fixed print:bottom-0 print:left-0 print:right-0 print:bg-white print:border-t print:p-2 print:text-center print:text-xs print:text-gray-500">
        <p>Page 1 of 1 - {patient.firstName} {patient.lastName} Patient Report</p>
      </div>
    </div>
  );
};

export default PatientReport;
