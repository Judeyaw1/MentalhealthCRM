import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Custom schema for MongoDB treatment records (matches backend)
const insertTreatmentRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  therapistId: z.string().min(1, "Therapist ID is required"),
  sessionDate: z
    .union([z.date(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  sessionType: z.string().min(1, "Session type is required"),
  notes: z.string().optional(),
  goals: z.string().optional(),
  interventions: z.string().optional(),
  progress: z.string().optional(),
  planForNextSession: z.string().optional(),
});

type InsertTreatmentRecord = z.infer<typeof insertTreatmentRecordSchema>;

// Type for form submission with timestamp
type TreatmentRecordFormData = Omit<InsertTreatmentRecord, "sessionDate"> & {
  sessionDate: number;
};

interface TreatmentRecordFormProps {
  initialData?: Partial<InsertTreatmentRecord>;
  onSubmit: (data: TreatmentRecordFormData) => void;
  isLoading?: boolean;
  patients?: { id: number; firstName: string; lastName: string }[];
  therapists?: { id: string; firstName: string; lastName: string }[];
}

// Session templates removed per requirement

export function TreatmentRecordForm({
  initialData,
  onSubmit,
  isLoading = false,
  patients = [],
  therapists = [],
}: TreatmentRecordFormProps) {
  const { toast } = useToast();
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  // Template selection removed

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

  // Removed template watchers
  const watchedValues = form.watch();

  // Reset form when initialData changes (for editing)
  useEffect(() => {
    if (initialData) {
      form.reset({
        patientId: initialData.patientId || undefined,
        therapistId: initialData.therapistId || undefined,
        sessionDate: initialData.sessionDate || new Date(),
        sessionType: initialData.sessionType || "therapy",
        notes: initialData.notes || "",
        goals: initialData.goals || "",
        interventions: initialData.interventions || "",
        progress: initialData.progress || "",
        planForNextSession: initialData.planForNextSession || "",
      });
    }
  }, [initialData, form]);

  // Auto-save functionality
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (form.formState.isDirty && !form.formState.isSubmitting) {
        setAutoSaveStatus("saving");
        // Simulate auto-save
        setTimeout(() => {
          setAutoSaveStatus("saved");
          setTimeout(() => setAutoSaveStatus("idle"), 2000);
        }, 1000);
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [watchedValues, form.formState.isDirty, form.formState.isSubmitting]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S to save
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (form.formState.isValid && !isLoading) {
          form.handleSubmit(handleSubmit)();
        }
      }

      // Esc to cancel
      if (event.key === "Escape") {
        event.preventDefault();
        if (form.formState.isDirty) {
          if (
            confirm(
              "You have unsaved changes. Are you sure you want to cancel?",
            )
          ) {
            form.reset();
            window.history.back();
          }
        } else {
          window.history.back();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [form, isLoading]);

  // (Removed effect-driven application; handled directly in applyTemplate)

  const handleSubmit = (data: InsertTreatmentRecord) => {
    // Convert sessionDate from Date to timestamp for the backend
    const submissionData: TreatmentRecordFormData = {
      ...data,
      sessionDate: new Date(data.sessionDate).getTime(),
    };
    console.log("Treatment record form submission data:", submissionData);
    onSubmit(submissionData);
  };

  const handleSaveClick = () => {
    if (form.formState.isValid) {
      // Show confirmation for important fields
      const hasNotes = form.getValues("notes")?.trim();
      const hasPatient = form.getValues("patientId");

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
    // Ensure we preserve local date/time for datetime-local input
    const local = new Date(date);
    const year = local.getFullYear();
    const month = String(local.getMonth() + 1).padStart(2, "0");
    const day = String(local.getDate()).padStart(2, "0");
    const hours = String(local.getHours()).padStart(2, "0");
    const minutes = String(local.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const parseDateTimeLocal = (dateTimeLocal: string) => {
    // Interpret the value as local time (avoid timezone shift)
    const [datePart, timePart] = dateTimeLocal.split("T");
    const [y, m, d] = (datePart || '').split("-").map(Number);
    const [hh, mm] = (timePart || '').split(":").map(Number);
    return new Date(y || 0, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
  };

  // Template application removed

  const getAutoSaveIcon = () => {
    switch (autoSaveStatus) {
      case "saving":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "saved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getAutoSaveText = () => {
    switch (autoSaveStatus) {
      case "saving":
        return "Saving...";
      case "saved":
        return "Saved";
      case "error":
        return "Save failed";
      default:
        return "";
    }
  };

  const getFormCompletionPercentage = () => {
    // Stricter checks: therapistId and patientId must be non-empty strings
    // sessionDate must be a valid date; notes must be non-empty
    const values = form.getValues();
    const requiredChecks = [
      typeof values.patientId === 'string' && values.patientId.trim().length > 0,
      typeof values.therapistId === 'string' && values.therapistId.trim().length > 0,
      !!values.sessionDate && !isNaN(new Date(values.sessionDate as any).getTime()),
      typeof values.sessionType === 'string' && values.sessionType.trim().length > 0,
      typeof values.notes === 'string' && values.notes.trim().length > 0,
    ];

    const optionalChecks = [
      typeof values.goals === 'string' && values.goals.trim().length > 0,
      typeof values.interventions === 'string' && values.interventions.trim().length > 0,
      typeof values.progress === 'string' && values.progress.trim().length > 0,
      typeof values.planForNextSession === 'string' && values.planForNextSession.trim().length > 0,
    ];

    const requiredCompleted = requiredChecks.filter(Boolean).length;
    const optionalCompleted = optionalChecks.filter(Boolean).length;

    const totalRequired = requiredChecks.length;
    const totalOptional = optionalChecks.length;

    return Math.round(((requiredCompleted / totalRequired) * 0.7 + (optionalCompleted / totalOptional) * 0.3) * 100);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Auto-save indicator */}
        {autoSaveStatus !== "idle" && (
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select patient" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem
                            key={patient.id}
                            value={patient.id.toString()}
                          >
                            {patient.firstName} {patient.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {field.value &&
                      patients.some((p) => p.id.toString() === field.value) && (
                        <a
                          href={`/patients/${field.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline text-sm ml-2"
                        >
                          View Patient
                        </a>
                      )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="therapistId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Therapist *</span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select therapist" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(therapists) && therapists.map((therapist) => (
                          <SelectItem
                            key={therapist.id}
                            value={therapist.id.toString()}
                          >
                            {therapist.firstName} {therapist.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <SelectItem value="therapy">
                          Individual Therapy
                        </SelectItem>
                        <SelectItem value="group">Group Therapy</SelectItem>
                        <SelectItem value="family">Family Therapy</SelectItem>
                        <SelectItem value="assessment">Assessment</SelectItem>
                        <SelectItem value="consultation">
                          Consultation
                        </SelectItem>
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
                      onChange={(e) =>
                        field.onChange(parseDateTimeLocal(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Session templates removed */}

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
                      value={field.value ?? ""}
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
                      value={field.value ?? ""}
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
                      value={field.value ?? ""}
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
                      value={field.value ?? ""}
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
                      value={field.value ?? ""}
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
                    {Object.keys(form.formState.errors).length} field(s) need
                    attention
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
                      if (
                        confirm(
                          "You have unsaved changes. Are you sure you want to cancel?",
                        )
                      ) {
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
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
                    Ctrl
                  </kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
                    S
                  </kbd>
                  <span>Save</span>
                </span>
                <span className="flex items-center space-x-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">
                    Esc
                  </kbd>
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
