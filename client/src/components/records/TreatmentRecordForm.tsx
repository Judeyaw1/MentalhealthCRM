import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTreatmentRecordSchema, type InsertTreatmentRecord } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface TreatmentRecordFormProps {
  initialData?: Partial<InsertTreatmentRecord>;
  onSubmit: (data: InsertTreatmentRecord) => void;
  isLoading?: boolean;
  patients?: { id: number; firstName: string; lastName: string }[];
}

export function TreatmentRecordForm({ 
  initialData, 
  onSubmit, 
  isLoading = false,
  patients = []
}: TreatmentRecordFormProps) {
  const form = useForm<InsertTreatmentRecord>({
    resolver: zodResolver(insertTreatmentRecordSchema),
    defaultValues: {
      patientId: initialData?.patientId || 0,
      therapistId: initialData?.therapistId || "",
      sessionDate: initialData?.sessionDate || new Date(),
      sessionType: initialData?.sessionType || "therapy",
      notes: initialData?.notes || "",
      goals: initialData?.goals || "",
      interventions: initialData?.interventions || "",
      progress: initialData?.progress || "",
      planForNextSession: initialData?.planForNextSession || "",
    },
  });

  const handleSubmit = (data: InsertTreatmentRecord) => {
    onSubmit(data);
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Session Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient *</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
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
                    <FormLabel>Session Type *</FormLabel>
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
                  <FormLabel>Session Date & Time *</FormLabel>
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

        <Card>
          <CardHeader>
            <CardTitle>Session Goals & Objectives</CardTitle>
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
                      {...field} 
                      placeholder="Describe the goals and objectives for this session..."
                      rows={3}
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
            <CardTitle>Clinical Documentation</CardTitle>
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
                      {...field} 
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
                      {...field} 
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
            <CardTitle>Progress & Planning</CardTitle>
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
                      {...field} 
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
                      {...field} 
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

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Treatment Record"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
