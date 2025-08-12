import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Activity,
  Target,
  Heart,
  Users,
  Briefcase,
  Brain,
  Shield
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface TreatmentOutcomesData {
  totalAssessments: number;
  totalPatients: number;
  averageDepressionScore: number;
  averageAnxietyScore: number;
  averageStressScore: number;
  improvementTrend: string;
  goalAchievementRate: number;
  riskLevels: Record<string, number>;
  functionalImprovement: string;
  moodDistribution: Record<string, number>;
  therapyEngagement: Record<string, number>;
  medicationEffectiveness: Record<string, number>;
  lastAssessmentDate?: string;
  firstAssessmentDate?: string;
  recentOutcomes: Array<{
    patientName: string;
    assessmentDate: string;
    depressionScore: number;
    anxietyScore: number;
    stressScore: number;
    goalProgress: string;
    moodState: string;
  }>;
}

export function TreatmentOutcomes() {
  const { data: outcomes, isLoading } = useQuery({
    queryKey: ['/api/treatment-outcomes/analytics'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/treatment-outcomes/analytics');
      const data = await response.json();
      return data as TreatmentOutcomesData;
    },
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingDown className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Minus className="h-4 w-4 text-blue-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      case 'stable':
        return 'text-blue-600';
      default:
        return 'text-gray-400';
    }
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = score / maxScore;
    if (percentage <= 0.33) return 'text-green-600';
    if (percentage <= 0.66) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreSeverity = (score: number, maxScore: number) => {
    const percentage = score / maxScore;
    if (percentage <= 0.33) return 'Low';
    if (percentage <= 0.66) return 'Moderate';
    return 'High';
  };

  const getGoalProgressColor = (progress: string) => {
    switch (progress) {
      case 'achieved':
      case 'exceeded':
        return 'bg-green-100 text-green-800';
      case 'progressing':
        return 'bg-blue-100 text-blue-800';
      case 'beginning':
        return 'bg-yellow-100 text-yellow-800';
      case 'not_started':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'elevated':
      case 'stable':
        return 'bg-green-100 text-green-800';
      case 'low':
      case 'depressed':
        return 'bg-red-100 text-red-800';
      case 'anxious':
        return 'bg-yellow-100 text-yellow-800';
      case 'mixed':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="space-y-2">
                    {[...Array(4)].map((_, j) => (
                      <div key={j} className="h-3 bg-gray-200 rounded w-full"></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!outcomes) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
        <p className="text-gray-600">Treatment outcomes data is not available at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assessments</CardTitle>
            <BarChart3 className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outcomes.totalAssessments}</div>
            <p className="text-xs text-gray-600">Treatment outcome assessments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Goal Achievement</CardTitle>
            <Target className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outcomes.goalAchievementRate}%</div>
            <p className="text-xs text-gray-600">Patients achieving goals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Improvement Trend</CardTitle>
            <Activity className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {getTrendIcon(outcomes.improvementTrend)}
              <span className={`text-lg font-bold ${getTrendColor(outcomes.improvementTrend)} capitalize`}>
                {outcomes.improvementTrend}
              </span>
            </div>
            <p className="text-xs text-gray-600">Overall patient progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Functional Status</CardTitle>
            <Users className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold capitalize">{outcomes.functionalImprovement}</div>
            <p className="text-xs text-gray-600">Daily functioning improvement</p>
          </CardContent>
        </Card>
      </div>

      {/* Symptom Scores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depression Scores</CardTitle>
            <Brain className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(outcomes.averageDepressionScore, 27)}`}>
              {outcomes.averageDepressionScore.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Average score (0-27 scale)
            </p>
            <Badge variant="outline" className={getScoreColor(outcomes.averageDepressionScore, 27)}>
              {getScoreSeverity(outcomes.averageDepressionScore, 27)} Severity
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anxiety Scores</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(outcomes.averageAnxietyScore, 21)}`}>
              {outcomes.averageAnxietyScore.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Average score (0-21 scale)
            </p>
            <Badge variant="outline" className={getScoreColor(outcomes.averageAnxietyScore, 21)}>
              {getScoreSeverity(outcomes.averageAnxietyScore, 21)} Severity
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stress Scores</CardTitle>
            <Shield className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getScoreColor(outcomes.averageStressScore, 40)}`}>
              {outcomes.averageStressScore.toFixed(1)}
            </div>
            <p className="text-xs text-gray-600 mb-2">
              Average score (0-40 scale)
            </p>
            <Badge variant="outline" className={getScoreColor(outcomes.averageStressScore, 40)}>
              {getScoreSeverity(outcomes.averageStressScore, 40)} Severity
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mood Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Mood State Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(outcomes.moodDistribution || {}).map(([mood, count]) => (
                <div key={mood} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getMoodColor(mood)}>
                      {mood.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{count} patients</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Therapy Engagement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Therapy Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(outcomes.therapyEngagement || {}).map(([engagement, count]) => (
                <div key={engagement} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {engagement.replace('_', ' ')}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{count} patients</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Outcomes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Treatment Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Patient</th>
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Depression</th>
                  <th className="text-left py-2">Anxiety</th>
                  <th className="text-left py-2">Stress</th>
                  <th className="text-left py-2">Goal Progress</th>
                  <th className="text-left py-2">Mood</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.recentOutcomes?.slice(0, 10).map((outcome, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2 font-medium">{outcome.patientName}</td>
                    <td className="py-2 text-gray-600">
                      {new Date(outcome.assessmentDate).toLocaleDateString()}
                    </td>
                    <td className="py-2">
                      <span className={getScoreColor(outcome.depressionScore, 27)}>
                        {outcome.depressionScore}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={getScoreColor(outcome.anxietyScore, 21)}>
                        {outcome.anxietyScore}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={getScoreColor(outcome.stressScore, 40)}>
                        {outcome.stressScore}
                      </span>
                    </td>
                    <td className="py-2">
                      <Badge className={getGoalProgressColor(outcome.goalProgress)}>
                        {outcome.goalProgress.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Badge className={getMoodColor(outcome.moodState)}>
                        {outcome.moodState.replace('_', ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {outcomes.recentOutcomes && outcomes.recentOutcomes.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No recent treatment outcomes available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
