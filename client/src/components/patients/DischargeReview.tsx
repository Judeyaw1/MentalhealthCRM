import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, Clock, Target, Users } from "lucide-react";

interface DischargeCriteria {
  shouldDischarge: boolean;
  reason: string;
  criteria: string[];
}

interface DischargeReviewProps {
  patientId: string;
  patientName: string;
  onDischarge?: () => void;
}

export function DischargeReview({ patientId, patientName, onDischarge }: DischargeReviewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dischargeCriteria, setDischargeCriteria] = useState<DischargeCriteria | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkDischargeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/check-discharge`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to check discharge criteria");
      return response.json();
    },
    onSuccess: (data) => {
      setDischargeCriteria(data);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to check discharge criteria",
        variant: "destructive",
      });
    },
  });

  const autoDischargeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/auto-discharge`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to auto-discharge patient");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Patient Discharged",
        description: `${patientName} has been automatically discharged: ${data.reason}`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      onDischarge?.();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to auto-discharge patient",
        variant: "destructive",
      });
    },
  });

  const handleCheckDischarge = () => {
    setIsChecking(true);
    checkDischargeMutation.mutate(undefined, {
      onSettled: () => setIsChecking(false),
    });
  };

  const handleAutoDischarge = () => {
    if (dischargeCriteria?.shouldDischarge) {
      autoDischargeMutation.mutate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5" />
          <span>Discharge Review</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Review discharge criteria for {patientName}
          </p>
          <Button
            onClick={handleCheckDischarge}
            disabled={isChecking}
            variant="outline"
            size="sm"
          >
            {isChecking ? "Checking..." : "Check Criteria"}
          </Button>
        </div>

        {dischargeCriteria && (
          <div className="space-y-3">
            <Alert className={dischargeCriteria.shouldDischarge ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
              <div className="flex items-center space-x-2">
                {dischargeCriteria.shouldDischarge ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                )}
                <AlertDescription className="font-medium">
                  {dischargeCriteria.shouldDischarge 
                    ? "Patient meets discharge criteria" 
                    : "Patient does not meet discharge criteria"
                  }
                </AlertDescription>
              </div>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Reason: {dischargeCriteria.reason}</p>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-700">Criteria Met:</p>
                <ul className="space-y-1">
                  {dischargeCriteria.criteria.map((criterion, index) => (
                    <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      <span>{criterion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {dischargeCriteria.shouldDischarge && (
              <div className="flex space-x-2">
                <Button
                  onClick={handleAutoDischarge}
                  disabled={autoDischargeMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {autoDischargeMutation.isPending ? "Discharging..." : "Auto-Discharge Patient"}
                </Button>
                <Button variant="outline" size="sm">
                  Review Manually
                </Button>
              </div>
            )}
          </div>
        )}

        {!dischargeCriteria && (
          <div className="text-center py-6 text-gray-500">
            <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Click "Check Criteria" to review discharge eligibility</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 