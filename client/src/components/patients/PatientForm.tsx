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
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

interface PatientFormProps {
  initialData?: Partial<InsertPatient>;
  onSubmit: (data: InsertPatient) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

// Define a form schema that accepts dateOfBirth as a string
const patientFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), {
      message: "Invalid date",
    }),
  gender: z.string().optional(),
  email: z.string().email("Please enter a valid email address").min(1, "Email is required"),
  phone: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  address: z.string().min(1, "Address is required"),
  insurance: z.string().optional(),
  ssn: z.string().optional(),
  reasonForVisit: z.string().optional(),
  status: z.enum(["active", "inactive", "discharged"]).default("active"),
  hipaaConsent: z.boolean().refine((val) => val === true, "HIPAA consent is required"),
  assignedTherapistId: z.string().min(1, "Please assign a therapist").refine((val) => val !== "unassigned", "Please assign a therapist"),
  loc: z.string().min(1, "Level of Care is required"),
  authNumber: z.string().min(1, "Authorization Number is required"),
});

type PatientFormValues = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
  email: string;
  phone?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  address: string;
  insurance?: string;
  ssn?: string;
  reasonForVisit?: string;
  status: string;
  hipaaConsent: boolean;
  assignedTherapistId: string;
  loc: string;
  authNumber: string;
};

export function PatientForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Create Patient Record",
}: PatientFormProps) {
  const { user } = useAuth();
  
  // Fetch therapists for dropdown
  const { data: therapists = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ["/api/therapists"],
    retry: false,
  });

  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [insuranceCardPreview, setInsuranceCardPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  // Refs for auto-focus on validation errors
  const fieldRefs = {
    firstName: useRef<HTMLInputElement>(null),
    lastName: useRef<HTMLInputElement>(null),
    dateOfBirth: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    address: useRef<HTMLInputElement>(null),
    authNumber: useRef<HTMLInputElement>(null),
    loc: useRef<HTMLButtonElement>(null),
    status: useRef<HTMLButtonElement>(null),
    assignedTherapistId: useRef<HTMLButtonElement>(null),
    hipaaConsent: useRef<HTMLButtonElement>(null),
  };

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
      emergencyContact: initialData?.emergencyContact || undefined,
      address: initialData?.address || "",
      insurance: initialData?.insurance || "",
      ssn: initialData?.ssn || "",
      reasonForVisit: initialData?.reasonForVisit || "",
      status: initialData?.status || "active",
      hipaaConsent: initialData?.hipaaConsent || false,
      assignedTherapistId: initialData?.assignedTherapistId || "",
      loc: initialData?.loc || "",
      authNumber: initialData?.authNumber || "",
    },
  });

  // Auto-focus on first error field
  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (type === 'change' && name) {
        // Clear any existing error focus when user starts typing
        return;
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Function to focus on first error field
  const focusOnFirstError = () => {
    const errors = form.formState.errors;
    const errorFields = Object.keys(errors);
    
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0] as keyof typeof fieldRefs;
      const fieldRef = fieldRefs[firstErrorField];
      
      if (fieldRef?.current) {
        // Scroll to the field
        fieldRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Focus on the field after a short delay
        setTimeout(() => {
          fieldRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleSubmit = async (data: PatientFormValues) => {
    // Convert dateOfBirth string to Date object and handle unassigned therapist
    const processedData: InsertPatient = {
      ...data,
      dateOfBirth: new Date(data.dateOfBirth),
      status: data.status as "active" | "inactive" | "discharged" | undefined,
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

  // Handle form submission with error focus
  const onSubmitWithErrorFocus = form.handleSubmit(handleSubmit, (errors) => {
    // Focus on the first error field
    focusOnFirstError();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmitWithErrorFocus} className="space-y-6">
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
                        ref={fieldRefs.firstName}
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
                        ref={fieldRefs.lastName}
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
                      <Input type="date" {...field} ref={fieldRefs.dateOfBirth} value={field.value ?? ""} />
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
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      {...field}
                      ref={fieldRefs.email}
                      placeholder="Enter email address"
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
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
                  name="emergencyContact.name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter emergency contact name"
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
                  name="emergencyContact.relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship to Patient</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g., Spouse, Parent, Sibling"
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="emergencyContact.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          {...field}
                          placeholder="Enter emergency contact phone"
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <AddressAutocomplete
                      ref={fieldRefs.address}
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      placeholder="Enter full address"
                      disabled={isLoading}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                name="ssn"
                render={({ field }) => {
                  const [isFocused, setIsFocused] = useState(false);
                  
                  return (
                    <FormItem>
                      <FormLabel>Social Security Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type={isFocused ? "text" : "password"}
                          placeholder="XXX-XX-XXXX"
                          value={field.value ?? ""}
                          maxLength={11}
                          onFocus={() => setIsFocused(true)}
                          onBlur={() => setIsFocused(false)}
                          onChange={(e) => {
                            // Format SSN as XXX-XX-XXXX
                            let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
                            if (value.length >= 3) {
                              value = value.slice(0, 3) + '-' + value.slice(3);
                            }
                            if (value.length >= 6) {
                              value = value.slice(0, 6) + '-' + value.slice(6);
                            }
                            if (value.length > 11) {
                              value = value.slice(0, 11);
                            }
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
            <FormField
              control={form.control}
              name="authNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authorization Number *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      ref={fieldRefs.authNumber}
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
                  <FormLabel>Level of Care (LOC) *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger ref={fieldRefs.loc}>
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
                  <FormLabel>Status *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger ref={fieldRefs.status}>
                        <SelectValue placeholder="Select patient status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem 
                        value="discharged" 
                        disabled={!(user?.role === "admin" || user?.role === "supervisor")}
                        className={!(user?.role === "admin" || user?.role === "supervisor") ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        Discharged
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!(user?.role === "admin" || user?.role === "supervisor") && (
                    <p className="text-xs text-gray-500 mt-1">
                      Only admin and supervisors can discharge patients
                    </p>
                  )}
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
                  <FormLabel>Assigned Therapist *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger ref={fieldRefs.assignedTherapistId}>
                        <SelectValue placeholder="Select therapist" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                      ref={fieldRefs.hipaaConsent}
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
