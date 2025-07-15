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
}

interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  compactMode: boolean;
  showAnimations: boolean;
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
  });

  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: "system",
    compactMode: false,
    showAnimations: true,
  });

  // Password change dialog
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

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
    mutationFn: async (data: { notifications: NotificationSettings; appearance: AppearanceSettings }) => {
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

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileData);
  };

  const handleSettingsSave = () => {
    updateSettingsMutation.mutate({
      notifications: notificationSettings,
      appearance: appearanceSettings,
    });
  };

  const getUserRoleDisplay = (role?: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
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
              <div className="flex items-center gap-2 mb-2">
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
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="appearance" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Appearance
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <Card>
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
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-6">
                <Card>
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
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">Email Notifications</h3>
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

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">Appointment Reminders</h3>
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

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">Patient Updates</h3>
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

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">System Alerts</h3>
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
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Appearance Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">Theme</h3>
                          <p className="text-sm text-gray-600">
                            Choose your preferred color theme
                          </p>
                        </div>
                        <select
                          value={appearanceSettings.theme}
                          onChange={(e) =>
                            setAppearanceSettings((prev) => ({
                              ...prev,
                              theme: e.target.value as "light" | "dark" | "system",
                            }))
                          }
                          className="px-3 py-2 border rounded-md"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">Compact Mode</h3>
                          <p className="text-sm text-gray-600">
                            Reduce spacing for a more compact layout
                          </p>
                        </div>
                        <Button
                          variant={appearanceSettings.compactMode ? "default" : "outline"}
                          onClick={() =>
                            setAppearanceSettings((prev) => ({
                              ...prev,
                              compactMode: !prev.compactMode,
                            }))
                          }
                        >
                          {appearanceSettings.compactMode ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h3 className="font-medium text-gray-900">Animations</h3>
                          <p className="text-sm text-gray-600">
                            Enable smooth animations and transitions
                          </p>
                        </div>
                        <Button
                          variant={appearanceSettings.showAnimations ? "default" : "outline"}
                          onClick={() =>
                            setAppearanceSettings((prev) => ({
                              ...prev,
                              showAnimations: !prev.showAnimations,
                            }))
                          }
                        >
                          {appearanceSettings.showAnimations ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
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
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Password Change Dialog */}
      <ChangePasswordForm
        isOpen={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSuccess={() => setShowPasswordDialog(false)}
      />
    </div>
  );
} 