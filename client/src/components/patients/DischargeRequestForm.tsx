import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Send } from "lucide-react";

interface DischargeRequestFormProps {
  patientId: string;
  patientName: string;
  onRequestSubmitted?: () => void;
}

export function DischargeRequestForm({ 
  patientId, 
  patientName, 
  onRequestSubmitted 
}: DischargeRequestFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRequestMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/discharge-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit discharge request");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your discharge request has been submitted for review.",
      });
      setReason("");
      onRequestSubmitted?.();
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the discharge request.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    submitRequestMutation.mutate(undefined, {
      onSettled: () => setIsSubmitting(false),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          <span>Request Discharge</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Requesting discharge for <strong>{patientName}</strong>. This request will be reviewed by administrators.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Discharge Request *
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed reason for the discharge request..."
              className="min-h-[100px]"
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
