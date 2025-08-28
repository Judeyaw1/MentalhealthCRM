import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { showFileUploadToast, showCRUDToast, showErrorToast } from "@/lib/toast-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Download, 
  Trash2, 
  Plus, 
  Edit, 
  Save, 
  X, 
  FileText, 
  User, 
  Phone, 
  Mail, 
  Calendar,
  CreditCard,
  Shield,
  Heart,
  Accessibility,
  Globe,
  BookOpen,
  Users,
  Bell,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import type { PatientMiscellaneous } from "@/shared/types";

interface PatientMiscellaneousProps {
  patientId: string;
  patient?: {
    emergencyContact?: {
      name?: string;
      relationship?: string;
      phone?: string;
    };
  };
}

export default function PatientMiscellaneous({ patientId, patient }: PatientMiscellaneousProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [fileUploadData, setFileUploadData] = useState({
    category: 'general',
    description: ''
  });
  
  // Safety check for patient prop
  const hasPatientEmergencyContact = patient && patient.emergencyContact && patient.emergencyContact.name;
  
  // Debug logging
  console.log("🔍 PatientMiscellaneous - patient prop:", patient);
  console.log("🔍 PatientMiscellaneous - hasPatientEmergencyContact:", hasPatientEmergencyContact);

  // Fetch patient data for insurance sync
  const { data: patientData } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}`);
      if (!response.ok) throw new Error("Failed to fetch patient data");
      return response.json();
    },
    enabled: !!patientId,
  });

  // Fetch miscellaneous data
  const { data: miscData, isLoading } = useQuery({
    queryKey: ["patient-miscellaneous", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/miscellaneous`);
      if (!response.ok) throw new Error("Failed to fetch miscellaneous data");
      const data = await response.json();
      console.log("🔍 Fetched miscellaneous data:", data);
      if (data.uploadedFiles) {
        console.log("🔍 Uploaded files:", data.uploadedFiles);
        data.uploadedFiles.forEach((file: any, index: number) => {
          console.log(`🔍 File ${index}:`, { 
            name: file.originalName, 
            description: file.description, 
            category: file.category 
          });
        });
      }
      return data;
    },
    enabled: !!patientId,
  });

  // Sync insurance data from patient registration
  const syncInsuranceData = () => {
    if (patientData?.insurance && !miscData?.insurance) {
      // If patient has insurance data but miscellaneous doesn't, sync it
      const insuranceData = {
        provider: patientData.insurance.provider || "",
        policyNumber: patientData.insurance.policyNumber || "",
        groupNumber: patientData.insurance.groupNumber || "",
        coverageLimits: patientData.insurance.coverageLimits || "",
        notes: patientData.insurance.notes || "",
      };
      
      updateMutation.mutate({ insurance: insuranceData });
    }
  };

  // Auto-sync when patient data is available
  useEffect(() => {
    if (patientData && miscData) {
      syncInsuranceData();
    }
  }, [patientData, miscData]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PatientMiscellaneous>) => {
      const response = await fetch(`/api/patients/${patientId}/miscellaneous`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update miscellaneous data");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-miscellaneous", patientId] });
      showCRUDToast('update', 'miscellaneous data', true);
      setEditingSection(null);
      setEditData({});
    },
    onError: (error) => {
      toast({ 
        title: "Update failed", 
        description: error.message || "Failed to update miscellaneous data.",
        variant: "destructive"
      });
    },
  });

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      console.log("🔍 Upload mutation started for patient:", patientId);
      console.log("🔍 Sending request to:", `/api/patients/${patientId}/files`);
      
      const response = await fetch(`/api/patients/${patientId}/files`, {
        method: "POST",
        body: formData,
      });
      
      console.log("🔍 Upload response status:", response.status);
      console.log("🔍 Upload response headers:", response.headers);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Upload failed:", errorText);
        throw new Error(`Failed to upload file: ${response.status} ${errorText}`);
      }
      
      const result = await response.json();
      console.log("🔍 Upload successful:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-miscellaneous", patientId] });
      showFileUploadToast(true);
      setUploading(false);
      // Reset the form after successful upload
      setFileUploadData({ category: 'general', description: '' });
    },
    onError: (error) => {
      showFileUploadToast(false);
      setUploading(false);
    },
  });

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "general");
    formData.append("description", "");

    uploadMutation.mutate(formData);
  };

  // Handle file upload with category
  const handleFileUploadWithCategory = async (event: React.ChangeEvent<HTMLInputElement>, category: string, description: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("🔍 File upload started:", { file: file.name, size: file.size, type: file.type, category, description });

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("description", description);

    console.log("🔍 FormData created:", formData);
    console.log("🔍 FormData entries:");
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }

    uploadMutation.mutate(formData);
  };

  // Handle file download
  const handleFileDownload = async (fileId: string, originalName: string) => {
    try {
      const response = await fetch(`/api/patients/${patientId}/files/${fileId}`);
      if (!response.ok) throw new Error("Failed to download file");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      showErrorToast("Download failed", "Failed to download file.");
    }
  };

  // Handle file deletion
  const handleFileDelete = async (fileId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const response = await fetch(`/api/patients/${patientId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete file");
      
      queryClient.invalidateQueries({ queryKey: ["patient-miscellaneous", patientId] });
      showCRUDToast('delete', 'file', true);
    } catch (error) {
      showCRUDToast('delete', 'file', false);
    }
  };

  // Start editing a section
  const startEditing = (section: string, data: any) => {
    setEditingSection(section);
    setEditData(data || {});
  };

  // Save changes
  const saveChanges = () => {
    if (editingSection === "communityResources" || editingSection === "healthcareProviders") {
      // Handle array-based resources
      const currentData = miscData?.[editingSection] || [];
      let updatedData;
      
      if (editData._editIndex !== undefined) {
        // Editing existing resource
        updatedData = [...currentData];
        updatedData[editData._editIndex] = { ...editData };
        delete updatedData[editData._editIndex]._editIndex;
      } else {
        // Adding new resource
        updatedData = [...currentData, { ...editData }];
      }
      
      updateMutation.mutate({ [editingSection]: updatedData });
    } else {
      // Handle other sections (single objects)
      updateMutation.mutate(editData);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingSection(null);
    setEditData({});
  };

  // Start editing with index for editing existing resources
  const startEditingWithIndex = (section: string, data: any, index?: number) => {
    setEditingSection(section);
    if (index !== undefined) {
      setEditData({ ...data[index], _editIndex: index });
    } else {
      setEditData({});
    }
  };

  // Handle adding new resource
  const handleAddResource = (section: string) => {
    setEditingSection(section);
    setEditData({});
  };

  // Handle deleting resource
  const handleDeleteResource = (section: string, index: number) => {
    if (!confirm("Are you sure you want to delete this resource?")) return;
    
    const currentData = miscData?.[section] || [];
    const updatedData = currentData.filter((_, i) => i !== index);
    
    updateMutation.mutate({ [section]: updatedData });
    setEditingSection(null);
    setEditData({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading miscellaneous data...</p>
        </div>
      </div>
    );
  }

  // Safety check for patient prop
  if (!patient) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center text-red-600">
          <p>Error: Patient data not available</p>
          <p className="text-sm text-gray-500 mt-2">Please refresh the page or navigate back to patient list.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Patient Miscellaneous Information</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => startEditing("general", {})}>
            <Plus className="w-4 h-4 mr-2" />
            Add Note
          </Button>
        </div>
      </div>

      <Tabs defaultValue="administrative" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="administrative">Administrative</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Administrative Tab */}
        <TabsContent value="administrative" className="space-y-4">
          {/* Insurance Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Insurance Information</span>
                {patientData?.insurance && (
                  <Badge variant="outline" className="ml-2">
                    {miscData?.insurance ? "Synced" : "Not Synced"}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex space-x-2">
                {patientData?.insurance && !miscData?.insurance && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={syncInsuranceData}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync from Registration
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => startEditing("insurance", miscData?.insurance || {})}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {editingSection === "insurance" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Provider</Label>
                      <Input
                        value={editData.provider || ""}
                        onChange={(e) => setEditData({ ...editData, provider: e.target.value })}
                        placeholder="Insurance provider"
                      />
                    </div>
                    <div>
                      <Label>Policy Number</Label>
                      <Input
                        value={editData.policyNumber || ""}
                        onChange={(e) => setEditData({ ...editData, policyNumber: e.target.value })}
                        placeholder="Policy number"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Group Number</Label>
                      <Input
                        value={editData.groupNumber || ""}
                        onChange={(e) => setEditData({ ...editData, groupNumber: e.target.value })}
                        placeholder="Group number"
                      />
                    </div>
                    <div>
                      <Label>Coverage Limits</Label>
                      <Input
                        value={editData.coverageLimits || ""}
                        onChange={(e) => setEditData({ ...editData, coverageLimits: e.target.value })}
                        placeholder="Coverage limits"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes || ""}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={saveChanges}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {miscData?.insurance ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold">Provider:</span> {miscData.insurance.provider}
                        </div>
                        <div>
                          <span className="font-semibold">Policy Number:</span> {miscData.insurance.policyNumber}
                        </div>
                      </div>
                      {miscData.insurance.groupNumber && (
                        <div>
                          <span className="font-semibold">Group Number:</span> {miscData.insurance.groupNumber}
                        </div>
                      )}
                      {miscData.insurance.coverageLimits && (
                        <div>
                          <span className="font-semibold">Coverage Limits:</span> {miscData.insurance.coverageLimits}
                        </div>
                      )}
                      {miscData.insurance.notes && (
                        <div>
                          <span className="font-semibold">Notes:</span> {miscData.insurance.notes}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">No insurance information recorded</p>
                  )}
                  
                  {/* Show patient registration insurance data for comparison */}
                  {patientData?.insurance && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                        <CreditCard className="w-4 h-4 mr-2" />
                        Patient Registration Insurance Data
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-blue-700">Provider:</span> {patientData.insurance.provider || "Not specified"}
                        </div>
                        <div>
                          <span className="font-medium text-blue-700">Policy Number:</span> {patientData.insurance.policyNumber || "Not specified"}
                        </div>
                        {patientData.insurance.groupNumber && (
                          <div>
                            <span className="font-medium text-blue-700">Group Number:</span> {patientData.insurance.groupNumber}
                          </div>
                        )}
                        {patientData.insurance.coverageLimits && (
                          <div>
                            <span className="font-medium text-blue-700">Coverage Limits:</span> {patientData.insurance.coverageLimits}
                          </div>
                        )}
                        {patientData.insurance.notes && (
                          <div>
                            <span className="font-medium text-blue-700">Notes:</span> {patientData.insurance.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contacts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Phone className="h-5 w-5" />
                <span>Emergency Contacts</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => startEditing("emergencyContacts", miscData?.emergencyContacts || [])}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              {/* Show sync status */}
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center space-x-2 text-blue-700">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Synchronized with Patient Registration</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Changes here will automatically sync to the patient's main emergency contact. The primary contact becomes the main emergency contact.
                </p>
              </div>
              
              {/* Show current patient emergency contact for reference */}
              {hasPatientEmergencyContact && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-gray-700">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">Current Patient Emergency Contact</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    <div><span className="font-medium">Name:</span> {patient.emergencyContact.name}</div>
                    <div><span className="font-medium">Relationship:</span> {patient.emergencyContact.relationship || "Not specified"}</div>
                    <div><span className="font-medium">Phone:</span> {patient.emergencyContact.phone || "Not specified"}</div>
                  </div>
                </div>
              )}
              
              {editingSection === "emergencyContacts" ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {editData.map((contact: any, index: number) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label>Name</Label>
                            <Input
                              value={contact.name || ""}
                              onChange={(e) => {
                                const newContacts = [...editData];
                                newContacts[index].name = e.target.value;
                                setEditData(newContacts);
                              }}
                              placeholder="Contact name"
                            />
                          </div>
                          <div>
                            <Label>Relationship</Label>
                            <Input
                              value={contact.relationship || ""}
                              onChange={(e) => {
                                const newContacts = [...editData];
                                newContacts[index].relationship = e.target.value;
                                setEditData(newContacts);
                              }}
                              placeholder="e.g., Spouse, Parent"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <Label>Phone</Label>
                            <Input
                              value={contact.phone || ""}
                              onChange={(e) => {
                                const newContacts = [...editData];
                                newContacts[index].phone = e.target.value;
                                setEditData(newContacts);
                              }}
                              placeholder="Phone number"
                            />
                          </div>
                          <div>
                            <Label>Email (optional)</Label>
                            <Input
                              value={contact.email || ""}
                              onChange={(e) => {
                                const newContacts = [...editData];
                                newContacts[index].email = e.target.value;
                                setEditData(newContacts);
                              }}
                              placeholder="Email address"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`primary-${index}`}
                              checked={contact.isPrimary || false}
                              onCheckedChange={(checked) => {
                                const newContacts = editData.map((c: any, i: number) => ({
                                  ...c,
                                  isPrimary: i === index ? checked : false
                                }));
                                setEditData(newContacts);
                              }}
                            />
                            <Label htmlFor={`primary-${index}`}>Primary contact</Label>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newContacts = editData.filter((_: any, i: number) => i !== index);
                              setEditData(newContacts);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      const newContact = {
                        name: "",
                        relationship: "",
                        phone: "",
                        email: "",
                        isPrimary: editData.length === 0
                      };
                      setEditData([...editData, newContact]);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Contact
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button onClick={saveChanges}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {miscData?.emergencyContacts && miscData.emergencyContacts.length > 0 ? (
                    miscData.emergencyContacts.map((contact, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {contact.isPrimary && <Badge variant="secondary">Primary</Badge>}
                            <span className="font-semibold">{contact.name}</span>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>Relationship: {contact.relationship}</div>
                          <div>Phone: {contact.phone}</div>
                          {contact.email && <div>Email: {contact.email}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No emergency contacts recorded</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4">
          {/* Communication Preferences */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Communication Preferences</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => startEditing("communicationPreferences", miscData?.communicationPreferences || {})}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              {editingSection === "communicationPreferences" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Preferred Language</Label>
                      <Input
                        value={editData.preferredLanguage || ""}
                        onChange={(e) => setEditData({ ...editData, preferredLanguage: e.target.value })}
                        placeholder="e.g., English, Spanish"
                      />
                    </div>
                    <div>
                      <Label>Communication Style</Label>
                      <Select
                        value={editData.communicationStyle || ""}
                        onValueChange={(value) => setEditData({ ...editData, communicationStyle: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="gentle">Gentle</SelectItem>
                          <SelectItem value="visual">Visual</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="interpreterNeeded"
                      checked={editData.interpreterNeeded || false}
                      onCheckedChange={(checked) => setEditData({ ...editData, interpreterNeeded: checked })}
                    />
                    <Label htmlFor="interpreterNeeded">Interpreter needed</Label>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes || ""}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Additional communication preferences"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={saveChanges}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {miscData?.communicationPreferences ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold">Preferred Language:</span> {miscData.communicationPreferences.preferredLanguage || "Not specified"}
                        </div>
                        <div>
                          <span className="font-semibold">Communication Style:</span> {miscData.communicationPreferences.communicationStyle || "Not specified"}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold">Interpreter Needed:</span> {miscData.communicationPreferences.interpreterNeeded ? "Yes" : "No"}
                      </div>
                      {miscData.communicationPreferences.notes && (
                        <div>
                          <span className="font-semibold">Notes:</span> {miscData.communicationPreferences.notes}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">No communication preferences recorded</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cultural Considerations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Cultural Considerations</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => startEditing("culturalConsiderations", miscData?.culturalConsiderations || {})}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </CardHeader>
            <CardContent>
              {editingSection === "culturalConsiderations" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Cultural Background</Label>
                      <Input
                        value={editData.culturalBackground || ""}
                        onChange={(e) => setEditData({ ...editData, culturalBackground: e.target.value })}
                        placeholder="e.g., Hispanic, African American"
                      />
                    </div>
                    <div>
                      <Label>Religious Practices</Label>
                      <Input
                        value={editData.religiousPractices || ""}
                        onChange={(e) => setEditData({ ...editData, religiousPractices: e.target.value })}
                        placeholder="e.g., Christian, Muslim, None"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Dietary Restrictions</Label>
                    <Input
                      value={editData.dietaryRestrictions || ""}
                      onChange={(e) => setEditData({ ...editData, dietaryRestrictions: e.target.value })}
                      placeholder="e.g., Vegetarian, Halal, Kosher"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes || ""}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Additional cultural considerations"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={saveChanges}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {miscData?.culturalConsiderations ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="font-semibold">Cultural Background:</span> {miscData.culturalConsiderations.culturalBackground || "Not specified"}
                        </div>
                        <div>
                          <span className="font-semibold">Religious Practices:</span> {miscData.culturalConsiderations.religiousPractices || "Not specified"}
                        </div>
                      </div>
                      {miscData.culturalConsiderations.dietaryRestrictions && (
                        <div>
                          <span className="font-semibold">Dietary Restrictions:</span> {miscData.culturalConsiderations.dietaryRestrictions}
                        </div>
                      )}
                      {miscData.culturalConsiderations.notes && (
                        <div>
                          <span className="font-semibold">Notes:</span> {miscData.culturalConsiderations.notes}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">No cultural considerations recorded</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4">
          {/* Community Resources */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Community Resources</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAddResource("communityResources")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Resource
              </Button>
            </CardHeader>
            <CardContent>
              {editingSection === "communityResources" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Resource Type</Label>
                      <Select 
                        value={editData.type || ""} 
                        onValueChange={(value) => setEditData({ ...editData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="support_group">Support Group</SelectItem>
                          <SelectItem value="crisis_hotline">Crisis Hotline</SelectItem>
                          <SelectItem value="community_center">Community Center</SelectItem>
                          <SelectItem value="food_assistance">Food Assistance</SelectItem>
                          <SelectItem value="housing">Housing Support</SelectItem>
                          <SelectItem value="transportation">Transportation</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Resource Name</Label>
                      <Input
                        value={editData.name || ""}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="Organization name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Contact Information</Label>
                    <Input
                      value={editData.contactInfo || ""}
                      onChange={(e) => setEditData({ ...editData, contactInfo: e.target.value })}
                      placeholder="Phone, email, address, or website"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={editData.description || ""}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      placeholder="What services do they provide?"
                    />
                  </div>
                                      <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={editData.notes || ""}
                        onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                        placeholder="Additional details, requirements, or recommendations"
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={saveChanges}>
                        <Save className="w-4 h-4 mr-2" />
                        Save
                      </Button>
                      <Button variant="outline" onClick={cancelEditing}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      {editData._editIndex !== undefined && (
                        <Button 
                          variant="destructive" 
                          onClick={() => handleDeleteResource("communityResources", editData._editIndex)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      )}
                    </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {miscData?.communityResources && miscData.communityResources.length > 0 ? (
                    miscData.communityResources.map((resource, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{resource.type}</Badge>
                            <span className="font-semibold">{resource.name}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingWithIndex("communityResources", miscData?.communityResources || [], index)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-sm text-gray-600 mt-2">
                          <div><span className="font-medium">Contact:</span> {resource.contactInfo}</div>
                          <div><span className="font-medium">Description:</span> {resource.description}</div>
                          {resource.notes && <div><span className="font-medium">Notes:</span> {resource.notes}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No community resources recorded</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Healthcare Providers */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Heart className="h-5 w-5" />
                <span>Healthcare Providers</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleAddResource("healthcareProviders")}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </CardHeader>
            <CardContent>
              {editingSection === "healthcareProviders" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Provider Type</Label>
                      <Select 
                        value={editData.relationship || ""} 
                        onValueChange={(value) => setEditData({ ...editData, relationship: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary_care">Primary Care</SelectItem>
                          <SelectItem value="psychiatrist">Psychiatrist</SelectItem>
                          <SelectItem value="psychologist">Psychologist</SelectItem>
                          <SelectItem value="specialist">Specialist</SelectItem>
                          <SelectItem value="clinical">Clinical</SelectItem>
                          <SelectItem value="nurse">Nurse</SelectItem>
                          <SelectItem value="social_worker">Social Worker</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Provider Name</Label>
                      <Input
                        value={editData.name || ""}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        placeholder="Doctor or clinic name"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Specialty</Label>
                    <Input
                      value={editData.specialty || ""}
                      onChange={(e) => setEditData({ ...editData, specialty: e.target.value })}
                      placeholder="Area of expertise or specialization"
                    />
                  </div>
                  <div>
                    <Label>Contact Information</Label>
                    <Input
                      value={editData.contactInfo || ""}
                      onChange={(e) => setEditData({ ...editData, contactInfo: e.target.value })}
                      placeholder="Office phone, email, or address"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes || ""}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Treatment history, coordination needs, or other details"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={saveChanges}>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEditing}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                    {editData._editIndex !== undefined && (
                      <Button 
                        variant="destructive" 
                        onClick={() => handleDeleteResource("healthcareProviders", editData._editIndex)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {miscData?.healthcareProviders && miscData.healthcareProviders.length > 0 ? (
                    miscData.healthcareProviders.map((provider, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{provider.relationship}</Badge>
                            <span className="font-semibold">{provider.name}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => startEditingWithIndex("healthcareProviders", miscData?.healthcareProviders || [], index)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="text-sm text-gray-600 mt-2">
                          <div><span className="font-medium">Specialty:</span> {provider.specialty}</div>
                          <div><span className="font-medium">Contact:</span> {provider.contactInfo}</div>
                          {provider.notes && <div><span className="font-medium">Notes:</span> {provider.notes}</div>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-8">No healthcare providers recorded</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Uploaded Files</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* File Upload */}
              <div className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-2">
                    <div className="space-y-3">
                      <div className="flex justify-center space-x-2">
                        <Select 
                          value={fileUploadData.category} 
                          onValueChange={(value) => setFileUploadData({ ...fileUploadData, category: value })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="legal">Legal</SelectItem>
                            <SelectItem value="medical">Medical</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="general">General</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Description (optional)"
                          className="w-48"
                          value={fileUploadData.description}
                          onChange={(e) => setFileUploadData({ ...fileUploadData, description: e.target.value })}
                        />
                      </div>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <span className="text-sm font-medium text-primary hover:text-primary/80">
                          Upload a file
                        </span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          onChange={(e) => handleFileUploadWithCategory(
                            e, 
                            fileUploadData.category, 
                            fileUploadData.description
                          )}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, DOC, images, or any file type
                  </p>
                </div>
              </div>

              {/* File List */}
              <div className="space-y-2">
                {miscData?.uploadedFiles && miscData.uploadedFiles.length > 0 ? (
                  miscData.uploadedFiles.map((file) => (
                    <div key={file.fileId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="font-medium">{file.originalName}</div>
                          <div className="text-sm text-gray-500">
                            {file.category} • {format(new Date(file.uploadedAt), "MMM d, yyyy")} • {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                          </div>
                          {file.description && (
                            <div className="text-sm text-blue-600 mt-1">
                              📝 {file.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFileDownload(file.fileId, file.originalName)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleFileDelete(file.fileId)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No files uploaded yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5" />
                <span>General Notes & Observations</span>
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => startEditing("newNote", {})}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </CardHeader>
            <CardContent>
              {/* Add Note Form */}
              {editingSection === "newNote" && (
                <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                  <h4 className="font-semibold mb-3">Add New Note</h4>
                  <div className="space-y-3">
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={editData.title || ""}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        placeholder="Note title"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={editData.category || ""}
                        onValueChange={(value) => setEditData({ ...editData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff_observation">Staff Observation</SelectItem>
                          <SelectItem value="family_feedback">Family Feedback</SelectItem>
                          <SelectItem value="progress_note">Progress Note</SelectItem>
                          <SelectItem value="behavioral_observation">Behavioral Observation</SelectItem>
                          <SelectItem value="medication_note">Medication Note</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Content</Label>
                      <Textarea
                        value={editData.content || ""}
                        onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                        placeholder="Note content"
                        rows={4}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isPrivate"
                        checked={editData.isPrivate || false}
                        onCheckedChange={(checked) => setEditData({ ...editData, isPrivate: checked })}
                      />
                      <Label htmlFor="isPrivate">Private note (staff only)</Label>
                    </div>
                    <div className="flex space-x-2">
                      <Button onClick={() => {
                        // Create new note
                        const newNote = {
                          title: editData.title,
                          content: editData.content,
                          category: editData.category,
                          isPrivate: editData.isPrivate || false,
                          createdBy: "Current User", // This should come from auth context
                          createdAt: new Date(),
                          updatedAt: new Date()
                        };
                        
                        // Add to generalNotes array
                        const updatedData = {
                          generalNotes: [...(miscData?.generalNotes || []), newNote]
                        };
                        
                        updateMutation.mutate(updatedData);
                      }}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Note
                      </Button>
                      <Button variant="outline" onClick={cancelEditing}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing Notes */}
              <div className="space-y-4">
                {miscData?.generalNotes && miscData.generalNotes.length > 0 ? (
                  miscData.generalNotes.map((note, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{note.category}</Badge>
                          {note.isPrivate && <Badge variant="secondary">Private</Badge>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {format(new Date(note.createdAt), "MMM d, yyyy")}
                        </div>
                      </div>
                      <h4 className="font-semibold mb-2">{note.title}</h4>
                      <p className="text-gray-700">{note.content}</p>
                      <div className="text-xs text-gray-500 mt-2">
                        Created by: {note.createdBy}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No general notes recorded</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
