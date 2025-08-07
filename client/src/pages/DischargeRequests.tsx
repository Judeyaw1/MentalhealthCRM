import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface DischargeRequest {
  _id: string;
  requestedBy: {
    firstName: string;
    lastName: string;
    role: string;
  };
  requestedAt: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  reviewedBy?: {
    firstName: string;
    lastName: string;
  };
  reviewedAt?: string;
  reviewNotes?: string;
  patientId: string;
  patientName: string;
  assignedTherapist?: {
    firstName: string;
    lastName: string;
  };
}

export default function DischargeRequests() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DischargeRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "deny" | null>(null);

  // Real-time socket connection for instant updates
  useSocket({
    onDischargeRequestCreated: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-requests/pending"] });
    },
    onDischargeRequestUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-requests/pending"] });
    },
  });

  // Fetch all pending discharge requests
  const { data: requests, isLoading } = useQuery<DischargeRequest[]>({
    queryKey: ["/api/discharge-requests/pending"],
    queryFn: async () => {
      const response = await fetch("/api/discharge-requests/pending", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch discharge requests");
      }
      return response.json();
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async ({ requestId, status, notes }: { requestId: string; status: string; notes?: string }) => {
      const response = await fetch(
        `/api/patients/${selectedRequest?.patientId}/discharge-requests/${requestId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ status, reviewNotes: notes }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update request");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Request Updated",
        description: `Discharge request has been ${data.status}.`,
      });
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewNotes("");
      setReviewAction(null);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/discharge-requests/pending"] });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${selectedRequest?.patientId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReview = (request: DischargeRequest, action: "approve" | "deny") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = () => {
    if (!selectedRequest || !reviewAction) return;

    const status = reviewAction === "approve" ? "approved" : "denied";
    updateRequestMutation.mutate({
      requestId: selectedRequest._id,
      status,
      notes: reviewNotes.trim() || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "denied":
        return <Badge variant="destructive">Denied</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Redirect to home if not authenticated
  if (!authLoading && !isAuthenticated) {
    window.location.href = "/login";
    return null;
  }

  // Check if user has permission to view discharge requests (admin and supervisor only)
  if (user && (user.role !== "admin" && user.role !== "supervisor")) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar archivedCount={0} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <Card className="max-w-md mx-auto mt-20">
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Access Restricted
                  </h2>
                  <p className="text-gray-600">
                    You don't have permission to view discharge requests. This
                    section is only available to administrators and supervisors.
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

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
        <Sidebar archivedCount={0} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Discharge Requests</h1>
              <p className="text-gray-600 mt-2">
                Review and manage discharge requests from staff members.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Pending Discharge Requests</span>
                  {requests && requests.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {requests.length} pending
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading discharge requests...</p>
                    </div>
                  </div>
                ) : !requests || requests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No pending discharge requests found.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div key={request._id} className="border rounded-lg p-4 bg-orange-50">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {request.patientName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Requested by {request.requestedBy.firstName} {request.requestedBy.lastName} ({request.requestedBy.role})
                            </p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(request.requestedAt), "MMM dd, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleReview(request, "approve")}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReview(request, "deny")}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Deny
                            </Button>
                          </div>
                        </div>

                        <div className="mb-3">
                          <h5 className="text-sm font-medium text-gray-700 mb-1">
                            Reason for Discharge Request
                          </h5>
                          <p className="text-sm text-gray-600 bg-white p-3 rounded border">
                            {request.reason}
                          </p>
                        </div>

                        {request.assignedTherapist && (
                          <div className="text-sm text-gray-500">
                            <span className="font-medium">Assigned Therapist:</span> {request.assignedTherapist.firstName} {request.assignedTherapist.lastName}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : "Deny"} Discharge Request
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You are about to <strong>{reviewAction}</strong> the discharge request for{" "}
                <strong>{selectedRequest?.patientName}</strong>.
                {reviewAction === "approve" && " This will immediately discharge the patient."}
              </AlertDescription>
            </Alert>

            <div>
              <label htmlFor="reviewNotes" className="block text-sm font-medium text-gray-700 mb-2">
                Review Notes (Optional)
              </label>
              <Textarea
                id="reviewNotes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about your decision..."
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReview}
              disabled={updateRequestMutation.isPending}
              className={
                reviewAction === "approve" 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {updateRequestMutation.isPending ? (
                "Processing..."
              ) : (
                <>
                  {reviewAction === "approve" ? (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {reviewAction === "approve" ? "Approve" : "Deny"} Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
