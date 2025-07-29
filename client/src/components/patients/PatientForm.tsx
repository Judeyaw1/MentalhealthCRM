import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { InsertPatient } from "@shared/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

interface PatientFormProps {
  initialData?: Partial<InsertPatient>;
  onSubmit: (data: InsertPatient) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

// Define a form schema that accepts dateOfBirth as a string
const patientFormSchema = insertPatientSchema.extend({
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: "Invalid date",
    }),
});

type PatientFormValues = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
  address?: string;
  insurance?: string;
  reasonForVisit?: string;
  status?: string;
  hipaaConsent?: boolean;
  assignedTherapistId?: string;
  loc?: string;
  authNumber?: string;
};

export function PatientForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Create Patient Record",
}: PatientFormProps) {
  // Fetch therapists for dropdown
  const { data: therapists = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [insuranceCardPreview, setInsuranceCardPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Handle insurance card upload
  const handleInsuranceCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setInsuranceCardFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setInsuranceCardPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setInsuranceCardPreview(null);
    }
  };

  // Handle photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPhotoPreview(null);
    }
  };

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      dateOfBirth: initialData?.dateOfBirth
        ? new Date(initialData.dateOfBirth).toISOString().split("T")[0]
        : "",
      gender: initialData?.gender || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      emergencyContact: initialData?.emergencyContact || "",
      address: initialData?.address || "",
      insurance: initialData?.insurance || "",
      reasonForVisit: initialData?.reasonForVisit || "",
      status: initialData?.status || "active",
      hipaaConsent: initialData?.hipaaConsent || false,
      assignedTherapistId: initialData?.assignedTherapistId || "",
      loc: initialData?.loc || "",
      authNumber: initialData?.authNumber || "",
    },
  });

  const handleSubmit = async (data: PatientFormValues) => {
    // Convert dateOfBirth string to Date object and handle unassigned therapist
    const processedData: InsertPatient = {
      ...data,
      dateOfBirth: new Date(data.dateOfBirth),
    };
    // Handle file uploads (to be implemented in backend)
    if (insuranceCardFile || photoFile) {
      const formData = new FormData();
      Object.entries(processedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value as any);
        }
      });
      if (insuranceCardFile) formData.append("insuranceCard", insuranceCardFile);
      if (photoFile) formData.append("photo", photoFile);
      // Call onSubmit with FormData (backend must handle multipart/form-data)
      onSubmit(formData as any);
      return;
    }
    onSubmit(processedData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter first name"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter last name"
                        value={field.value ?? ""}
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
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="non-binary">Non-binary</SelectItem>
                        <SelectItem value="prefer-not-to-say">
                          Prefer not to say
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      placeholder="Enter email address"
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        {...field}
                        placeholder="Enter phone number"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency Contact</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        {...field}
                        placeholder="Enter emergency contact"
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter full address"
                      rows={3}
                      value={field.value ?? ""}
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
            <CardTitle>Medical Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="insurance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Insurance Provider</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter insurance provider"
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="authNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authorization Number</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter authorization number"
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="loc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level of Care (LOC)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select LOC" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="2.1">2.1</SelectItem>
                      <SelectItem value="3.3">3.3</SelectItem>
                      <SelectItem value="3.1">3.1</SelectItem>
                      <SelectItem value="0.0">0.0</SelectItem>
                      <SelectItem value="0.0-2">0.0</SelectItem>
                      <SelectItem value="0.0-3">0.0</SelectItem>
                      <SelectItem value="0.0-4">0.0</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reasonForVisit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Visit</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Please describe the primary concerns or reasons for seeking mental health services..."
                      rows={4}
                      value={field.value ?? ""}
                    />
                  </FormControl>
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
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select patient status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="discharged">Discharged</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assign Therapist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="assignedTherapistId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned Therapist</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select therapist" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {Array.isArray(therapists) && therapists.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Uploads Card: move this above Consent & Privacy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FormLabel>Insurance/Medicare Card</FormLabel>
                <Input type="file" accept="image/*,application/pdf" onChange={handleInsuranceCardChange} />
                {insuranceCardPreview && (
                  <div className="mt-2">
                    <img src={insuranceCardPreview} alt="Insurance Card Preview" className="max-h-32 rounded border" />
                  </div>
                )}
              </div>
              <div>
                <FormLabel>Patient Photo</FormLabel>
                <Input type="file" accept="image/*" onChange={handlePhotoChange} />
                {photoPreview && (
                  <div className="mt-2">
                    <img src={photoPreview} alt="Patient Photo Preview" className="max-h-32 rounded-full border" />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Consent & Privacy Card: now below Uploads */}
        <Card>
          <CardHeader>
            <CardTitle>Consent & Privacy</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="hipaaConsent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>HIPAA Consent *</FormLabel>
                    <p className="text-sm text-gray-600">
                      I acknowledge that I have received and understand the
                      HIPAA Notice of Privacy Practices
                    </p>
                  </div>
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
