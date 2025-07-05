import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTreatmentRecordSchema, type InsertTreatmentRecord } from "@shared/schema";

// Type for form submission with timestamp
type TreatmentRecordFormData = Omit<InsertTreatmentRecord, 'sessionDate'> & {
  sessionDate: number;
};
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  User, 
  Target, 
  MessageSquare, 
  TrendingUp, 
  FileText,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface TreatmentRecordFormProps {
  initialData?: Partial<InsertTreatmentRecord>;
  onSubmit: (data: TreatmentRecordFormData) => void;
  isLoading?: boolean;
  patients?: { id: number; firstName: string; lastName: string }[];
}

const SESSION_TEMPLATES = {
  therapy: {
    goals: "• Explore current challenges and stressors\n• Develop coping strategies\n• Work on identified treatment goals\n• Process recent experiences and emotions",
    notes: "Session focused on [specific topic/issue]. Patient demonstrated [observations about engagement, mood, etc.]. Key interventions included [list specific techniques used].",
    interventions: "• Cognitive Behavioral Therapy techniques\n• Mindfulness exercises\n• Psychoeducation on [topic]\n• Role-playing scenarios",
    progress: "Patient shows [specific progress indicators]. Areas of improvement include [list improvements]. Continued challenges include [list ongoing issues].",
    planForNextSession: "Continue work on [specific goals]. Focus on [next session priorities]. Consider [additional interventions or approaches]."
  },
  assessment: {
    goals: "• Complete comprehensive mental health assessment\n• Gather background information\n• Identify presenting problems\n• Establish baseline functioning",
    notes: "Initial assessment session. Patient presents with [primary concerns]. Background includes [relevant history]. Current functioning appears [level of functioning].",
    interventions: "• Clinical interview\n• Mental status examination\n• Risk assessment\n• Standardized assessment tools",
    progress: "Assessment phase - establishing baseline. No progress to report yet.",
    planForNextSession: "Complete assessment if needed. Begin treatment planning. Schedule follow-up session."
  },
  intake: {
    goals: "• Complete intake process and paperwork\n• Establish therapeutic relationship\n• Gather initial information\n• Set expectations for treatment",
    notes: "Initial intake session. Patient completed all required paperwork. Presenting concerns include [list concerns]. Patient appears [observations about presentation].",
    interventions: "• Intake interview\n• Paperwork completion\n• Treatment orientation\n• Goal setting discussion",
    progress: "Intake phase - establishing foundation for treatment.",
    planForNextSession: "Begin formal treatment sessions. Focus on [primary treatment goals]."
  }
};

export function TreatmentRecordForm({ 
  initialData, 
  onSubmit, 
  isLoading = false,
  patients = []
}: TreatmentRecordFormProps) {
  const { toast } = useToast();
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const form = useForm<InsertTreatmentRecord>({
    resolver: zodResolver(insertTreatmentRecordSchema),
    defaultValues: {
      patientId: initialData?.patientId || undefined,
      therapistId: initialData?.therapistId || undefined,
      sessionDate: initialData?.sessionDate || new Date(),
      sessionType: initialData?.sessionType || "therapy",
      notes: initialData?.notes || "",
      goals: initialData?.goals || "",
      interventions: initialData?.interventions || "",
      progress: initialData?.progress || "",
      planForNextSession: initialData?.planForNextSession || "",
    },
  });



  const watchedSessionType = form.watch("sessionType");
  const watchedValues = form.watch();

  // Auto-save functionality
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (form.formState.isDirty && !form.formState.isSubmitting) {
        setAutoSaveStatus('saving');
        // Simulate auto-save
        setTimeout(() => {
          setAutoSaveStatus('saved');
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        }, 1000);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, form.formState.isDirty, form.formState.isSubmitting]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S to save
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (form.formState.isValid && !isLoading) {
          form.handleSubmit(handleSubmit)();
        }
      }
      
      // Esc to cancel
      if (event.key === 'Escape') {
        event.preventDefault();
        if (form.formState.isDirty) {
          if (confirm("You have unsaved changes. Are you sure you want to cancel?")) {
            form.reset();
            window.history.back();
          }
        } else {
          window.history.back();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [form, isLoading]);

  // Apply template when session type changes
  useEffect(() => {
    if (selectedTemplate && SESSION_TEMPLATES[watchedSessionType as keyof typeof SESSION_TEMPLATES]) {
      const template = SESSION_TEMPLATES[watchedSessionType as keyof typeof SESSION_TEMPLATES];
      form.setValue("goals", template.goals);
      form.setValue("notes", template.notes);
      form.setValue("interventions", template.interventions);
      form.setValue("progress", template.progress);
      form.setValue("planForNextSession", template.planForNextSession);
      setSelectedTemplate('');
      toast({
        title: "Template Applied",
        description: `${watchedSessionType} template has been applied to your form.`,
      });
    }
  }, [selectedTemplate, watchedSessionType, form, toast]);

  const handleSubmit = (data: InsertTreatmentRecord) => {
    // Convert sessionDate from Date to timestamp for the backend
    const submissionData: TreatmentRecordFormData = {
      ...data,
      sessionDate: new Date(data.sessionDate).getTime()
    };
    onSubmit(submissionData);
  };

  const handleSaveClick = () => {
    if (form.formState.isValid) {
      // Show confirmation for important fields
      const hasNotes = form.getValues('notes')?.trim();
      const hasPatient = form.getValues('patientId');
      
      if (!hasNotes) {
        toast({
          title: "Missing Required Field",
          description: "Session notes are required before saving.",
          variant: "destructive",
        });
        return;
      }
      
      if (!hasPatient) {
        toast({
          title: "Missing Required Field",
          description: "Please select a patient before saving.",
          variant: "destructive",
        });
        return;
      }
      
      // Submit the form
      form.handleSubmit(handleSubmit)();
    }
  };

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDateTimeLocal = (dateTimeLocal: string) => {
    return new Date(dateTimeLocal);
  };

  const applyTemplate = (sessionType: string) => {
    setSelectedTemplate(sessionType);
  };

  const getAutoSaveIcon = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'saved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getAutoSaveText = () => {
    switch (autoSaveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save failed';
      default:
        return '';
    }
  };

  const getFormCompletionPercentage = () => {
    const requiredFields = ['patientId', 'therapistId', 'sessionDate', 'sessionType', 'notes'];
    const optionalFields = ['goals', 'interventions', 'progress', 'planForNextSession'];
    
    const requiredCompleted = requiredFields.filter(field => {
      const value = form.getValues(field as any);
      return value && (typeof value === 'string' ? value.trim() : true);
    }).length;
    
    const optionalCompleted = optionalFields.filter(field => {
      const value = form.getValues(field as any);
      return value && value.trim();
    }).length;
    
    const totalRequired = requiredFields.length;
    const totalOptional = optionalFields.length;
    
    return Math.round(((requiredCompleted / totalRequired) * 0.7 + (optionalCompleted / totalOptional) * 0.3) * 100);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Auto-save indicator */}
        {autoSaveStatus !== 'idle' && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            {getAutoSaveIcon()}
            <span>{getAutoSaveText()}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Session Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Patient *</span>
                    </FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString() || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id.toString()}>
                            {patient.firstName} {patient.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sessionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <FileText className="h-4 w-4" />
                      <span>Session Type *</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select session type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="therapy">Individual Therapy</SelectItem>
                        <SelectItem value="group">Group Therapy</SelectItem>
                        <SelectItem value="family">Family Therapy</SelectItem>
                        <SelectItem value="assessment">Assessment</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="intake">Initial Intake</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="sessionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center space-x-1">
                    <Clock className="h-4 w-4" />
                    <span>Session Date & Time *</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={formatDateTimeLocal(new Date(field.value))}
                      onChange={(e) => field.onChange(parseDateTimeLocal(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Session Templates</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SESSION_TEMPLATES).map((templateType) => (
                <Button
                  key={templateType}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(templateType)}
                  className="capitalize"
                >
                  {templateType} Template
                </Button>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Click a template to auto-fill common sections for that session type.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Session Goals & Objectives</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Goals</FormLabel>
                  <FormControl>
                    <Textarea 
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Describe the goals and objectives for this session..."
                      rows={4}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="h-5 w-5" />
              <span>Clinical Documentation</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Notes *</FormLabel>
                  <FormControl>
                    <Textarea 
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Document the session content, patient responses, and clinical observations..."
                      rows={6}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interventions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Interventions Used</FormLabel>
                  <FormControl>
                    <Textarea 
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Describe the therapeutic interventions and techniques used during the session..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Progress & Planning</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient Progress</FormLabel>
                  <FormControl>
                    <Textarea 
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Describe the patient's progress toward treatment goals..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="planForNextSession"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan for Next Session</FormLabel>
                  <FormControl>
                    <Textarea 
                      name={field.name}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Outline the plan and focus areas for the next session..."
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
              {/* Left side - Form status and validation */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  {form.formState.isDirty && (
                    <div className="flex items-center space-x-1 text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Unsaved changes</span>
                    </div>
                  )}
                  {form.formState.isValid && !form.formState.isDirty && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Form is valid</span>
                    </div>
                  )}
                </div>
                
                {/* Form completion progress */}
                <div className="flex items-center space-x-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${getFormCompletionPercentage()}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600">
                    {getFormCompletionPercentage()}% complete
                  </span>
                </div>
                
                {Object.keys(form.formState.errors).length > 0 && (
                  <div className="text-sm text-red-600">
                    {Object.keys(form.formState.errors).length} field(s) need attention
                  </div>
                )}
              </div>

              {/* Right side - Action buttons */}
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                {/* Cancel Button */}
                <Button 
                  type="button" 
                  variant="outline" 
                  disabled={isLoading}
                  onClick={() => {
                    if (form.formState.isDirty) {
                      if (confirm("You have unsaved changes. Are you sure you want to cancel?")) {
                        form.reset();
                        // Navigate back or close form
                        window.history.back();
                      }
                    } else {
                      window.history.back();
                    }
                  }}
                  className="min-w-[120px]"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>

                {/* Save Draft Button */}
                <Button 
                  type="button" 
                  variant="secondary" 
                  disabled={isLoading || !form.formState.isDirty}
                  onClick={() => {
                    // Save as draft (could be implemented later)
                    toast({
                      title: "Draft Saved",
                      description: "Your progress has been saved as a draft.",
                    });
                  }}
                  className="min-w-[120px]"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Save Draft
                </Button>

                {/* Submit Button */}
                <Button 
                  type="button" 
                  disabled={isLoading || !form.formState.isValid}
                  onClick={handleSaveClick}
                  className="min-w-[140px] bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Record
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 flex flex-wrap gap-4">
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">S</kbd>
                  <span>Save</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">Esc</kbd>
                  <span>Cancel</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
