import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Target, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TreatmentGoal {
  goal: string;
  targetDate?: Date;
  status: "pending" | "in_progress" | "achieved" | "not_achieved";
  achievedDate?: Date;
  notes?: string;
}

interface TreatmentGoalsFormProps {
  patientId: string;
  initialGoals?: TreatmentGoal[];
  onGoalsUpdate?: (goals: TreatmentGoal[]) => void;
}

export function TreatmentGoalsForm({ 
  patientId, 
  initialGoals = [], 
  onGoalsUpdate 
}: TreatmentGoalsFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [goals, setGoals] = useState<TreatmentGoal[]>(initialGoals);
  const [newGoal, setNewGoal] = useState({
    goal: "",
    targetDate: undefined as Date | undefined,
    status: "pending" as const,
    notes: ""
  });

  const updateGoalsMutation = useMutation({
    mutationFn: async (goals: TreatmentGoal[]) => {
      const response = await fetch(`/api/patients/${patientId}/treatment-goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ goals }),
      });
      if (!response.ok) throw new Error("Failed to update goals");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Treatment goals updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
      onGoalsUpdate?.(goals);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update treatment goals",
        variant: "destructive",
      });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: async ({ goalIndex, updates }: { goalIndex: number; updates: Partial<TreatmentGoal> }) => {
      const response = await fetch(`/api/patients/${patientId}/treatment-goals/${goalIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update goal");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Goal updated successfully",
      });
      if (data.shouldCheckDischarge) {
        toast({
          title: "Discharge Review",
          description: "Patient may be eligible for discharge. Review recommended.",
        });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}`] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update goal",
        variant: "destructive",
      });
    },
  });

  const addGoal = () => {
    if (!newGoal.goal.trim()) return;
    
    const goal: TreatmentGoal = {
      goal: newGoal.goal,
      targetDate: newGoal.targetDate,
      status: newGoal.status,
      notes: newGoal.notes
    };

    const updatedGoals = [...goals, goal];
    setGoals(updatedGoals);
    updateGoalsMutation.mutate(updatedGoals);
    
    setNewGoal({
      goal: "",
      targetDate: undefined,
      status: "pending",
      notes: ""
    });
  };

  const updateGoal = (index: number, updates: Partial<TreatmentGoal>) => {
    const updatedGoals = [...goals];
    updatedGoals[index] = { ...updatedGoals[index], ...updates };
    setGoals(updatedGoals);
    
    updateGoalMutation.mutate({ goalIndex: index, updates });
  };

  const removeGoal = (index: number) => {
    const updatedGoals = goals.filter((_, i) => i !== index);
    setGoals(updatedGoals);
    updateGoalsMutation.mutate(updatedGoals);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-100 text-blue-800"><Target className="h-3 w-3 mr-1" />In Progress</Badge>;
      case "achieved":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Achieved</Badge>;
      case "not_achieved":
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" />Not Achieved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const achievementRate = goals.length > 0 
    ? Math.round((goals.filter(g => g.status === "achieved").length / goals.length) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Treatment Goals</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {achievementRate}% achieved
            </span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${achievementRate}%` }}
              />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new goal */}
        <div className="space-y-3 p-4 border rounded-lg">
          <Label>Add New Goal</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Enter treatment goal..."
              value={newGoal.goal}
              onChange={(e) => setNewGoal({ ...newGoal, goal: e.target.value })}
            />
            <Select
              value={newGoal.status}
              onValueChange={(value: any) => setNewGoal({ ...newGoal, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="achieved">Achieved</SelectItem>
                <SelectItem value="not_achieved">Not Achieved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !newGoal.targetDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newGoal.targetDate ? format(newGoal.targetDate, "PPP") : "Target date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newGoal.targetDate}
                  onSelect={(date) => setNewGoal({ ...newGoal, targetDate: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button onClick={addGoal} disabled={!newGoal.goal.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
          <Textarea
            placeholder="Notes (optional)"
            value={newGoal.notes}
            onChange={(e) => setNewGoal({ ...newGoal, notes: e.target.value })}
          />
        </div>

        {/* Existing goals */}
        <div className="space-y-3">
          {goals.map((goal, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getStatusBadge(goal.status)}
                    {goal.targetDate && (
                      <span className="text-sm text-gray-500">
                        Target: {format(new Date(goal.targetDate), "MMM dd, yyyy")}
                      </span>
                    )}
                  </div>
                  <p className="font-medium">{goal.goal}</p>
                  {goal.notes && (
                    <p className="text-sm text-gray-600 mt-1">{goal.notes}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGoal(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex items-center space-x-2">
                <Select
                  value={goal.status}
                  onValueChange={(value: any) => updateGoal(index, { status: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="achieved">Achieved</SelectItem>
                    <SelectItem value="not_achieved">Not Achieved</SelectItem>
                  </SelectContent>
                </Select>
                
                {goal.status === "achieved" && !goal.achievedDate && (
                  <Button
                    size="sm"
                    onClick={() => updateGoal(index, { achievedDate: new Date() })}
                  >
                    Mark as Achieved
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {goals.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No treatment goals set yet</p>
            <p className="text-sm">Add goals to track patient progress</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 