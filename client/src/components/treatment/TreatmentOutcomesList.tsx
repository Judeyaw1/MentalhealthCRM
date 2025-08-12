import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Filter,
  Search,
  BarChart3,
  Trash2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface TreatmentOutcomesListProps {
  patientId: string;
  onView?: (outcome: any) => void;
  onEdit?: (outcome: any) => void;
  onDelete?: (outcome: any) => void;
  onCreate?: () => void;
  showCreateButton?: boolean;
}

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

export function TreatmentOutcomesList({
  patientId,
  onView,
  onEdit,
  onDelete,
  onCreate,
  showCreateButton = true
}: TreatmentOutcomesListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('assessmentDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const { data: outcomesData, isLoading, error, refetch } = useQuery({
    queryKey: [`/api/patients/${patientId}/treatment-outcomes`],
    queryFn: async () => {
      if (!patientId) {
        return { outcomes: [], total: 0, hasMore: false };
      }
      const response = await apiRequest('GET', `/api/patients/${patientId}/treatment-outcomes`);
      const data = await response.json();
      return data;
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    enabled: !!patientId, // Only run query if patientId exists
  });

  const outcomes = outcomesData?.outcomes || [];

  // Filter and sort outcomes
  const filteredOutcomes = outcomes
    .filter((outcome: any) => {
      const matchesSearch = !searchTerm || 
        outcome.clinicalNotes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        outcome.primaryGoal?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || 
        outcome.goalProgress === statusFilter;
      
      return matchesSearch && matchesStatus;
    })
    .sort((a: any, b: any) => {
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

  const getTrendIcon = (outcome: any, index: number) => {
    if (index === 0) return null; // First assessment
    
    const prevOutcome = outcomes[index + 1];
    if (!prevOutcome) return null;
    
    if (outcome.depressionScore && prevOutcome.depressionScore) {
      const change = prevOutcome.depressionScore - outcome.depressionScore;
      if (change > 2) return <TrendingDown className="h-4 w-4 text-green-600" />;
      if (change < -2) return <TrendingUp className="h-4 w-4 text-red-600" />;
      return <Minus className="h-4 w-4 text-gray-600" />;
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading treatment outcomes...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Error loading treatment outcomes. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no outcomes and not loading, show empty state
  if (!isLoading && outcomes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Treatment Outcomes</span>
            </div>
            {showCreateButton && onCreate && (
              <Button onClick={onCreate} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Assessment
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Treatment Outcomes Yet</h3>
            <p className="text-gray-500 mb-6">
              This patient doesn't have any treatment outcome assessments yet. 
              {onCreate && " Create the first assessment to start tracking progress."}
            </p>
            {onCreate && (
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Assessment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Treatment Outcomes</CardTitle>
          {showCreateButton && onCreate && (
            <Button onClick={onCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Assessment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
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
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
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
        </div>

        {/* Outcomes Table */}
        {filteredOutcomes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {outcomes.length === 0 ? (
              "No treatment outcome assessments found for this patient."
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
                  <TableHead>Symptom Scores</TableHead>
                  <TableHead>Functional Status</TableHead>
                  <TableHead>Goals</TableHead>
                  <TableHead>Mood & Risk</TableHead>
                  <TableHead>Treatment Response</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOutcomes.map((outcome: any, index: number) => (
                  <TableRow key={outcome._id || outcome.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getTrendIcon(outcome, index)}
                        <div>
                          <div className="font-medium">
                            {format(new Date(outcome.assessmentDate), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-sm text-gray-500">
                            {outcome.therapistId?.firstName} {outcome.therapistId?.lastName}
                          </div>
                        </div>
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
                        {outcome.dailyFunctioning && (
                          <Badge variant="outline">{outcome.dailyFunctioning}</Badge>
                        )}
                        {outcome.socialEngagement && (
                          <Badge variant="outline">{outcome.socialEngagement}</Badge>
                        )}
                        {outcome.workPerformance && (
                          <Badge variant="outline">{outcome.workPerformance}</Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        {outcome.primaryGoal && (
                          <div className="text-sm text-gray-900 line-clamp-2">
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
                      <div className="space-y-1">
                        {outcome.medicationEffectiveness && (
                          <Badge variant="outline">{outcome.medicationEffectiveness}</Badge>
                        )}
                        {outcome.therapyEngagement && (
                          <Badge variant="outline">{outcome.therapyEngagement.replace('_', ' ')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex space-x-1">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(outcome)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(outcome)}
                            title="Edit Assessment"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(outcome)}
                            title="Delete Assessment"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary Stats */}
        {outcomes.length > 0 && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-3">Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Total Assessments</div>
                <div className="font-medium">{outcomes.length}</div>
              </div>
              <div>
                <div className="text-gray-600">Latest Assessment</div>
                <div className="font-medium">
                  {format(new Date(outcomes[0]?.assessmentDate), 'MMM dd, yyyy')}
                </div>
              </div>
              <div>
                <div className="text-gray-600">First Assessment</div>
                <div className="font-medium">
                  {format(new Date(outcomes[outcomes.length - 1]?.assessmentDate), 'MMM dd, yyyy')}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Days Tracked</div>
                <div className="font-medium">
                  {Math.ceil((new Date(outcomes[0]?.assessmentDate).getTime() - 
                    new Date(outcomes[outcomes.length - 1]?.assessmentDate).getTime()) / 
                    (1000 * 60 * 60 * 24))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
