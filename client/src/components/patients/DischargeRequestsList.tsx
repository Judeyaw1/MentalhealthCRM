import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  assignedTherapist?: {
    firstName: string;
    lastName: string;
  };
}

interface DischargeRequestsListProps {
  patientId?: string; // Optional - if provided, shows only requests for this patient
}

export function DischargeRequestsList({ patientId }: DischargeRequestsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<DischargeRequest | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approve" | "deny" | null>(null);

  // Fetch discharge requests
  const { data: requests, isLoading } = useQuery<DischargeRequest[]>({
    queryKey: patientId 
      ? [`/api/patients/${patientId}/discharge-requests`]
      : ["/api/discharge-requests/pending"],
    queryFn: async () => {
      const response = await fetch(
        patientId 
          ? `/api/patients/${patientId}/discharge-requests`
          : "/api/discharge-requests/pending",
        { credentials: "include" }
      );
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
      if (patientId) {
        queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/discharge-requests`] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/discharge-requests/pending"] });
      }
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discharge Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading discharge requests...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Discharge Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No discharge requests found.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pendingRequests = requests.filter(req => req.status === "pending");
  const reviewedRequests = requests.filter(req => req.status !== "pending");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Discharge Requests</span>
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length} pending
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-4 text-orange-700">Pending Requests</h3>
              <div className="space-y-4">
                {pendingRequests.map((request) => (
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
                    <div className="bg-white rounded p-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                      <p className="text-sm text-gray-600">{request.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reviewedRequests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-gray-700">Reviewed Requests</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewedRequests.map((request) => (
                    <TableRow key={request._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {patientId ? (
                              // If we're on a patient page, show initials
                              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                                {request.patient?.firstName?.[0]}{request.patient?.lastName?.[0]}
                              </div>
                            ) : (
                              // If we're on the global page, show full name
                              request.patientName
                            )}
                          </div>
                          {request.assignedTherapist && (
                            <div className="text-sm text-gray-500">
                              Therapist: {request.assignedTherapist.firstName} {request.assignedTherapist.lastName}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {request.requestedBy.firstName} {request.requestedBy.lastName}
                          <div className="text-gray-500">{request.requestedBy.role}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(request.requestedAt), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.reviewedBy ? (
                          <div className="text-sm">
                            {request.reviewedBy.firstName} {request.reviewedBy.lastName}
                            {request.reviewedAt && (
                              <div className="text-gray-500">
                                {format(new Date(request.reviewedAt), "MMM dd, yyyy")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(request);
                            setReviewDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
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

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve" : "Deny"} Discharge Request
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  Patient: {selectedRequest.patientName}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Requested by {selectedRequest.requestedBy.firstName} {selectedRequest.requestedBy.lastName} ({selectedRequest.requestedBy.role})
                </p>
                <div className="bg-gray-50 rounded p-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                  <p className="text-sm text-gray-600">{selectedRequest.reason}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes (Optional)
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about your decision..."
                  className="min-h-[80px]"
                />
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {reviewAction === "approve" 
                    ? "Approving this request will immediately discharge the patient."
                    : "Denying this request will keep the patient active."
                  }
                </AlertDescription>
              </Alert>
            </div>
          )}

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
              {updateRequestMutation.isPending ? "Processing..." : reviewAction === "approve" ? "Approve" : "Deny"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
