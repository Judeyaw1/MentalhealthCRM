import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  AlertCircle,
  Clock,
  Phone,
  Mail,
  User,
  Calendar,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Inquiry {
  id: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  inquiryType: string;
  status: string;
  priority: string;
  notes: string;
  contactMethod: string;
  contactInfo: string;
  followUpDate?: string;
  assignedTo?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export default function Inquiries() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Redirect to home if not authenticated
  if (!authLoading && !isAuthenticated) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/login";
    }, 500);
    return null;
  }

  // Real-time socket connection for instant updates
  useSocket({
    onInquiryCreated: () => {
      // Refresh inquiries when new ones are created
      window.location.reload();
    },
    onInquiryUpdated: () => {
      // Refresh inquiries when they are updated
      window.location.reload();
    },
  });

  const { data: inquiries, isLoading } = useQuery<Inquiry[]>({
    queryKey: [
      "/api/inquiries",
      { 
        status: statusFilter !== "all" ? statusFilter : undefined, 
        priority: priorityFilter !== "all" ? priorityFilter : undefined 
      },
    ],
    retry: false,
  });

  const filteredInquiries =
    inquiries?.filter((inquiry) => {
      const matchesSearch =
        searchQuery === "" ||
        inquiry.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inquiry.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inquiry.contactInfo.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || inquiry.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || inquiry.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 border-yellow-200"
          >
            Pending
          </Badge>
        );
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge className="bg-red-100 text-red-800">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-100 text-orange-800">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case "low":
        return <Badge className="bg-green-100 text-green-800">Low</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getContactIcon = (method: string) => {
    switch (method) {
      case "phone":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "in_person":
        return <User className="h-4 w-4" />;
      case "referral":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Phone className="h-4 w-4" />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getInquiryTypeDisplay = (type: string) => {
    return type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
                  <h1 className="text-2xl font-semibold text-gray-900">
                    Patient Inquiries
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Manage and track patient inquiries and follow-ups.
                  </p>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Inquiries
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? "..." : inquiries?.length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {isLoading
                      ? "..."
                      : inquiries?.filter((i) => i.status === "pending")
                          .length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    In Progress
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {isLoading
                      ? "..."
                      : inquiries?.filter((i) => i.status === "in_progress")
                          .length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Completed
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {isLoading
                      ? "..."
                      : inquiries?.filter((i) => i.status === "completed")
                          .length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search inquiries by patient name, notes, or contact info..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
              </div>

              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Status
                    </label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Priority
                    </label>
                    <Select
                      value={priorityFilter}
                      onValueChange={setPriorityFilter}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All priorities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All priorities</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Inquiries List */}
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading inquiries...</p>
                </div>
              ) : filteredInquiries.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No inquiries found
                  </h3>
                  <p className="text-gray-600">
                    No inquiries match your current filters.
                  </p>
                </div>
              ) : (
                filteredInquiries.map((inquiry) => (
                  <Card
                    key={inquiry.id}
                    className="hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {inquiry.patientName}
                            </h3>
                            {getStatusBadge(inquiry.status)}
                            {getPriorityBadge(inquiry.priority)}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <AlertCircle className="h-4 w-4" />
                                <span className="font-medium">Type:</span>
                                <span>
                                  {getInquiryTypeDisplay(inquiry.inquiryType)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                {getContactIcon(inquiry.contactMethod)}
                                <span className="font-medium">Contact:</span>
                                <span>{inquiry.contactInfo}</span>
                              </div>

                              {inquiry.assignedTo && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <User className="h-4 w-4" />
                                  <span className="font-medium">
                                    Assigned to:
                                  </span>
                                  <span>
                                    {inquiry.assignedTo.firstName}{" "}
                                    {inquiry.assignedTo.lastName}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock className="h-4 w-4" />
                                <span className="font-medium">Created:</span>
                                <span>{formatDate(inquiry.createdAt)}</span>
                              </div>

                              {inquiry.followUpDate && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  <span className="font-medium">
                                    Follow-up:
                                  </span>
                                  <span>
                                    {formatDate(inquiry.followUpDate)}
                                  </span>
                                </div>
                              )}

                              {inquiry.resolvedAt && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  <span className="font-medium">Resolved:</span>
                                  <span>{formatDate(inquiry.resolvedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700">
                              {inquiry.notes}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          <Link href={`/patients/${inquiry.patientId}`}>
                            <Button variant="outline" size="sm">
                              View Patient
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm">
                            Update Status
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
