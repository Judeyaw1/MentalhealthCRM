import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, CalendarPlus, ClipboardList, BarChart3 } from "lucide-react";
import { Link } from "wouter";

export function QuickActions() {
  const actions = [
    {
      title: "New Patient Intake",
      description: "Register a new patient",
      icon: UserPlus,
      href: "/patients/new",
      color: "bg-primary-50 text-primary-700 hover:bg-primary-100",
    },
    {
      title: "Schedule Appointment",
      description: "Book a new appointment",
      icon: CalendarPlus,
      href: "/appointments/new",
      color: "bg-success-50 text-success-700 hover:bg-success-100",
    },
    {
      title: "Write Treatment Note",
      description: "Document patient session",
      icon: ClipboardList,
      href: "/records/new",
      color: "bg-warning-50 text-warning-700 hover:bg-warning-100",
    },
    {
      title: "Generate Report",
      description: "View practice analytics",
      icon: BarChart3,
      href: "/reports",
      color: "bg-purple-50 text-purple-700 hover:bg-purple-100",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;
            
            return (
              <Link key={action.title} href={action.href}>
                <Button
                  variant="ghost"
                  className={`flex flex-col items-center justify-center space-y-2 h-20 w-full ${action.color} transition-colors`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-sm font-medium text-center">{action.title}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
