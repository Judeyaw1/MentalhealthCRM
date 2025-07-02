import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  DollarSign, 
  BarChart3, 
  TrendingUp, 
  Shield, 
  UserCog, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  patientCount?: number;
  todayAppointments?: number;
}

export function Sidebar({ patientCount = 0, todayAppointments = 0 }: SidebarProps) {
  const [location] = useLocation();

  const navigation = [
    {
      name: "Main Menu",
      items: [
        {
          name: "Dashboard",
          href: "/",
          icon: LayoutDashboard,
          current: location === "/",
        },
        {
          name: "Patients",
          href: "/patients",
          icon: Users,
          current: location.startsWith("/patients"),
          badge: patientCount > 0 ? patientCount.toString() : undefined,
        },
        {
          name: "Appointments",
          href: "/appointments",
          icon: Calendar,
          current: location.startsWith("/appointments"),
          badge: todayAppointments > 0 ? todayAppointments.toString() : undefined,
          badgeVariant: "warning" as const,
        },
        {
          name: "Medical Records",
          href: "/records",
          icon: FileText,
          current: location.startsWith("/records"),
        },
        {
          name: "Billing & Insurance",
          href: "/billing",
          icon: DollarSign,
          current: location.startsWith("/billing"),
        },
      ],
    },
    {
      name: "Reports & Analytics",
      items: [
        {
          name: "Patient Statistics",
          href: "/reports",
          icon: BarChart3,
          current: location.startsWith("/reports"),
        },
        {
          name: "Treatment Outcomes",
          href: "/outcomes",
          icon: TrendingUp,
          current: location.startsWith("/outcomes"),
        },
        {
          name: "Audit Logs",
          href: "/audit",
          icon: Shield,
          current: location.startsWith("/audit"),
        },
      ],
    },
    {
      name: "Administration",
      items: [
        {
          name: "Staff Management",
          href: "/staff",
          icon: UserCog,
          current: location.startsWith("/staff"),
        },
        {
          name: "Settings",
          href: "/settings",
          icon: Settings,
          current: location.startsWith("/settings"),
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 overflow-y-auto">
      <nav className="p-4 space-y-6">
        {navigation.map((section) => (
          <div key={section.name}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {section.name}
            </h2>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link href={item.href}>
                      <a
                        className={cn(
                          "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                          item.current
                            ? "text-white bg-primary-500"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        <Icon className="w-5 h-5 mr-3" />
                        {item.name}
                        {item.badge && (
                          <Badge 
                            variant={item.badgeVariant || "secondary"} 
                            className="ml-auto"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </a>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
