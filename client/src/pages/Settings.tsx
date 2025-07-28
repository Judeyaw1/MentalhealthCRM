import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChangePasswordForm } from "@/components/staff/ChangePasswordForm";
import { NotificationBell } from "@/components/ui/notification-bell";
import {
  User,
  Key,
  Shield,
  Bell,
  Palette,
  ArrowLeft,
  Save,
  Edit,
  X,
  Check,
  AlertTriangle,
  Info,
  Mail,
  Clock,
  Settings as SettingsIcon,
  TestTube,
  Calendar,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
}

interface NotificationSettings {
  emailNotifications: boolean;
  appointmentReminders: boolean;
  patientUpdates: boolean;
  systemAlerts: boolean;
  inAppNotifications: boolean;
  reminderTiming: "15min" | "30min" | "1hour" | "1day";
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export default function Settings() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });

  // Settings state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    appointmentReminders: true,
    patientUpdates: true,
    systemAlerts: true,
    inAppNotifications: true,
    reminderTiming: "30min",
    quietHours: {
      enabled: false,
      start: "22:00",
      end: "08:00",
    },
  });

  // Password change dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Test notification dialog
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testNotificationType, setTestNotificationType] = useState("general");
  const [testNotificationTitle, setTestNotificationTitle] = useState("Test Notification");
  const [testNotificationMessage, setTestNotificationMessage] = useState("This is a test notification");

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const response = await fetch("/api/auth/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditingProfile(false);
      // Update local storage with new user data
      localStorage.setItem("user", JSON.stringify(data.user));
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You don't have permission to update your profile.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1000);
        return;
      }

      toast({
        title: "Update Failed",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { notifications: NotificationSettings }) => {
      const response = await fetch("/api/auth/update-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update settings");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Your settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: async (data: { type: string; title: string; message: string }) => {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send test notification");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Notification Sent",
        description: "A test notification has been sent successfully.",
      });
      setShowTestDialog(false);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test notification. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async (data: { emailType: string; data?: any }) => {
      const response = await fetch("/api/email/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send test email");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "A test email has been sent to your email address.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to send test email. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handleSettingsSave = () => {
    updateSettingsMutation.mutate({
      notifications: notificationSettings,
    });
  };

  const handleTestNotification = () => {
    testNotificationMutation.mutate({
      type: testNotificationType,
      title: testNotificationTitle,
      message: testNotificationMessage,
    });
  };

  const handleTestEmail = (emailType: string) => {
    const testData = {
      emailType,
      data: {
        patientName: "Test Patient",
        appointmentDate: new Date(),
        appointmentTime: "10:00 AM",
        status: "active",
        updateType: "status_change",
        title: "Test Alert",
        message: "This is a test system alert",
        severity: "info" as const,
      },
    };

    testEmailMutation.mutate(testData);
  };

  const getUserRoleDisplay = (role?: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "supervisor":
        return "Supervisor";
      case "therapist":
        return "Therapist";
      case "staff":
        return "Staff Member";
      case "frontdesk":
        return "Front Desk";
      default:
        return role || "Unknown";
    }
  };

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case "admin":
        return "destructive" as const;
      case "supervisor":
        return "default" as const;
      case "therapist":
        return "default" as const;
      case "staff":
        return "secondary" as const;
      case "frontdesk":
        return "outline" as const;
      default:
        return "secondary" as const;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need to be logged in to access settings.</p>
          <Button onClick={() => window.location.href = "/login"}>
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="flex">
        <Sidebar />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (window.location.href = "/dashboard")}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
                    <p className="text-gray-600 mt-1">
                      Manage your account settings and preferences
                    </p>
                  </div>
                </div>
                <NotificationBell />
              </div>
            </div>

            {/* Profile Section */}
            <Card className="mb-6" id="account-info">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Profile Display */}
                {!isEditingProfile && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {user?.firstName} {user?.lastName}
                        </h3>
                        <p className="text-gray-600">{user?.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={getRoleBadgeVariant(user?.role)}>
                            {getUserRoleDisplay(user?.role)}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "Unknown"}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => setIsEditingProfile(true)}
                        className="flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Edit Profile
                      </Button>
                    </div>
                  </div>
                )}

                {/* Profile Edit Form */}
                {isEditingProfile && (
                  <form onSubmit={handleProfileSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={profileData.firstName}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              firstName: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={profileData.lastName}
                          onChange={(e) =>
                            setProfileData((prev) => ({
                              ...prev,
                              lastName: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profileData.email}
                        onChange={(e) =>
                          setProfileData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        {updateProfileMutation.isPending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Changes
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditingProfile(false);
                          setProfileData({
                            firstName: user?.firstName || "",
                            lastName: user?.lastName || "",
                            email: user?.email || "",
                          });
                        }}
                        className="flex items-center gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* Security Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Password</h3>
                      <p className="text-sm text-gray-600">
                        Update your password to keep your account secure
                      </p>
                    </div>
                    <Button
                      onClick={() => setShowPasswordDialog(true)}
                      className="flex items-center gap-2"
                    >
                      <Key className="h-4 w-4" />
                      Change Password
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
                      <p className="text-sm text-gray-600">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <Button variant="outline" disabled>
                      <Info className="h-4 w-4 mr-2" />
                      Coming Soon
                    </Button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900">Session Management</h3>
                      <p className="text-sm text-gray-600">
                        View and manage your active sessions
                      </p>
                    </div>
                    <Button variant="outline" disabled>
                      <Info className="h-4 w-4 mr-2" />
                      Coming Soon
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification Preferences Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {/* Email Notifications */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email Notifications
                      </h3>
                      <p className="text-sm text-gray-600">
                        Receive notifications via email
                      </p>
                    </div>
                    <Button
                      variant={notificationSettings.emailNotifications ? "default" : "outline"}
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          emailNotifications: !prev.emailNotifications,
                        }))
                      }
                    >
                      {notificationSettings.emailNotifications ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* In-App Notifications */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        In-App Notifications
                      </h3>
                      <p className="text-sm text-gray-600">
                        Show notifications within the application
                      </p>
                    </div>
                    <Button
                      variant={notificationSettings.inAppNotifications ? "default" : "outline"}
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          inAppNotifications: !prev.inAppNotifications,
                        }))
                      }
                    >
                      {notificationSettings.inAppNotifications ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Appointment Reminders */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Appointment Reminders
                      </h3>
                      <p className="text-sm text-gray-600">
                        Get reminded about upcoming appointments
                      </p>
                    </div>
                    <Button
                      variant={notificationSettings.appointmentReminders ? "default" : "outline"}
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          appointmentReminders: !prev.appointmentReminders,
                        }))
                      }
                    >
                      {notificationSettings.appointmentReminders ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Patient Updates */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Patient Updates
                      </h3>
                      <p className="text-sm text-gray-600">
                        Notifications about patient status changes
                      </p>
                    </div>
                    <Button
                      variant={notificationSettings.patientUpdates ? "default" : "outline"}
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          patientUpdates: !prev.patientUpdates,
                        }))
                      }
                    >
                      {notificationSettings.patientUpdates ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* System Alerts */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        System Alerts
                      </h3>
                      <p className="text-sm text-gray-600">
                        Important system notifications and updates
                      </p>
                    </div>
                    <Button
                      variant={notificationSettings.systemAlerts ? "default" : "outline"}
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          systemAlerts: !prev.systemAlerts,
                        }))
                      }
                    >
                      {notificationSettings.systemAlerts ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <Separator />

                  {/* Reminder Timing */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Reminder Timing
                      </h3>
                      <p className="text-sm text-gray-600">
                        How far in advance to send appointment reminders
                      </p>
                    </div>
                    <select
                      value={notificationSettings.reminderTiming}
                      onChange={(e) =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          reminderTiming: e.target.value as "15min" | "30min" | "1hour" | "1day",
                        }))
                      }
                      className="px-3 py-2 border rounded-md"
                    >
                      <option value="15min">15 minutes</option>
                      <option value="30min">30 minutes</option>
                      <option value="1hour">1 hour</option>
                      <option value="1day">1 day</option>
                    </select>
                  </div>

                  {/* Quiet Hours */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4" />
                        Quiet Hours
                      </h3>
                      <p className="text-sm text-gray-600">
                        Pause email notifications during specific hours
                      </p>
                    </div>
                    <Button
                      variant={notificationSettings.quietHours.enabled ? "default" : "outline"}
                      onClick={() =>
                        setNotificationSettings((prev) => ({
                          ...prev,
                          quietHours: {
                            ...prev.quietHours,
                            enabled: !prev.quietHours.enabled,
                          },
                        }))
                      }
                    >
                      {notificationSettings.quietHours.enabled ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {notificationSettings.quietHours.enabled && (
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-gray-50">
                      <div>
                        <Label htmlFor="quietStart">Start Time</Label>
                        <Input
                          id="quietStart"
                          type="time"
                          value={notificationSettings.quietHours.start}
                          onChange={(e) =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              quietHours: {
                                ...prev.quietHours,
                                start: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="quietEnd">End Time</Label>
                        <Input
                          id="quietEnd"
                          type="time"
                          value={notificationSettings.quietHours.end}
                          onChange={(e) =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              quietHours: {
                                ...prev.quietHours,
                                end: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Test Notifications */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <TestTube className="h-4 w-4" />
                      Test Notifications
                    </h3>
                    <p className="text-sm text-gray-600">
                      Send test notifications to verify your settings are working correctly
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setShowTestDialog(true)}
                        className="flex items-center gap-2"
                      >
                        <Bell className="h-4 w-4" />
                        Test In-App Notification
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => handleTestEmail("appointment_reminder")}
                        disabled={testEmailMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        Test Email Notification
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSettingsSave}
                      disabled={updateSettingsMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      {updateSettingsMutation.isPending ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Settings
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Password Change Dialog */}
      <ChangePasswordForm
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSuccess={() => setShowPasswordDialog(false)}
      />

      {/* Test Notification Dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Test Notification</h3>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="testType">Notification Type</Label>
                <select
                  id="testType"
                  value={testNotificationType}
                  onChange={(e) => setTestNotificationType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="general">General</option>
                  <option value="appointment_reminder">Appointment Reminder</option>
                  <option value="patient_update">Patient Update</option>
                  <option value="system_alert">System Alert</option>
                  <option value="treatment_completion">Treatment Completion</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="testTitle">Title</Label>
                <Input
                  id="testTitle"
                  value={testNotificationTitle}
                  onChange={(e) => setTestNotificationTitle(e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="testMessage">Message</Label>
                <textarea
                  id="testMessage"
                  value={testNotificationMessage}
                  onChange={(e) => setTestNotificationMessage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowTestDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTestNotification}
                disabled={testNotificationMutation.isPending}
                className="flex items-center gap-2"
              >
                {testNotificationMutation.isPending ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Send Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 