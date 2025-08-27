import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Plus, BarChart3, TrendingUp, Filter, Search, Calendar, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Eye, 
  Edit, 
  Plus as PlusIcon,
  TrendingDown, 
  Minus,
  Trash2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export default function TreatmentOutcomesMain() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clinicalFilter, setClinicalFilter] = useState('all');
  const [sortBy, setSortBy] = useState('assessmentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outcomeToDelete, setOutcomeToDelete] = useState<any>(null);

  // Fetch all treatment outcomes
  const { data: outcomesData, isLoading, error } = useQuery({
    queryKey: ['/api/treatment-outcomes', currentPage, pageSize, searchTerm, statusFilter, clinicalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', pageSize.toString());
      params.append('offset', ((currentPage - 1) * pageSize).toString());
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('goalProgress', statusFilter);
      if (clinicalFilter !== 'all') params.append('clinicalId', clinicalFilter);
      
      const response = await apiRequest('GET', `/api/treatment-outcomes?${params.toString()}`);
      const data = await response.json();
      return data;
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  // Fetch clinicals for filter
  const { data: clinicals } = useQuery({
    queryKey: ['/api/staff/list'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/staff/list');
      const data = await response.json();
      return data.filter((staff: any) => staff.role === 'clinical');
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const outcomes = outcomesData?.outcomes || [];
  const totalOutcomes = outcomesData?.total || 0;
  const totalPages = Math.ceil(totalOutcomes / pageSize);

  // Filter and sort outcomes
  const filteredOutcomes = outcomes.sort((a: any, b: any) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'assessmentDate') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = score / maxScore;
    if (percentage <= 0.33) return "bg-green-100 text-green-800";
    if (percentage <= 0.66) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getProgressColor = (progress: string) => {
    switch (progress) {
      case 'achieved':
      case 'exceeded':
        return "bg-green-100 text-green-800";
      case 'progressing':
        return "bg-blue-100 text-blue-800";
      case 'beginning':
        return "bg-yellow-100 text-yellow-800";
      case 'not_started':
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'elevated':
        return "bg-purple-100 text-purple-800";
      case 'stable':
        return "bg-green-100 text-green-800";
      case 'low':
        return "bg-yellow-100 text-yellow-800";
      case 'depressed':
        return "bg-red-100 text-red-800";
      case 'anxious':
        return "bg-orange-100 text-orange-800";
      case 'mixed':
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleViewPatient = (patientId: string) => {
    navigate(`/patients/${patientId}`);
  };

  const handleViewOutcome = (outcome: any) => {
    navigate(`/patients/${outcome.patientId._id || outcome.patientId}/treatment-outcomes`);
  };

  const handleDeleteOutcome = (outcome: any) => {
    setOutcomeToDelete(outcome);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteOutcome = async () => {
    if (!outcomeToDelete) return;

    try {
      const response = await apiRequest('DELETE', `/api/treatment-outcomes/${outcomeToDelete._id || outcomeToDelete.id}`);
      if (response.ok) {
        toast({
          title: "Success",
          description: "Assessment deleted successfully",
        });
        
        // Refresh the data by refetching the query
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading treatment outcomes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-600">
          Error loading treatment outcomes. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Treatment Outcomes</h1>
          <p className="text-gray-600">
            Comprehensive view of all treatment outcome assessments
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            <BarChart3 className="h-3 w-3 mr-1" />
            {totalOutcomes} Total Assessments
          </Badge>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters & Search</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search clinical notes, goals..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="beginning">Beginning</SelectItem>
                <SelectItem value="progressing">Progressing</SelectItem>
                <SelectItem value="achieved">Achieved</SelectItem>
                <SelectItem value="exceeded">Exceeded</SelectItem>
              </SelectContent>
            </Select>
            
                            <Select value={clinicalFilter} onValueChange={setClinicalFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by clinical" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clinical</SelectItem>
                    {clinicals?.map((clinical: any) => (
                      <SelectItem key={clinical.id} value={clinical.id}>
                        {clinical.firstName} {clinical.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assessmentDate">Assessment Date</SelectItem>
                <SelectItem value="depressionScore">Depression Score</SelectItem>
                <SelectItem value="anxietyScore">Anxiety Score</SelectItem>
                <SelectItem value="goalProgress">Goal Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Outcomes Table */}
      <Card>
        <CardHeader>
          <CardTitle>Treatment Outcome Assessments</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOutcomes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {outcomes.length === 0 ? (
                "No treatment outcome assessments found."
              ) : (
                "No assessments match the current filters."
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('assessmentDate')}
                    >
                      Date
                      {sortBy === 'assessmentDate' && (
                        <span className="ml-1">
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Clinical</TableHead>
                    <TableHead>Symptom Scores</TableHead>
                    <TableHead>Goals</TableHead>
                    <TableHead>Mood & Risk</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOutcomes.map((outcome: any) => (
                    <TableRow key={outcome._id || outcome.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {format(new Date(outcome.assessmentDate), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-sm text-gray-500">
                              {format(new Date(outcome.assessmentDate), 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewPatient(outcome.patientId._id || outcome.patientId)}
                          className="p-0 h-auto font-normal"
                        >
                          <User className="h-4 w-4 mr-2" />
                          {outcome.patientId?.firstName} {outcome.patientId?.lastName}
                        </Button>
                      </TableCell>
                      
                      <TableCell>
                        <div className="text-sm">
                          {outcome.clinicalId?.firstName} {outcome.clinicalId?.lastName}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {outcome.depressionScore !== undefined && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">D:</span>
                              <Badge className={getScoreColor(outcome.depressionScore, 27)}>
                                {outcome.depressionScore}/27
                              </Badge>
                            </div>
                          )}
                          {outcome.anxietyScore !== undefined && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">A:</span>
                              <Badge className={getScoreColor(outcome.anxietyScore, 21)}>
                                {outcome.anxietyScore}/21
                              </Badge>
                            </div>
                          )}
                          {outcome.stressScore !== undefined && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm text-gray-600">S:</span>
                              <Badge className={getScoreColor(outcome.stressScore, 40)}>
                                {outcome.stressScore}/40
                              </Badge>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {outcome.primaryGoal && (
                            <div className="text-sm text-gray-900 line-clamp-2 max-w-xs">
                              {outcome.primaryGoal}
                            </div>
                          )}
                          {outcome.goalProgress && (
                            <Badge className={getProgressColor(outcome.goalProgress)}>
                              {outcome.goalProgress.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {outcome.moodState && (
                            <Badge className={getMoodColor(outcome.moodState)}>
                              {outcome.moodState}
                            </Badge>
                          )}
                          {outcome.riskFactors && outcome.riskFactors.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {outcome.riskFactors.slice(0, 2).map((risk: string, idx: number) => (
                                <Badge key={idx} variant="destructive" className="text-xs">
                                  {risk}
                                </Badge>
                              ))}
                              {outcome.riskFactors.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{outcome.riskFactors.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                                          <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewOutcome(outcome)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteOutcome(outcome)}
                          title="Delete Assessment"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalOutcomes)} of {totalOutcomes} results
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            <AlertDialogAction onClick={confirmDeleteOutcome} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
