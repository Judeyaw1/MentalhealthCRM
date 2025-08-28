import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Custom schema for MongoDB appointments
const insertAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  clinicalId: z.string().min(1, "Clinical ID is required"),
  appointmentDate: z
    .union([z.date(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  duration: z.number().default(60),
  type: z.string().min(1, "Appointment type is required"),
  status: z.string().default("scheduled"),
  notes: z.string().optional(),
});

type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

interface AppointmentFormProps {
  initialData?: Partial<InsertAppointment>;
  onSubmit: (data: InsertAppointment) => void;
  isLoading?: boolean;
  submitLabel?: string;
  patients?: { id: string; firstName: string; lastName: string }[];
  clinicals?: { id: string; firstName: string; lastName: string }[];
  isNewAppointment?: boolean;
  patientHistory?: { [patientId: string]: boolean }; // true = has previous appointments
}

export function AppointmentForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Schedule Appointment",
  patients = [],
  clinicals = [],
  isNewAppointment = false,
  patientHistory = {},
}: AppointmentFormProps) {
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  
  const form = useForm<InsertAppointment>({
    resolver: zodResolver(insertAppointmentSchema),
    defaultValues: {
      patientId: initialData?.patientId?.toString() || "",
      clinicalId: initialData?.clinicalId || "",
      appointmentDate: initialData?.appointmentDate || new Date(),
      duration: initialData?.duration || 60,
      type: initialData?.type || "therapy",
      status: initialData?.status || "scheduled",
      notes: initialData?.notes || "",
    },
  });

  // Watch for patient selection to auto-update appointment type
  const selectedPatientId = form.watch("patientId");
  const selectedPatient = patients.find(p => (p.id || p._id).toString() === selectedPatientId);
  const isReturningPatient = selectedPatient ? patientHistory[selectedPatient.id || selectedPatient._id] : false;

  // Auto-update appointment type based on patient history
  useEffect(() => {
    if (selectedPatientId && isNewAppointment) {
      const defaultType = isReturningPatient ? "therapy" : "consultation";
      form.setValue("type", defaultType);
    }
  }, [selectedPatientId, isReturningPatient, isNewAppointment, form]);

  const handleSubmit = (data: InsertAppointment) => {
    onSubmit(data);
  };

  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
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
            <CardTitle>Appointment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient *</FormLabel>
                    <Popover open={patientSearchOpen} onOpenChange={setPatientSearchOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={patientSearchOpen}
                            className="w-full justify-between"
                          >
                            {field.value
                              ? patients.find((patient) => (patient.id || patient._id).toString() === field.value)?.firstName + " " + 
                                patients.find((patient) => (patient.id || patient._id).toString() === field.value)?.lastName
                              : "Select patient..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search patients..." />
                          <CommandList>
                            <CommandEmpty>No patient found.</CommandEmpty>
                            <CommandGroup>
                              {patients.map((patient) => (
                                <CommandItem
                                  key={patient.id || patient._id}
                                  value={`${patient.firstName} ${patient.lastName}`}
                                  onSelect={() => {
                                    field.onChange((patient.id || patient._id).toString());
                                    setPatientSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === (patient.id || patient._id).toString()
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <User className="mr-2 h-4 w-4" />
                                  {patient.firstName} {patient.lastName}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                    {field.value &&
                      patients.some((p) => (p.id || p._id).toString() === field.value) && (
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
                name="clinicalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinical *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select clinical" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(clinicals) && clinicals.map((clinical) => (
                          <SelectItem key={clinical.id} value={clinical.id}>
                            {clinical.firstName} {clinical.lastName}
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
                name="appointmentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time *</FormLabel>
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

              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 60)
                        }
                        min="15"
                        max="240"
                        step="15"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Appointment Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select appointment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="therapy">Therapy Session</SelectItem>
                        <SelectItem value="consultation">
                          Initial Consultation
                        </SelectItem>
                        <SelectItem value="group">Group Therapy</SelectItem>
                        <SelectItem value="intake">Patient Intake</SelectItem>
                        <SelectItem value="follow-up">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    {isNewAppointment ? (
                      <FormControl>
                        <Input
                          value="Scheduled"
                          disabled
                          className="bg-gray-50 text-gray-600"
                        />
                      </FormControl>
                    ) : (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no-show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Any additional notes about this appointment..."
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
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
