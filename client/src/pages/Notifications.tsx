import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, X, Clock, AlertTriangle, User, Calendar, FileText, ChevronRight, Filter, Search, UserCheck, Mail, Users, Lock, ClipboardCheck } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePatientDialog } from "@/contexts/PatientDialogContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

export default function Notifications() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { openPatientDialog } = usePatientDialog();
  const { user } = useAuth();

  // Fetch all notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      const response = await fetch("/api/notifications?limit=100");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
  });

  // Real-time socket connection for instant updates
  useSocket({
    onNotificationCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
    onNotificationRead: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "PUT",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
      toast({
        title: "Notifications",
        description: "All notifications marked as read",
      });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete notification");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDeleteNotification = (notificationId: string) => {
    deleteNotificationMutation.mutate(notificationId);
  };

  // Handle notification click and navigation
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read first
    handleMarkAsRead(notification.id);

    // Check notification type first, regardless of data
    if (notification.type === "discharge_request_created" || 
        notification.type === "discharge_request_approved" || 
        notification.type === "discharge_request_denied") {
      
      // Only admin and supervisor can access discharge requests page
      if (user?.role === "admin" || user?.role === "supervisor") {
        toast({
          title: "Opening discharge requests",
          description: "Taking you to the discharge requests page...",
        });
        setLocation("/discharge-requests");
        return;
      } else {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access discharge requests.",
          variant: "destructive",
        });
        return;
      }
    }

    // Navigate based on notification type and data
    if (notification.data) {
      // Appointment notifications
      if (notification.data.appointmentId) {
        toast({
          title: "Opening appointment",
          description: "Taking you to the appointment details...",
        });
        setLocation(`/appointments/${notification.data.appointmentId}`);
        return;
      }
      
      // Patient-related notifications
      if (notification.data.patientId) {
        if (notification.type === "patient_assigned") {
          // Open patient dialog for patient assignment notifications
          toast({
            title: "Opening patient details",
            description: "Opening patient details dialog...",
          });
          openPatientDialog(notification.data.patientId);
          return;
        }
        
        if (notification.type === "directed_note" && notification.data.noteId) {
          // Navigate to patient detail page with notes tab
          toast({
            title: "Opening directed note",
            description: "Taking you to the patient's notes...",
          });
          setLocation(`/patients/${notification.data.patientId}?tab=notes`);
          return;
        }
        
        // For patient_update, discharge_reminder, assessment_followup
        toast({
          title: "Opening patient",
          description: "Taking you to the patient details...",
        });
        setLocation(`/patients/${notification.data.patientId}`);
        return;
      }
      
      // Treatment record notifications
      if (notification.data.treatmentRecordId) {
        toast({
          title: "Opening patient records",
          description: "Taking you to the patient's treatment records...",
        });
        setLocation(`/patients/${notification.data.patientId}`);
        return;
      }
      
      // Inquiry notifications
      if (notification.data.inquiryId) {
        toast({
          title: "Opening inquiries",
          description: "Taking you to the inquiries page...",
        });
        setLocation("/inquiries");
        return;
      }
    }

    // Handle notifications without specific data
    switch (notification.type) {
      case "discharge_request_created":
      case "discharge_request_approved":
      case "discharge_request_denied":
        toast({
          title: "Opening discharge requests",
          description: "Taking you to the discharge requests page...",
        });
        setLocation("/discharge-requests");
        return;
        
      case "staff_invitation":
        toast({
          title: "Opening staff management",
          description: "Taking you to the staff page...",
        });
        setLocation("/staff");
        return;
      
      case "password_reset":
        toast({
          title: "Password reset",
          description: "Please check your email for reset instructions...",
        });
        setLocation("/settings");
        return;
      
      case "system_alert":
      case "general":
        toast({
          title: "System notification",
          description: "Taking you to the dashboard...",
        });
        setLocation("/dashboard");
        return;
      
      default:
        // Default: navigate to dashboard
        toast({
          title: "Opening dashboard",
          description: "Taking you to the dashboard...",
        });
        setLocation("/dashboard");
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "appointment_reminder":
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case "patient_update":
        return <User className="h-4 w-4 text-green-500" />;
      case "patient_assigned":
        return <User className="h-4 w-4 text-indigo-500" />;
      case "discharge_reminder":
        return <UserCheck className="h-4 w-4 text-orange-500" />;
      case "inquiry_received":
        return <Mail className="h-4 w-4 text-cyan-500" />;
      case "staff_invitation":
        return <Users className="h-4 w-4 text-violet-500" />;
      case "password_reset":
        return <Lock className="h-4 w-4 text-amber-500" />;
      case "directed_note":
        return <FileText className="h-4 w-4 text-emerald-500" />;
      case "assessment_followup":
        return <ClipboardCheck className="h-4 w-4 text-teal-500" />;
      case "system_alert":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "treatment_completion":
        return <FileText className="h-4 w-4 text-purple-500" />;
      case "discharge_request_created":
        return <UserCheck className="h-4 w-4 text-blue-500" />;
      case "discharge_request_approved":
        return <UserCheck className="h-4 w-4 text-green-500" />;
      case "discharge_request_denied":
        return <UserCheck className="h-4 w-4 text-red-500" />;
      case "general":
        return <Bell className="h-4 w-4 text-gray-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((notification: Notification) => {
    // Search filter
    if (searchTerm && !notification.title.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !notification.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Type filter
    if (filterType !== "all" && notification.type !== filterType) {
      return false;
    }

    // Read status filter
    if (filterRead === "unread" && notification.read) {
      return false;
    }
    if (filterRead === "read" && !notification.read) {
      return false;
    }

    return true;
  });

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-gray-600">
              {unreadCount} unread • {notifications.length} total
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button onClick={handleMarkAllAsRead} disabled={markAllAsReadMutation.isPending}>
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="appointment_reminder">Appointments</SelectItem>
                  <SelectItem value="patient_update">Patient Updates</SelectItem>
                  <SelectItem value="system_alert">System Alerts</SelectItem>
                  <SelectItem value="treatment_completion">Treatment Records</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={filterRead} onValueChange={setFilterRead}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No notifications found</h3>
            <p className="text-gray-600">
              {notifications.length === 0 
                ? "You don't have any notifications yet."
                : "No notifications match your current filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification: Notification) => (
            <Card 
              key={notification.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                !notification.read ? "border-blue-200 bg-blue-50" : ""
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className={`font-medium ${
                          !notification.read ? "text-gray-900" : "text-gray-700"
                        }`}>
                          {notification.title}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNotification(notification.id);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {notification.type}
                        </Badge>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 