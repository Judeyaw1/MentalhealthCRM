import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Filter,
  Search,
  Shield,
  User,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
  Trash,
  Download,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function AuditLogs() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    action: "",
    resourceType: "",
    userId: "",
    startDate: "",
    endDate: "",
    search: "",
  });
  const [uniqueLoginCount, setUniqueLoginCount] = useState<number | null>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  // Fetch audit logs
  const { data: auditLogs, isLoading: logsLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        // Skip "all" values as they represent "no filter"
        if (value && value !== "all") params.append(key, value);
      });
      
      const response = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      return response.json();
    },
    retry: false,
  });

  // Fetch users for filtering
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/staff"],
    queryFn: async () => {
      const response = await fetch("/api/staff");
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }
      return response.json();
    },
    retry: false,
  });

  // Only fetch unique logins for admin users (last 7 days)
  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      fetch(`/api/audit-logs/unique-logins?days=7`)
        .then((res) => res.json())
        .then((data) => setUniqueLoginCount(data.count))
        .catch(() => setUniqueLoginCount(null));
    }
  }, [isAuthenticated, user]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "create":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "read":
        return <Eye className="h-4 w-4 text-blue-600" />;
      case "update":
        return <Edit className="h-4 w-4 text-yellow-600" />;
      case "delete":
        return <Trash className="h-4 w-4 text-red-600" />;
      case "login":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "logout":
        return <XCircle className="h-4 w-4 text-gray-600" />;
      case "password_reset":
        return <RefreshCw className="h-4 w-4 text-orange-600" />;
      case "emergency_access":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, string> = {
      create: "bg-green-100 text-green-800",
      read: "bg-blue-100 text-blue-800",
      update: "bg-yellow-100 text-yellow-800",
      delete: "bg-red-100 text-red-800",
      login: "bg-green-100 text-green-800",
      logout: "bg-gray-100 text-gray-800",
      password_reset: "bg-orange-100 text-orange-800",
      emergency_access: "bg-red-100 text-red-800",
    };

    return (
      <Badge className={variants[action] || "bg-gray-100 text-gray-800"}>
        {action.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getResourceTypeBadge = (resourceType: string) => {
    const variants: Record<string, string> = {
      patient: "bg-purple-100 text-purple-800",
      appointment: "bg-blue-100 text-blue-800",
      treatment_record: "bg-green-100 text-green-800",
      user: "bg-orange-100 text-orange-800",
      session: "bg-gray-100 text-gray-800",
      consent: "bg-pink-100 text-pink-800",
    };

    return (
      <Badge className={variants[resourceType] || "bg-gray-100 text-gray-800"}>
        {resourceType.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getUserName = (userId: string) => {
    const user = users?.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : userId;
  };

  const isSystemActivity = (action: string) => {
    const systemActions = ['login', 'logout', 'password_reset', 'emergency_access'];
    return systemActions.includes(action);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetails(true);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        // Skip "all" values as they represent "no filter"
        if (value && value !== "all") params.append(key, value);
      });
      
      const response = await fetch(`/api/audit-logs/export?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to export audit logs");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Audit logs have been exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export audit logs. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setFilters({
      action: "",
      resourceType: "",
      userId: "",
      startDate: "",
      endDate: "",
      search: "",
    });
    toast({
      title: "Filters Reset",
      description: "All filters have been cleared.",
    });
  };

  if (authLoading || logsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  // Check if user has permission to view audit logs (admin only)
  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <Card className="max-w-md mx-auto mt-20">
                <CardContent className="pt-6 text-center">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Access Restricted
                  </h2>
                  <p className="text-gray-600">
                    You don't have permission to view audit logs. This section is only available to administrators.
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
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
            {/* Unique Logins Card (admin only, last 7 days) */}
            {user?.role === "admin" && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <Card className="flex flex-col gap-2 p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-100 rounded-full p-3">
                      <UserCheck className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {uniqueLoginCount !== null ? uniqueLoginCount : "-"}
                      </div>
                      <div className="text-gray-600 text-sm">Users Logged In (Last 7 Days)</div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (window.location.href = "/")}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Audit Logs
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Monitor system activity and track user actions for compliance and security.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => refetch()}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleExport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="flex items-center gap-2"
                  >
                    <Filter className="h-4 w-4" />
                    Reset Filters
                  </Button>
                </div>
              </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div>
                    <Label htmlFor="search">Search</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="search"
                        placeholder="Search logs..."
                        value={filters.search}
                        onChange={(e) =>
                          setFilters({ ...filters, search: e.target.value })
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="action">Action</Label>
                    <Select
                      value={filters.action}
                      onValueChange={(value) =>
                        setFilters({ ...filters, action: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All actions</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                        <SelectItem value="password_reset">Password Reset</SelectItem>
                        <SelectItem value="emergency_access">Emergency Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="resourceType">Resource Type</Label>
                    <Select
                      value={filters.resourceType}
                      onValueChange={(value) =>
                        setFilters({ ...filters, resourceType: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All resources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All resources</SelectItem>
                        <SelectItem value="patient">Patient</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="treatment_record">Treatment Record</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="session">Session</SelectItem>
                        <SelectItem value="consent">Consent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="userId">User</Label>
                    <Select
                      value={filters.userId}
                      onValueChange={(value) =>
                        setFilters({ ...filters, userId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All users</SelectItem>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={(e) =>
                        setFilters({ ...filters, startDate: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={(e) =>
                        setFilters({ ...filters, endDate: e.target.value })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>System Activity</CardTitle>
                <p className="text-sm text-gray-600 mt-2">
                  Note: Admin user activities are excluded from audit logs for security and privacy purposes.
                </p>
              </CardHeader>
              <CardContent>
                {!auditLogs || auditLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Audit Logs Found
                    </h3>
                    <p className="text-gray-600">
                      No activity has been logged yet, or no logs match your current filters.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Resource ID</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow 
                            key={log.id}
                            className={isSystemActivity(log.action) ? "bg-blue-50/50" : ""}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-gray-400" />
                                {formatDate(log.timestamp)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-gray-400" />
                                {getUserName(log.userId)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getActionIcon(log.action)}
                                {getActionBadge(log.action)}
                                {isSystemActivity(log.action) && (
                                  <Badge variant="outline" className="text-xs">
                                    System
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getResourceTypeBadge(log.resourceType)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {log.resourceId}
                            </TableCell>
                            <TableCell className="text-sm text-gray-600">
                              {log.ipAddress || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewDetails(log)}
                                className="flex items-center gap-2"
                              >
                                <Eye className="h-4 w-4" />
                                Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg sm:max-w-xl w-full">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedLog.id && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">ID</Label>
                    <p className="font-mono text-sm break-all whitespace-pre-wrap">{selectedLog.id}</p>
                  </div>
                )}
                {selectedLog.timestamp && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Timestamp</Label>
                    <p className="break-all whitespace-pre-wrap">{formatDate(selectedLog.timestamp)}</p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">User</Label>
                    <p className="break-all whitespace-pre-wrap">{getUserName(selectedLog.userId)}</p>
                  </div>
                )}
                {selectedLog.action && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Action</Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActionIcon(selectedLog.action)}
                      {getActionBadge(selectedLog.action)}
                    </div>
                  </div>
                )}
                {selectedLog.resourceType && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Resource Type</Label>
                    {getResourceTypeBadge(selectedLog.resourceType)}
                  </div>
                )}
                {selectedLog.resourceId && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Resource ID</Label>
                    <p className="font-mono text-sm break-all whitespace-pre-wrap">{selectedLog.resourceId}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-gray-600">IP Address</Label>
                  <p className="font-mono text-sm break-all whitespace-pre-wrap">{selectedLog.ipAddress || (selectedLog.details && (() => { try { return JSON.parse(selectedLog.details).ipAddress; } catch { return 'N/A'; } })()) || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Session ID</Label>
                  <p className="font-mono text-sm break-all whitespace-pre-wrap">{selectedLog.sessionId || 'N/A'}</p>
                </div>
              </div>

              {selectedLog.details && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Details</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md max-h-60 overflow-auto text-sm break-all whitespace-pre-wrap">
                    <pre className="break-all whitespace-pre-wrap">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedLog.details), null, 2);
                        } catch {
                          return selectedLog.details;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">User Agent</Label>
                  <p className="text-sm text-gray-600 break-all whitespace-pre-wrap">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 