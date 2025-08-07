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
  Settings,
  AlertCircle,
  Bell,
  ClipboardList,
  Archive,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  patientCount?: number;
  todayAppointments?: number;
  archivedCount?: number;
}

export function Sidebar({
  patientCount = 0,
  todayAppointments = 0,
  archivedCount = 0,
}: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  // Only show Dashboard and Patients for frontdesk
  const isFrontDesk = user?.role === "frontdesk";
  const isSupervisor = user?.role === "supervisor";
  const isAdmin = user?.role === "admin";

  const navigation = [
    {
      name: "Main Menu",
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          current: location === "/dashboard",
        },
        {
          name: "Patients",
          href: "/patients",
          icon: Users,
          current: location.startsWith("/patients"),
          badge: patientCount > 0 ? patientCount.toString() : undefined,
        },
        // Show Archive Patients for admin and supervisor users only
        ...((isAdmin || isSupervisor)
          ? [
              {
                name: "Archive Patients",
                href: "/archive",
                icon: Archive,
                current: location.startsWith("/archive"),
                badge: archivedCount > 0 ? archivedCount.toString() : undefined,
              },
            ]
          : []),
        {
          name: "Appointments",
          href: "/appointments",
          icon: Calendar,
          current: location.startsWith("/appointments"),
          badge:
            todayAppointments > 0 ? todayAppointments.toString() : undefined,
          badgeVariant: "destructive" as const,
        },
        // Show Inquiries for frontdesk users
        ...(isFrontDesk
          ? [
              {
                name: "Inquiries",
                href: "/inquiries",
                icon: AlertCircle,
                current: location.startsWith("/inquiries"),
              },
            ]
          : []),
        // Only show these if not frontdesk
        ...(!isFrontDesk
          ? [
              {
                name: "Treatment Records",
                href: "/records",
                icon: FileText,
                current: location.startsWith("/records"),
              },
            ]
          : []),
      ],
    },
    // Show these sections for supervisors and admins (not frontdesk)
    ...(!isFrontDesk
      ? [
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
              // Show Discharge Requests for admin and supervisor
              ...((isAdmin || isSupervisor)
                ? [
                    {
                      name: "Discharge Requests",
                      href: "/discharge-requests",
                      icon: MessageSquare,
                      current: location.startsWith("/discharge-requests"),
                    },
                  ]
                : []),
              // Only show Settings for admins
              ...(isAdmin
                ? [
                    {
                      name: "Settings",
                      href: "/settings",
                      icon: Settings,
                      current: location.startsWith("/settings"),
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
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
                          "group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ease-in-out",
                          "hover:shadow-sm hover:scale-[1.02]",
                          item.current
                            ? [
                                "text-white bg-[#36d399]",
                                "shadow-lg shadow-green-200/40",
                                "border-l-4 border-l-white/30",
                                "transform scale-[1.02]",
                                "z-10 relative",
                              ].join(" ")
                            : [
                                "text-gray-700 hover:text-gray-900",
                                "hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100",
                                "hover:border-l-4 hover:border-l-gray-300",
                              ].join(" "),
                        )}
                      >
                        {/* Active indicator line */}
                        {item.current && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/50 rounded-r-full" />
                        )}

                        <Icon
                          className={cn(
                            "w-5 h-5 mr-3 transition-transform duration-200",
                            item.current
                              ? "text-white/90 transform scale-110"
                              : "text-gray-500 group-hover:text-gray-700 group-hover:scale-110",
                          )}
                        />

                        <span
                          className={cn(
                            "transition-all duration-200",
                            item.current
                              ? "text-white font-semibold tracking-wide"
                              : "group-hover:font-medium",
                          )}
                        >
                          {item.name}
                        </span>

                        {item.badge && (
                          <Badge
                            variant={item.badgeVariant || "secondary"}
                            className={cn(
                              "ml-auto transition-all duration-200",
                              item.current
                                ? "bg-white/20 text-white border-white/30"
                                : item.badgeVariant === "destructive"
                                  ? "bg-orange-100 text-orange-800 border-orange-200"
                                  : "group-hover:scale-105",
                            )}
                          >
                            {item.badge}
                          </Badge>
                        )}

                        {/* Hover effect overlay */}
                        {!item.current && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
