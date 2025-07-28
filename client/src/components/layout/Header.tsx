import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  Search,
  Brain,
  Users,
  Calendar,
  FileText,
  Command,
  X,
  Loader2,
  Plus,
  Mail,
  Settings,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import type { User } from "@shared/schema";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/ui/notification-bell";

interface HeaderProps {
  onSearch?: (query: string) => void;
}

interface SearchResult {
  id: string | number;
  type: "patient" | "appointment" | "record";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
}

interface LocationResult {
  id: string;
  type: "location";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
  keywords: string[];
}

export function Header({ onSearch }: HeaderProps) {
  const { user, logout } = useAuth();
  const typedUser = user as User | undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const prevIsSearchOpen = useRef(false);

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getUserRole = (role?: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "supervisor":
        return "Supervisor";
      case "therapist":
        return "Licensed Therapist";
      case "staff":
        return "Staff Member";
      case "frontdesk":
        return "Front Desk";
      default:
        return "User";
    }
  };

  const getSearchIcon = (type: string) => {
    switch (type) {
      case "patient":
        return <Users className="h-4 w-4" />;
      case "appointment":
        return <Calendar className="h-4 w-4" />;
      case "record":
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      patient: "bg-blue-100 text-blue-800",
      appointment: "bg-green-100 text-green-800",
      record: "bg-purple-100 text-purple-800",
    };

    return (
      <Badge
        className={`text-xs ${variants[type as keyof typeof variants] || "bg-gray-100 text-gray-800"}`}
      >
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const portalLocations: LocationResult[] = [
    {
      id: "dashboard",
      type: "location",
      title: "Dashboard",
      subtitle: "Overview and quick stats",
      icon: <Brain className="h-4 w-4" />,
      href: "/dashboard",
      keywords: ["dashboard", "home", "overview", "main"],
    },
    {
      id: "patients",
      type: "location",
      title: "Patients",
      subtitle: "View and manage patients",
      icon: <Users className="h-4 w-4" />,
      href: "/patients",
      keywords: [
        "patients",
        "patient",
        "client",
        "clients",
        "profile",
        "profiles",
      ],
    },
    {
      id: "appointments",
      type: "location",
      title: "Appointments",
      subtitle: "View and manage appointments",
      icon: <Calendar className="h-4 w-4" />,
      href: "/appointments",
      keywords: ["appointments", "appointment", "schedule", "visit", "visits"],
    },
    {
      id: "records",
      type: "location",
      title: "Treatment Records",
      subtitle: "View and manage treatment records",
      icon: <FileText className="h-4 w-4" />,
      href: "/records",
      keywords: [
        "records",
        "treatment",
        "notes",
        "treatment records",
        "progress",
      ],
    },
    {
      id: "inquiries",
      type: "location",
      title: "Inquiries",
      subtitle: "Track and manage patient inquiries",
      icon: <Mail className="h-4 w-4" />,
      href: "/inquiries",
      keywords: ["inquiries", "inquiry", "questions", "contact"],
    },
    {
      id: "reports",
      type: "location",
      title: "Reports",
      subtitle: "View analytics and reports",
      icon: <FileText className="h-4 w-4" />,
      href: "/reports",
      keywords: ["reports", "analytics", "statistics", "stats"],
    },
    {
      id: "staff",
      type: "location",
      title: "Staff",
      subtitle: "Manage staff accounts",
      icon: <Users className="h-4 w-4" />,
      href: "/staff",
      keywords: ["staff", "users", "team", "employees"],
    },
    {
      id: "settings",
      type: "location",
      title: "Settings",
      subtitle: "Portal and account settings",
      icon: <Settings className="h-4 w-4" />,
      href: "/settings",
      keywords: ["settings", "preferences", "configuration", "account"],
    },
  ];

  const helpTopics = [
    {
      id: "help-add-patient",
      title: "How to add a patient?",
      answer: "Go to Patients > New Patient and fill out the form.",
    },
    {
      id: "help-schedule-appointment",
      title: "How to schedule an appointment?",
      answer:
        "Go to Appointments > New Appointment and select a patient and time.",
    },
    {
      id: "help-export-data",
      title: "How to export data?",
      answer: "Use the Export button on the Patients or Appointments page.",
    },
    {
      id: "help-reset-password",
      title: "How to reset my password?",
      answer: "Go to your profile/settings and click Change Password.",
    },
  ];

  useEffect(() => {
    let ignore = false;
    const trimmedQuery = searchQuery.trim();
    const shouldSearch = trimmedQuery.length > 2;

    console.log("🔍 Search effect triggered:", {
      searchQuery,
      trimmedQuery,
      shouldSearch,
      length: trimmedQuery.length
    });

    // Always clear results if input is cleared or too short
    if (!shouldSearch) {
      console.log("🔍 Query too short, clearing results");
      setApiResults([]);
      setApiLoading(false);
      return;
    }

    console.log("🔍 Starting API search for:", trimmedQuery);
    setApiLoading(true);
    const timeoutId = setTimeout(() => {
      const searchUrl = `/api/search?q=${encodeURIComponent(trimmedQuery)}`;
      console.log("🔍 Making API request to:", searchUrl);
      
      fetch(searchUrl)
        .then((res) => {
          console.log("🔍 Search API response status:", res.status);
          return res.ok ? res.json() : [];
        })
        .then((data) => {
          console.log("🔍 Search API response data:", data);
          if (!ignore) {
            console.log("🔍 Setting API results:", Array.isArray(data) ? data : []);
            setApiResults(Array.isArray(data) ? data : []);
          }
        })
        .catch((error) => {
          console.error("🔍 Search API error:", error);
          if (!ignore) setApiResults([]);
        })
        .finally(() => {
          console.log("🔍 Search API request completed");
          if (!ignore) setApiLoading(false);
        });
    }, 300);

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    // Only reset when dialog transitions from closed to open
    if (isSearchOpen && !prevIsSearchOpen.current) {
      setSearchQuery("");
      setApiResults([]);
      setApiLoading(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
    prevIsSearchOpen.current = isSearchOpen;
  }, [isSearchOpen]);

  // Add keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navResults =
    searchQuery.length > 0
      ? portalLocations.filter(
          (loc) =>
            loc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            loc.subtitle.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : [];
  const helpResults =
    searchQuery.length > 0
      ? helpTopics.filter(
          (topic) =>
            topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            topic.answer.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : [];

  console.log("Search query:", searchQuery);
  console.log("Location results:", navResults);
  console.log("Help results:", helpResults);
  console.log("API Results:", apiResults);
  console.log("API Loading:", apiLoading);

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="h-8 w-8 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">
                    NewLife CRM
                  </h1>
                  <p className="text-sm text-gray-500">
                    Mental Health Practice Management
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="relative w-80 justify-start text-sm text-muted-foreground"
                      onClick={() => setIsSearchOpen(true)}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      <span>Search patients, appointments, records...</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Press ⌘K to search</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <NotificationBell />

              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer select-none">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {typedUser
                            ? `${typedUser.firstName || ""} ${typedUser.lastName || ""}`.trim() ||
                              "User"
                            : "Loading..."}
                        </p>
                        <p className="text-xs text-gray-500">
                          {typedUser ? getUserRole(typedUser.role) : ""}
                        </p>
                      </div>
                      <Avatar>
                        <AvatarImage
                          src={typedUser?.profileImageUrl || undefined}
                          alt="User profile"
                        />
                        <AvatarFallback className="bg-primary-100 text-primary-600">
                          {getInitials(
                            typedUser?.firstName || undefined,
                            typedUser?.lastName || undefined,
                          )}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/settings#account-info">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings">Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="text-red-600 focus:text-red-700"
                    >
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <div className="p-4 border-b">
          <Input
            ref={searchInputRef}
            placeholder="Search patients, appointments, records..."
            value={searchQuery}
            onChange={(e) => {
              const value = e.target.value;
              setSearchQuery(value);
            }}
            className="w-full"
          />
        </div>
        <CommandList className="max-h-[70vh] overflow-y-auto">
          <CommandGroup heading="Navigate to">
            {navResults.map((loc) => (
              <CommandItem
                key={loc.id}
                onSelect={() => {
                  setIsSearchOpen(false);
                  navigate(loc.href);
                }}
              >
                <div className="flex items-center space-x-2 mr-2">
                  {loc.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{loc.title}</div>
                  <div className="text-sm text-gray-500">{loc.subtitle}</div>
                </div>
              </CommandItem>
            ))}
            {navResults.length === 0 && (
              <div className="text-gray-400 px-4 py-2 text-sm">
                No navigation matches
              </div>
            )}
          </CommandGroup>

          {/* Grouped Search Results */}
          {(() => {
            const patientResults = apiResults.filter(r => r.type === 'patient');
            const appointmentResults = apiResults.filter(r => r.type === 'appointment');
            const recordResults = apiResults.filter(r => r.type === 'record');
            
            return <>
              {apiLoading && (
                <CommandGroup heading="Searching...">
                  <div className="flex items-center justify-center py-6 text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Searching...</span>
                  </div>
                </CommandGroup>
              )}
              
              <CommandGroup heading="Patients">
                {patientResults.length > 0 ? patientResults.map((result, idx) => (
                  <CommandItem
                    key={result.id || idx}
                    onSelect={() => {
                      console.log("🔍 Patient search result clicked:", result);
                      console.log("🔍 Current auth state:", { isAuthenticated: true }); // We know user is authenticated since they can search
                      setIsSearchOpen(false);
                      if (result.href) {
                        console.log("🔍 Navigating to:", result.href);
                        // Add query parameter to track that user came from search
                        const searchUrl = result.href.includes('?') 
                          ? `${result.href}&from=search` 
                          : `${result.href}?from=search`;
                        navigate(searchUrl);
                      } else {
                        console.log("🔍 No href found in result");
                      }
                    }}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2 mr-2">
                      {getSearchIcon(result.type)}
                      {getTypeBadge(result.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {result.title || result.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.subtitle || result.type || ""}
                      </div>
                    </div>
                  </CommandItem>
                )) : (
                  <div className="text-gray-400 px-4 py-2 text-sm">
                    {apiLoading ? "Searching..." : "No patient matches"}
                  </div>
                )}
              </CommandGroup>
              <CommandGroup heading="Appointments">
                {appointmentResults.length > 0 ? appointmentResults.map((result, idx) => (
                  <CommandItem
                    key={result.id || idx}
                    onSelect={() => {
                      console.log("🔍 Appointment search result clicked:", result);
                      setIsSearchOpen(false);
                      if (result.href) {
                        console.log("🔍 Navigating to:", result.href);
                        // Add query parameter to track that user came from search
                        const searchUrl = result.href.includes('?') 
                          ? `${result.href}&from=search` 
                          : `${result.href}?from=search`;
                        navigate(searchUrl);
                      } else {
                        console.log("🔍 No href found in result");
                      }
                    }}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2 mr-2">
                      {getSearchIcon(result.type)}
                      {getTypeBadge(result.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {result.title || result.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.subtitle || result.type || ""}
                      </div>
                    </div>
                  </CommandItem>
                )) : (
                  <div className="text-gray-400 px-4 py-2 text-sm">
                    {apiLoading ? "Searching..." : "No appointment matches"}
                  </div>
                )}
              </CommandGroup>
              <CommandGroup heading="Records">
                {recordResults.length > 0 ? recordResults.map((result, idx) => (
                  <CommandItem
                    key={result.id || idx}
                    onSelect={() => {
                      console.log("🔍 Record search result clicked:", result);
                      setIsSearchOpen(false);
                      if (result.href) {
                        console.log("🔍 Navigating to:", result.href);
                        // Add query parameter to track that user came from search
                        const searchUrl = result.href.includes('?') 
                          ? `${result.href}&from=search` 
                          : `${result.href}?from=search`;
                        navigate(searchUrl);
                      } else {
                        console.log("🔍 No href found in result");
                      }
                    }}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2 mr-2">
                      {getSearchIcon(result.type)}
                      {getTypeBadge(result.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {result.title || result.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {result.subtitle || result.type || ""}
                      </div>
                    </div>
                  </CommandItem>
                )) : (
                  <div className="text-gray-400 px-4 py-2 text-sm">
                    {apiLoading ? "Searching..." : "No record matches"}
                  </div>
                )}
              </CommandGroup>
              
              {!apiLoading && apiResults.length === 0 && searchQuery.length > 2 && (
                <CommandGroup heading="No Results">
                  <div className="text-center py-6 text-gray-400">
                    <Search className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm">
                      No results found for "{searchQuery}"
                    </p>
                    <p className="text-xs text-gray-300 mt-1">
                      Try searching by name, email, or phone number
                    </p>
                  </div>
                </CommandGroup>
              )}
            </>;
          })()}

          <CommandGroup heading="Help & FAQ">
            {helpResults.map((topic) => (
              <CommandItem key={topic.id}>
                <div className="flex-1">
                  <div className="font-medium">{topic.title}</div>
                  <div className="text-sm text-gray-500">{topic.answer}</div>
                </div>
              </CommandItem>
            ))}
            {helpResults.length === 0 && (
              <div className="text-gray-400 px-4 py-2 text-sm">
                No help matches
              </div>
            )}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
