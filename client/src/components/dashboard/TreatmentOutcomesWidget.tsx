import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  BarChart3, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface TreatmentOutcomesSummary {
  totalAssessments: number;
  averageDepressionScore: number;
  averageAnxietyScore: number;
  averageStressScore: number;
  improvementTrend: string;
  goalAchievementRate: number;
  riskLevels: Record<string, number>;
  functionalImprovement: string;
  lastAssessmentDate?: string;
  firstAssessmentDate?: string;
}

interface TreatmentOutcomesWidgetProps {
  patientId?: string;
  therapistId?: string;
  showViewAll?: boolean;
}

export function TreatmentOutcomesWidget({ 
  patientId, 
  therapistId, 
  showViewAll = true 
}: TreatmentOutcomesWidgetProps) {
  const [, navigate] = useLocation();

  const { data: summary, isLoading } = useQuery({
    queryKey: [`/api/treatment-outcomes/summary${patientId ? `?patientId=${patientId}` : ''}${therapistId ? `?therapistId=${therapistId}` : ''}`],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/treatment-outcomes/summary${patientId ? `?patientId=${patientId}` : ''}${therapistId ? `?therapistId=${therapistId}` : ''}`);
      const data = await response.json();
      return data as TreatmentOutcomesSummary;
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
        return <Minus className="h-4 w-4 text-gray-600" />;
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Treatment Outcomes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }



  if (!summary || 
      summary.totalAssessments === 0 || 
      typeof summary.averageDepressionScore !== 'number' ||
      typeof summary.averageAnxietyScore !== 'number' ||
      typeof summary.averageStressScore !== 'number' ||
      typeof summary.goalAchievementRate !== 'number' ||
      !summary.riskLevels ||
      typeof summary.improvementTrend !== 'string' ||
      typeof summary.functionalImprovement !== 'string') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Treatment Outcomes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">
            No treatment outcome data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRiskFactors = summary.riskLevels ? Object.values(summary.riskLevels).reduce((a, b) => a + b, 0) : 0;
  const hasHighRisk = summary.riskLevels ? Object.keys(summary.riskLevels).some(risk => 
    risk.toLowerCase().includes('suicidal') || 
    risk.toLowerCase().includes('self-harm') || 
    risk.toLowerCase().includes('harm to others')
  ) : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Treatment Outcomes</span>
          </div>
          {showViewAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(patientId ? `/patients/${patientId}/treatment-outcomes` : '/treatment-outcomes')}
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {summary.totalAssessments}
            </div>
            <div className="text-xs text-gray-600">Assessments</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(summary.averageDepressionScore, 27)}`}>
              {summary.averageDepressionScore.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600">Avg Depression</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${getScoreColor(summary.averageAnxietyScore, 21)}`}>
              {summary.averageAnxietyScore.toFixed(1)}
            </div>
            <div className="text-xs text-gray-600">Avg Anxiety</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {summary.goalAchievementRate.toFixed(0)}%
            </div>
            <div className="text-xs text-gray-600">Goals Met</div>
          </div>
        </div>

        {/* Progress Trends */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Progress Trends</h4>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              {getTrendIcon(summary.improvementTrend)}
              <span className="text-sm font-medium">Overall Progress</span>
            </div>
            <Badge 
              variant={summary.improvementTrend === 'improving' ? 'default' : 
                     summary.improvementTrend === 'declining' ? 'destructive' : 'secondary'}
            >
              {summary.improvementTrend === 'improving' ? 'Improving' :
               summary.improvementTrend === 'declining' ? 'Declining' :
               summary.improvementTrend === 'stable' ? 'Stable' : 'No Data'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-2">
              {getTrendIcon(summary.functionalImprovement)}
              <span className="text-sm font-medium">Functional Status</span>
            </div>
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

        {/* Symptom Severity */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Symptom Severity</h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Depression (PHQ-9)</span>
              <div className="flex items-center space-x-2">
                <span className={getScoreColor(summary.averageDepressionScore, 27)}>
                  {summary.averageDepressionScore.toFixed(1)}/27
                </span>
                <Badge variant="outline" className="text-xs">
                  {getScoreSeverity(summary.averageDepressionScore, 27)}
                </Badge>
              </div>
            </div>
            <Progress 
              value={(summary.averageDepressionScore / 27) * 100} 
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Anxiety (GAD-7)</span>
              <div className="flex items-center space-x-2">
                <span className={getScoreColor(summary.averageAnxietyScore, 21)}>
                  {summary.averageAnxietyScore.toFixed(1)}/21
                </span>
                <Badge variant="outline" className="text-xs">
                  {getScoreSeverity(summary.averageAnxietyScore, 21)}
                </Badge>
              </div>
            </div>
            <Progress 
              value={(summary.averageAnxietyScore / 21) * 100} 
              className="h-2"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Stress (PSS)</span>
              <div className="flex items-center space-x-2">
                <span className={getScoreColor(summary.averageStressScore, 40)}>
                  {summary.averageStressScore.toFixed(1)}/40
                </span>
                <Badge variant="outline" className="text-xs">
                  {getScoreSeverity(summary.averageStressScore, 40)}
                </Badge>
              </div>
            </div>
            <Progress 
              value={(summary.averageStressScore / 40) * 100} 
              className="h-2"
            />
          </div>
        </div>

        {/* Risk Assessment */}
        {totalRiskFactors > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Risk Factors</span>
            </h4>
            
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-red-800">
                  {totalRiskFactors} risk factor{totalRiskFactors !== 1 ? 's' : ''} identified
                </span>
                {hasHighRisk && (
                  <Badge variant="destructive" className="text-xs">
                    High Risk
                  </Badge>
                )}
              </div>
              
              <div className="space-y-1">
                {summary.riskLevels && Object.entries(summary.riskLevels).map(([risk, count]) => (
                  <div key={risk} className="flex items-center justify-between text-xs">
                    <span className="text-red-700">{risk}</span>
                    <span className="text-red-600 font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Goal Achievement */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center space-x-2">
            <CheckCircle className="h-4 w-4" />
            <span>Goal Achievement</span>
          </h4>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <span className="font-medium">{summary.goalAchievementRate.toFixed(0)}%</span>
            </div>
            <Progress value={summary.goalAchievementRate} className="h-2" />
            <div className="text-xs text-gray-600 text-center">
              {summary.goalAchievementRate >= 80 ? 'Excellent progress!' :
               summary.goalAchievementRate >= 60 ? 'Good progress' :
               summary.goalAchievementRate >= 40 ? 'Moderate progress' :
               'Needs attention'}
            </div>
          </div>
        </div>

        {/* Assessment Timeline */}
        {summary.firstAssessmentDate && summary.lastAssessmentDate && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Assessment Timeline</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">First Assessment</div>
                <div className="font-medium">
                  {new Date(summary.firstAssessmentDate).toLocaleDateString()}
                </div>
              </div>
              
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Latest Assessment</div>
                <div className="font-medium">
                  {new Date(summary.lastAssessmentDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600">Days Tracked</div>
              <div className="text-lg font-bold text-blue-600">
                {Math.ceil((new Date(summary.lastAssessmentDate).getTime() - 
                           new Date(summary.firstAssessmentDate).getTime()) / 
                           (1000 * 60 * 60 * 24))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
