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
  Plus
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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

interface HeaderProps {
  onSearch?: (query: string) => void;
}

interface SearchResult {
  id: string | number;
  type: 'patient' | 'appointment' | 'record';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  href: string;
}

export function Header({ onSearch }: HeaderProps) {
  const { user, logout } = useAuth();
  const typedUser = user as User | undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Global search query
  const { data: searchResults, isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ["/api/search", searchQuery],
    enabled: searchQuery.length > 2 && isSearchOpen,
    retry: false,
  });

  // Keyboard shortcut for search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsSearchOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        const commandInput = document.querySelector('[cmdk-input]') as HTMLInputElement;
        if (commandInput) {
          commandInput.focus();
        }
      }, 100);
    }
  }, [isSearchOpen]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getUserRole = (role?: string) => {
    switch (role) {
      case "admin":
        return "Administrator";
      case "therapist":
        return "Licensed Therapist";
      case "staff":
        return "Staff Member";
      default:
        return "User";
    }
  };

  const getSearchIcon = (type: string) => {
    switch (type) {
      case 'patient':
        return <Users className="h-4 w-4" />;
      case 'appointment':
        return <Calendar className="h-4 w-4" />;
      case 'record':
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      patient: "bg-blue-100 text-blue-800",
      appointment: "bg-green-100 text-green-800", 
      record: "bg-purple-100 text-purple-800"
    };
    
    return (
      <Badge className={`text-xs ${variants[type as keyof typeof variants] || 'bg-gray-100 text-gray-800'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                  <Brain className="text-white h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">NewLife CRM</h1>
                  <p className="text-sm text-gray-500">Mental Health Practice Management</p>
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
                      <span>Search patients, appointments...</span>
                      <div className="absolute right-2 flex items-center space-x-1">
                        <Command className="h-3 w-3" />
                        <span className="text-xs">K</span>
                      </div>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Press ⌘K to search</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  3
                </span>
              </Button>
              
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer select-none">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {typedUser ? `${typedUser.firstName || ""} ${typedUser.lastName || ""}`.trim() || "User" : "Loading..."}
                        </p>
                        <p className="text-xs text-gray-500">
                          {typedUser ? getUserRole(typedUser.role) : ""}
                        </p>
                      </div>
                      <Avatar>
                        <AvatarImage src={typedUser?.profileImageUrl || undefined} alt="User profile" />
                        <AvatarFallback className="bg-primary-100 text-primary-600">
                          {getInitials(typedUser?.firstName || undefined, typedUser?.lastName || undefined)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {/* TODO: Navigate to profile */}}>
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {/* TODO: Navigate to settings */}}>
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-700">
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
        <CommandInput 
          placeholder="Search patients, appointments, records..." 
          value={searchQuery}
          onValueChange={handleSearch}
        />
        <CommandList>
          <CommandEmpty>
            {searchLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span>Searching...</span>
              </div>
            ) : searchQuery.length > 2 ? (
              <div className="text-center py-6">
                <Search className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">No results found for "{searchQuery}"</p>
                <p className="text-xs text-gray-400 mt-1">Try searching for patients, appointments, or records</p>
              </div>
            ) : (
              <div className="text-center py-6">
                <Search className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">Start typing to search...</p>
                <div className="flex items-center justify-center space-x-4 mt-3 text-xs text-gray-400">
                  <span>⌘K to search</span>
                  <span>•</span>
                  <span>ESC to close</span>
                </div>
              </div>
            )}
          </CommandEmpty>
          
          {searchResults && searchResults.length > 0 && (
            <>
              <CommandGroup heading="Quick Actions">
                <Link href="/patients/new">
                  <CommandItem onSelect={() => setIsSearchOpen(false)}>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add New Patient</span>
                  </CommandItem>
                </Link>
                <Link href="/appointments/new">
                  <CommandItem onSelect={() => setIsSearchOpen(false)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>Schedule Appointment</span>
                  </CommandItem>
                </Link>
                <Link href="/records/new">
                  <CommandItem onSelect={() => setIsSearchOpen(false)}>
                    <FileText className="mr-2 h-4 w-4" />
                    <span>Create Treatment Record</span>
                  </CommandItem>
                </Link>
              </CommandGroup>
              
              <CommandSeparator />
              
              <CommandGroup heading="Search Results">
                {searchResults.map((result) => (
                  <Link key={`${result.type}-${result.id}`} href={result.href}>
                    <CommandItem onSelect={() => setIsSearchOpen(false)}>
                      <div className="flex items-center space-x-2 mr-2">
                        {getSearchIcon(result.type)}
                        {getTypeBadge(result.type)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{result.title}</div>
                        <div className="text-sm text-gray-500">{result.subtitle}</div>
                      </div>
                    </CommandItem>
                  </Link>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
