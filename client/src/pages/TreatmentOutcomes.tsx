import React, { useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, BarChart3, TrendingUp, AlertTriangle, User, Calendar } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TreatmentOutcomeForm } from '@/components/treatment/TreatmentOutcomeForm';
import { TreatmentOutcomesList } from '@/components/treatment/TreatmentOutcomesList';

import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export default function TreatmentOutcomes() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showForm, setShowForm] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState<any>(null);
  const [viewingOutcome, setViewingOutcome] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outcomeToDelete, setOutcomeToDelete] = useState<any>(null);

  // Fetch patient data
  const { data: patient, isLoading: isLoadingPatient, error: patientError } = useQuery({
    queryKey: [`/api/patients/${patientId}`],
    queryFn: async () => {
      console.log('Fetching patient data for ID:', patientId);
      try {
        const response = await apiRequest('GET', `/api/patients/${patientId}`);
        console.log('Patient API response:', response);
        const patientData = await response.json();
        console.log('Patient data extracted:', patientData);
        return patientData;
      } catch (error) {
        console.error('Patient API error:', error);
        throw error;
      }
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    enabled: !!patientId, // Only run query if patientId exists
  });

  console.log('Patient query state:', { patient, isLoadingPatient, patientError });

  // Fetch treatment outcomes summary
  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: [`/api/treatment-outcomes/summary?patientId=${patientId}`],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/treatment-outcomes/summary?patientId=${patientId}`);
        const summaryData = await response.json();
        return summaryData;
      } catch (error) {
        console.log('Summary API error (non-critical):', error);
        // Return default summary data if API fails
        return {
          totalAssessments: 0,
          averageDepressionScore: 0,
          averageAnxietyScore: 0,
          averageStressScore: 0,
          improvementTrend: "no_data",
          goalAchievementRate: 0,
          riskLevels: {},
          functionalImprovement: "no_data",
        };
      }
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    enabled: !!patientId, // Only run query if patientId exists
  });

  const handleCreateNew = () => {
    setEditingOutcome(null);
    setViewingOutcome(null);
    setShowForm(true);
    setActiveTab('form');
  };

  const handleEdit = (outcome: any) => {
    setEditingOutcome(outcome);
    setViewingOutcome(null);
    setShowForm(true);
    setActiveTab('form');
  };

  const handleView = (outcome: any) => {
    setViewingOutcome(outcome);
    setEditingOutcome(null);
    setShowForm(false);
    setActiveTab('details');
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingOutcome(null);
    setActiveTab('overview');
    toast({
      title: "Success",
      description: "Treatment outcome saved successfully",
    });
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingOutcome(null);
    setActiveTab('overview');
  };

  const handleDelete = (outcome: any) => {
    setOutcomeToDelete(outcome);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!outcomeToDelete) return;

    try {
      const response = await apiRequest('DELETE', `/api/treatment-outcomes/${outcomeToDelete._id || outcomeToDelete.id}`);
      if (response.ok) {
        toast({
          title: "Success",
          description: "Assessment deleted successfully",
        });
        
        // Refresh the data
        window.location.reload();
      } else {
        throw new Error('Failed to delete assessment');
      }
    } catch (error) {
      console.error('Error deleting assessment:', error);
      toast({
        title: "Error",
        description: "Failed to delete assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setOutcomeToDelete(null);
    }
  };

  // If no patientId, redirect to main treatment outcomes page
  if (!patientId) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">No Patient Selected</h2>
          <p className="text-gray-600 mb-6">
            Please select a patient to view their treatment outcomes, or view all treatment outcomes.
          </p>
          <div className="flex justify-center space-x-4">
            <Button onClick={() => navigate('/patients')}>
              View Patients
            </Button>
            <Button variant="outline" onClick={() => navigate('/treatment-outcomes')}>
              View All Treatment Outcomes
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoadingPatient) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading patient information...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">Patient not found</div>
      </div>
      );
  }

  // Debug: Log patient data structure
  console.log('Patient data received:', patient);
  console.log('Patient firstName:', patient?.firstName);
  console.log('Patient lastName:', patient?.lastName);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/patients/${patientId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Patient
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Treatment Outcomes</h1>
            <p className="text-gray-600">
              {patient?.firstName || 'Unknown'} {patient?.lastName || 'Patient'} • {patient?.dateOfBirth ? 
                new Date(patient.dateOfBirth).toLocaleDateString() : 'No DOB'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{patient?.status || 'Unknown'}</Badge>
          {patient?.assignedTherapist && (
            <Badge variant="secondary">
              <User className="h-3 w-3 mr-1" />
              {patient.assignedTherapist?.firstName || 'Unknown'} {patient.assignedTherapist?.lastName || 'Therapist'}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="form">Assessment Form</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingSummary ? '...' : summary?.totalAssessments || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Treatment outcome assessments
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Depression Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingSummary ? '...' : summary?.averageDepressionScore?.toFixed(1) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average PHQ-9 score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Anxiety Score</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingSummary ? '...' : summary?.averageAnxietyScore?.toFixed(1) || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Average GAD-7 score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Goal Achievement</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {isLoadingSummary ? '...' : summary?.goalAchievementRate?.toFixed(0) || 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Goals achieved or exceeded
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Indicators */}
          {summary && summary.totalAssessments > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Overall Trend</span>
                      <Badge 
                        variant={summary.improvementTrend === 'improving' ? 'default' : 
                               summary.improvementTrend === 'declining' ? 'destructive' : 'secondary'}
                      >
                        {summary.improvementTrend === 'improving' ? 'Improving' :
                         summary.improvementTrend === 'declining' ? 'Declining' :
                         summary.improvementTrend === 'stable' ? 'Stable' : 'No Data'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Functional Status</span>
                      <Badge 
                        variant={summary.functionalImprovement === 'improving' ? 'default' : 
                               summary.functionalImprovement === 'declining' ? 'destructive' : 'secondary'}
                      >
                        {summary.functionalImprovement === 'improving' ? 'Improving' :
                         summary.functionalImprovement === 'declining' ? 'Declining' :
                         summary.functionalImprovement === 'stable' ? 'Stable' : 'No Data'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Assessment Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">First Assessment</span>
                      <span className="text-sm text-muted-foreground">
                        {summary.firstAssessmentDate ? 
                          new Date(summary.firstAssessmentDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Latest Assessment</span>
                      <span className="text-sm text-muted-foreground">
                        {summary.lastAssessmentDate ? 
                          new Date(summary.lastAssessmentDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Days Tracked</span>
                      <span className="text-sm text-muted-foreground">
                        {summary.firstAssessmentDate && summary.lastAssessmentDate ? 
                          Math.ceil((new Date(summary.lastAssessmentDate).getTime() - 
                                   new Date(summary.firstAssessmentDate).getTime()) / 
                                   (1000 * 60 * 60 * 24)) : 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Assessment
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab('assessments')}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View All Assessments
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        {/* Assessments Tab */}
        <TabsContent value="assessments">
          <TreatmentOutcomesList
            patientId={patientId}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreate={handleCreateNew}
            showCreateButton={true}
          />
        </TabsContent>

        {/* Form Tab */}
        <TabsContent value="form">
          {showForm && user?.id ? (
            <TreatmentOutcomeForm
              patientId={patientId}
              therapistId={user.id}
              initialData={editingOutcome}
              onSuccess={handleFormSuccess}
              onCancel={handleFormCancel}
              mode={editingOutcome ? 'edit' : 'create'}
            />
          ) : showForm && !user?.id ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-red-600">
                  Loading user information... Please wait.
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details">
          {viewingOutcome ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Assessment Details</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(viewingOutcome.assessmentDate).toLocaleDateString()}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(viewingOutcome)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Symptom Scores */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Symptom Assessment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {viewingOutcome.depressionScore !== undefined && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Depression (PHQ-9)</div>
                        <div className="text-2xl font-bold">{viewingOutcome.depressionScore}/27</div>
                      </div>
                    )}
                    {viewingOutcome.anxietyScore !== undefined && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Anxiety (GAD-7)</div>
                        <div className="text-2xl font-bold">{viewingOutcome.anxietyScore}/21</div>
                      </div>
                    )}
                    {viewingOutcome.stressScore !== undefined && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600">Stress (PSS)</div>
                        <div className="text-2xl font-bold">{viewingOutcome.stressScore}/40</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Functional Assessment */}
                {(viewingOutcome.dailyFunctioning || viewingOutcome.socialEngagement || viewingOutcome.workPerformance) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Functional Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {viewingOutcome.dailyFunctioning && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600">Daily Functioning</div>
                          <div className="text-lg font-semibold capitalize">{viewingOutcome.dailyFunctioning}</div>
                        </div>
                      )}
                      {viewingOutcome.socialEngagement && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-gray-600">Social Engagement</div>
                          <div className="text-lg font-semibold capitalize">{viewingOutcome.socialEngagement.replace('_', ' ')}</div>
                        </div>
                      )}
                      {viewingOutcome.workPerformance && (
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <div className="text-sm text-gray-600">Work Performance</div>
                          <div className="text-lg font-semibold capitalize">{viewingOutcome.workPerformance}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Treatment Goals */}
                {viewingOutcome.primaryGoal && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Treatment Goals</h3>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <div className="text-sm text-gray-600 mb-2">Primary Goal</div>
                      <div className="text-lg">{viewingOutcome.primaryGoal}</div>
                      {viewingOutcome.goalProgress && (
                        <div className="mt-2">
                          <Badge className="mt-2">
                            {viewingOutcome.goalProgress.replace('_', ' ')}
                          </Badge>
                        </div>
                      )}
                      {viewingOutcome.goalNotes && (
                        <div className="mt-2 text-sm text-gray-600">
                          {viewingOutcome.goalNotes}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Clinical Observations */}
                {(viewingOutcome.moodState || viewingOutcome.riskFactors?.length > 0) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Clinical Observations</h3>
                    <div className="space-y-3">
                      {viewingOutcome.moodState && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600">Mood State</div>
                          <div className="text-lg font-semibold capitalize">{viewingOutcome.moodState}</div>
                        </div>
                      )}
                      {viewingOutcome.riskFactors && viewingOutcome.riskFactors.length > 0 && (
                        <div className="p-3 bg-red-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">Risk Factors</div>
                          <div className="flex flex-wrap gap-2">
                            {viewingOutcome.riskFactors.map((risk: string, idx: number) => (
                              <Badge key={idx} variant="destructive">
                                {risk}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {viewingOutcome.safetyPlan && (
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">Safety Plan</div>
                          <div className="text-sm">{viewingOutcome.safetyPlan}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Treatment Response */}
                {(viewingOutcome.medicationEffectiveness || viewingOutcome.therapyEngagement) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Treatment Response</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {viewingOutcome.medicationEffectiveness && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600">Medication Effectiveness</div>
                          <div className="text-lg font-semibold capitalize">{viewingOutcome.medicationEffectiveness}</div>
                        </div>
                      )}
                      {viewingOutcome.therapyEngagement && (
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="text-sm text-gray-600">Therapy Engagement</div>
                          <div className="text-lg font-semibold capitalize">{viewingOutcome.therapyEngagement.replace('_', ' ')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes and Documentation */}
                {(viewingOutcome.clinicalNotes || viewingOutcome.nextSteps) && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Notes and Documentation</h3>
                    <div className="space-y-3">
                      {viewingOutcome.clinicalNotes && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">Clinical Notes</div>
                          <div className="text-sm whitespace-pre-wrap">{viewingOutcome.clinicalNotes}</div>
                        </div>
                      )}
                      {viewingOutcome.nextSteps && (
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-2">Next Steps</div>
                          <div className="text-sm whitespace-pre-wrap">{viewingOutcome.nextSteps}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Assessed by:</span> {viewingOutcome.therapistId?.firstName} {viewingOutcome.therapistId?.lastName}
                    </div>
                    <div>
                      <span className="font-medium">Created by:</span> {viewingOutcome.createdBy?.firstName} {viewingOutcome.createdBy?.lastName}
                    </div>
                    {viewingOutcome.updatedBy && (
                      <div>
                        <span className="font-medium">Last updated by:</span> {viewingOutcome.updatedBy?.firstName} {viewingOutcome.updatedBy?.lastName}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Created:</span> {new Date(viewingOutcome.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Select an assessment to view details
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this treatment outcome assessment? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
