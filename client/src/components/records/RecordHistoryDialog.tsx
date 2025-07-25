import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock,
  User,
  Edit,
  Eye,
  Trash2,
  Plus,
  FileText,
  Download,
  Printer,
  Copy,
  History,
  AlertTriangle,
  Calendar,
  Activity,
} from "lucide-react";

interface RecordHistoryEntry {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: any;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
}

interface RecordHistoryDialogProps {
  recordId: string | null;
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case "create":
      return <Plus className="h-4 w-4" />;
    case "read":
      return <Eye className="h-4 w-4" />;
    case "update":
    case "edit":
      return <Edit className="h-4 w-4" />;
    case "delete":
      return <Trash2 className="h-4 w-4" />;
    case "download":
      return <Download className="h-4 w-4" />;
    case "print":
      return <Printer className="h-4 w-4" />;
    case "export":
      return <FileText className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case "create":
      return "bg-green-100 text-green-800";
    case "read":
      return "bg-blue-100 text-blue-800";
    case "update":
    case "edit":
      return "bg-yellow-100 text-yellow-800";
    case "delete":
      return "bg-red-100 text-red-800";
    case "download":
    case "print":
    case "export":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatActionText = (action: string) => {
  switch (action) {
    case "create":
      return "Created";
    case "read":
      return "Viewed";
    case "update":
    case "edit":
      return "Updated";
    case "delete":
      return "Deleted";
    case "download":
      return "Downloaded";
    case "print":
      return "Printed";
    case "export":
      return "Exported";
    default:
      return action.charAt(0).toUpperCase() + action.slice(1);
  }
};

const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

const formatDetails = (details: any) => {
  if (!details) return null;
  
  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      return details;
    }
  }

  if (typeof details === "object") {
    return Object.entries(details).map(([key, value]) => (
      <div key={key} className="text-sm">
        <span className="font-medium">{key}:</span> {String(value)}
      </div>
    ));
  }

  return String(details);
};

export function RecordHistoryDialog({
  recordId,
  isOpen,
  onClose,
  patientName,
}: RecordHistoryDialogProps) {
  const { toast } = useToast();

  const { data: history, isLoading, error } = useQuery({
    queryKey: ["/api/records", recordId, "history"],
    queryFn: async () => {
      if (!recordId) return [];
      const response = await fetch(`/api/records/${recordId}/history`);
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have permission to view this record's history.");
        }
        throw new Error("Failed to fetch record history");
      }
      return response.json();
    },
    enabled: !!recordId && isOpen,
    retry: false,
  });

  const handleCopyRecordId = () => {
    if (recordId) {
      navigator.clipboard.writeText(recordId);
      toast({
        title: "Record ID Copied",
        description: "Record ID has been copied to clipboard.",
      });
    }
  };

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Record History
            </DialogTitle>
            <DialogDescription>
              History for treatment record of {patientName}
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Unable to Load History
            </h3>
            <p className="text-gray-600 mb-4">
              {error instanceof Error ? error.message : "An error occurred while loading the record history."}
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Record History
          </DialogTitle>
          <DialogDescription>
            History for treatment record of {patientName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-start space-x-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((entry: RecordHistoryEntry) => (
                <div
                  key={entry.id}
                  className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary-100 text-primary-600">
                      {entry.user ? (
                        `${entry.user.firstName.charAt(0)}${entry.user.lastName.charAt(0)}`
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="secondary"
                          className={`${getActionColor(entry.action)} flex items-center gap-1`}
                        >
                          {getActionIcon(entry.action)}
                          {formatActionText(entry.action)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {formatDateTime(entry.timestamp)}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">
                        {entry.user
                          ? `${entry.user.firstName} ${entry.user.lastName}`
                          : "Unknown User"}
                      </span>
                      {entry.user && (
                        <span className="text-gray-500 ml-2">
                          ({entry.user.role})
                        </span>
                      )}
                    </div>

                    {entry.details && (
                      <div className="bg-gray-50 p-3 rounded-md text-sm">
                        <div className="font-medium text-gray-700 mb-1">Details:</div>
                        {formatDetails(entry.details)}
                      </div>
                    )}

                    {entry.ipAddress && (
                      <div className="text-xs text-gray-500 mt-2">
                        IP: {entry.ipAddress}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No History Found
              </h3>
              <p className="text-gray-600">
                No activity has been recorded for this treatment record yet.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {history && history.length > 0 && (
              <span>Showing {history.length} activity entries</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRecordId}
              disabled={!recordId}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Record ID
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 