import { useState, useEffect } from "react";
import { Bell, Check, X, Clock, AlertTriangle, User, Calendar, FileText, ChevronRight, UserCheck, Mail, Users, Lock, ClipboardCheck } from "lucide-react";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { openPatientDialog } = usePatientDialog();

  // Fetch notifications
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications?limit=10");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const data = await response.json();
      return data;
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
  });

  // Fetch unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await fetch("/api/notifications/unread-count");
      if (!response.ok) throw new Error("Failed to fetch unread count");
      const data = await response.json();
      return data.count;
    },
    refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue polling even when tab is not active
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
    
    // Close the dropdown
    setIsOpen(false);

    // Check notification type first, regardless of data
    if (notification.type === "discharge_request_created" || 
        notification.type === "discharge_request_approved" || 
        notification.type === "discharge_request_denied") {
      
      toast({
        title: "Opening discharge requests",
        description: "Taking you to the discharge requests page...",
      });
      setLocation("/discharge-requests");
      return;
    }

    // Navigate based on notification type and data
    if (notification.data) {
      
      // Appointment notifications
      if (notification.data.appointmentId) {
        console.log("📅 Appointment notification detected");
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
          // Navigate to patient overview for patient assignment notifications
          toast({
            title: "Opening patient overview",
            description: "Taking you to the patient overview...",
          });
          
          setLocation(`/patients/${notification.data.patientId}`);
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
      case "patient_assigned":
        // Navigate to patient overview for patient assignment notifications
        const patientId = notification.data?.patientId || notification.data?.patientData?.patientId;
        
        if (patientId) {
          toast({
            title: "Opening patient overview",
            description: "Taking you to the patient overview...",
          });
          setLocation(`/patients/${patientId}`);
          return;
        }
        break;
        
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
        console.log("🏠 Default case - navigating to dashboard");
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

  const unreadNotifications = notifications.filter((n: Notification) => !n.read);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between p-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
            >
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No notifications</p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification: Notification, index: number) => {
              console.log(`🔔 Rendering notification ${index}:`, {
                id: notification.id,
                type: notification.type,
                title: notification.title,
                data: notification.data
              });
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !notification.read ? "bg-blue-50" : ""
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("🖱️ Notification clicked:", notification);
                    console.log("🖱️ Notification type:", notification.type);
                    console.log("🖱️ Notification data:", notification.data);
                    handleNotificationClick(notification);
                  }}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <p className={`text-sm font-medium ${
                          !notification.read ? "text-gray-900" : "text-gray-700"
                        }`}>
                          {notification.title}
                        </p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        {!notification.read && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-xs text-blue-600">New</span>
                          </div>
                        )}
                        <ChevronRight className="h-3 w-3 text-gray-400 ml-auto" />
                      </div>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}

        {notifications.length > 0 && (
          <DropdownMenuSeparator />
        )}

        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setIsOpen(false);
              // Navigate to notifications page
              setLocation("/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 