import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const treatmentOutcomeSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  therapistId: z.string().min(1, "Therapist is required"),
  assessmentDate: z.date(),
  
  // Symptom Assessment Scores
  depressionScore: z.number().min(0).max(27).optional(),
  anxietyScore: z.number().min(0).max(21).optional(),
  stressScore: z.number().min(0).max(40).optional(),
  
  // Functional Assessment
  dailyFunctioning: z.enum(["excellent", "good", "fair", "poor", "severe"]).optional(),
  socialEngagement: z.enum(["very_active", "active", "moderate", "limited", "isolated"]).optional(),
  workPerformance: z.enum(["excellent", "good", "fair", "poor", "unable"]).optional(),
  
  // Treatment Goals
  primaryGoal: z.string().optional(),
  goalProgress: z.enum(["not_started", "beginning", "progressing", "achieved", "exceeded"]).optional(),
  goalNotes: z.string().optional(),
  
  // Clinical Observations
  moodState: z.enum(["elevated", "stable", "low", "depressed", "anxious", "mixed"]).optional(),
  riskFactors: z.array(z.string()).optional(),
  safetyPlan: z.string().optional(),
  
  // Treatment Response
  medicationEffectiveness: z.enum(["excellent", "good", "fair", "poor", "adverse"]).optional(),
  therapyEngagement: z.enum(["very_engaged", "engaged", "moderate", "resistant", "non_compliant"]).optional(),
  
  // Notes and Documentation
  clinicalNotes: z.string().optional(),
  nextSteps: z.string().optional(),
});

type TreatmentOutcomeFormData = z.infer<typeof treatmentOutcomeSchema>;

interface TreatmentOutcomeFormProps {
  patientId?: string;
  therapistId?: string;
  initialData?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

const riskFactorOptions = [
  "Suicidal ideation",
  "Self-harm risk",
  "Harm to others",
  "Substance abuse",
  "Non-compliance",
  "Social isolation",
  "Financial stress",
  "Family conflict",
  "Work stress",
  "Housing instability"
];

export function TreatmentOutcomeForm({
  patientId,
  therapistId,
  initialData,
  onSuccess,
  onCancel,
  mode = 'create'
}: TreatmentOutcomeFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRiskFactors, setSelectedRiskFactors] = useState<string[]>(
    initialData?.riskFactors || []
  );
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<TreatmentOutcomeFormData>({
    resolver: zodResolver(treatmentOutcomeSchema),
    defaultValues: {
      patientId: patientId || '',
      therapistId: therapistId || '',
      assessmentDate: new Date(),
      ...initialData,
    },
  });

  const watchedAssessmentDate = watch('assessmentDate');

  const onSubmit = async (data: TreatmentOutcomeFormData) => {
    try {
      setIsSubmitting(true);
      
      const submitData = {
        ...data,
        riskFactors: selectedRiskFactors,
      };

      console.log('Form data being submitted:', submitData);

      if (mode === 'create') {
        const response = await apiRequest('POST', '/api/treatment-outcomes', submitData);
        console.log('API response:', response);
        toast({
          title: "Success",
          description: "Treatment outcome assessment created successfully",
        });
      } else {
        const response = await apiRequest('PATCH', `/api/treatment-outcomes/${initialData.id}`, submitData);
        console.log('API response:', response);
        toast({
          title: "Success",
          description: "Treatment outcome assessment updated successfully",
        });
      }

      onSuccess?.();
    } catch (error) {
      console.error('Error saving treatment outcome:', error);
      console.error('Error details:', error);
      toast({
        title: "Error",
        description: "Failed to save treatment outcome assessment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleRiskFactor = (factor: string) => {
    setSelectedRiskFactors(prev => 
      prev.includes(factor) 
        ? prev.filter(f => f !== factor)
        : [...prev, factor]
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {mode === 'create' ? 'Create New' : 'Edit'} Treatment Outcome Assessment
          </span>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assessmentDate">Assessment Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !watchedAssessmentDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {watchedAssessmentDate ? format(watchedAssessmentDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={watchedAssessmentDate}
                    onSelect={(date) => setValue('assessmentDate', date || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Symptom Assessment Scores */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Symptom Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="depressionScore">Depression Score (PHQ-9: 0-27)</Label>
                <Input
                  type="number"
                  min="0"
                  max="27"
                  {...register('depressionScore', { valueAsNumber: true })}
                  placeholder="0-27"
                />
                {errors.depressionScore && (
                  <p className="text-sm text-red-600">{errors.depressionScore.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="anxietyScore">Anxiety Score (GAD-7: 0-21)</Label>
                <Input
                  type="number"
                  min="0"
                  max="21"
                  {...register('anxietyScore', { valueAsNumber: true })}
                  placeholder="0-21"
                />
                {errors.anxietyScore && (
                  <p className="text-sm text-red-600">{errors.anxietyScore.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="stressScore">Stress Score (PSS: 0-40)</Label>
                <Input
                  type="number"
                  min="0"
                  max="40"
                  {...register('stressScore', { valueAsNumber: true })}
                  placeholder="0-40"
                />
                {errors.stressScore && (
                  <p className="text-sm text-red-600">{errors.stressScore.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Functional Assessment */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Functional Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dailyFunctioning">Daily Functioning</Label>
                <Select onValueChange={(value) => setValue('dailyFunctioning', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="socialEngagement">Social Engagement</Label>
                <Select onValueChange={(value) => setValue('socialEngagement', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="very_active">Very Active</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="limited">Limited</SelectItem>
                    <SelectItem value="isolated">Isolated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="workPerformance">Work Performance</Label>
                <Select onValueChange={(value) => setValue('workPerformance', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="unable">Unable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Treatment Goals */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Treatment Goals</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="primaryGoal">Primary Goal</Label>
                <Textarea
                  {...register('primaryGoal')}
                  placeholder="Describe the primary treatment goal..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="goalProgress">Goal Progress</Label>
                  <Select onValueChange={(value) => setValue('goalProgress', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select progress" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="beginning">Beginning</SelectItem>
                      <SelectItem value="progressing">Progressing</SelectItem>
                      <SelectItem value="achieved">Achieved</SelectItem>
                      <SelectItem value="exceeded">Exceeded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="goalNotes">Goal Notes</Label>
                  <Input
                    {...register('goalNotes')}
                    placeholder="Additional notes about goals..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Clinical Observations */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Clinical Observations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="moodState">Mood State</Label>
                <Select onValueChange={(value) => setValue('moodState', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mood state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevated">Elevated</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="depressed">Depressed</SelectItem>
                    <SelectItem value="anxious">Anxious</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Risk Factors</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {riskFactorOptions.map((factor) => (
                    <label key={factor} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedRiskFactors.includes(factor)}
                        onChange={() => toggleRiskFactor(factor)}
                        className="rounded"
                      />
                      <span className="text-sm">{factor}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="safetyPlan">Safety Plan</Label>
              <Textarea
                {...register('safetyPlan')}
                placeholder="Describe safety plan if risk factors are present..."
                rows={3}
              />
            </div>
          </div>

          {/* Treatment Response */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Treatment Response</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="medicationEffectiveness">Medication Effectiveness</Label>
                <Select onValueChange={(value) => setValue('medicationEffectiveness', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select effectiveness" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                    <SelectItem value="adverse">Adverse Effects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="therapyEngagement">Therapy Engagement</Label>
                <Select onValueChange={(value) => setValue('therapyEngagement', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select engagement level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="very_engaged">Very Engaged</SelectItem>
                    <SelectItem value="engaged">Engaged</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="resistant">Resistant</SelectItem>
                    <SelectItem value="non_compliant">Non-Compliant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes and Documentation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Notes and Documentation</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="clinicalNotes">Clinical Notes</Label>
                <Textarea
                  {...register('clinicalNotes')}
                  placeholder="Detailed clinical observations and notes..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="nextSteps">Next Steps</Label>
                <Textarea
                  {...register('nextSteps')}
                  placeholder="Recommended next steps and follow-up plan..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button 
              type="submit" 
              disabled={isSubmitting || !isValid}
              onClick={() => {
                console.log('Submit button clicked');
                console.log('Form isValid:', isValid);
                console.log('Form errors:', errors);
                console.log('Form data:', watch());
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create Assessment' : 'Update Assessment'}
            </Button>
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Form valid: {isValid ? 'Yes' : 'No'} | 
            Errors: {Object.keys(errors).length} | 
            Submitting: {isSubmitting ? 'Yes' : 'No'}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
