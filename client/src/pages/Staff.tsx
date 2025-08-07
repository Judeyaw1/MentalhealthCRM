import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useSocket } from "@/hooks/useSocket";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  UserCog,
  Plus,
  Mail,
  Shield,
  ArrowLeft,
  List,
  Grid3x3,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { User } from "@shared/types";
import { InviteStaffForm } from "@/components/staff/InviteStaffForm";
import { EditStaffForm } from "@/components/staff/EditStaffForm";
import { RemoveStaffForm } from "@/components/staff/RemoveStaffForm";
import { ResetPasswordForm } from "@/components/staff/ResetPasswordForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";

export default function Staff() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: staff, isLoading: staffLoading } = useQuery<User[]>({
    queryKey: ["/api/staff"],
    retry: false,
  });

  // Real-time socket connection for instant updates
  useSocket({
    onStaffCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
    },
    onStaffUpdated: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
    },
    onStaffDeleted: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/staff'] });
    },
  });

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <Badge className="bg-purple-100 text-purple-800">Administrator</Badge>
        );
      case "supervisor":
        return (
          <Badge className="bg-orange-100 text-orange-800">Supervisor</Badge>
        );
      case "therapist":
        return <Badge className="bg-blue-100 text-blue-800">Therapist</Badge>;
      case "staff":
        return <Badge variant="secondary">Staff</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Fetch patients for selected staff
  const handleCardClick = async (member: User) => {
    setSelectedStaff(member);
    setShowModal(true);
    setLoadingPatients(true);
    try {
      const res = await fetch(`/api/patients?createdBy=${member.id}`);
      const data = await res.json();
      setPatients(data.patients || []);
    } catch (e) {
      setPatients([]);
    }
    setLoadingPatients(false);
  };

  if (authLoading || staffLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
          <p className="mt-4 text-gray-600">Loading staff information...</p>
        </div>
      </div>
    );
  }

  // Check if user has permission to view staff (admin and supervisor only)
  if (user && (user as any).role !== "admin" && (user as any).role !== "supervisor") {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar archivedCount={0} />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              <Card className="max-w-md mx-auto mt-20">
                <CardContent className="pt-6 text-center">
                  <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    Access Restricted
                  </h2>
                  <p className="text-gray-600">
                    You don't have permission to view staff management. This
                    section is only available to administrators and supervisors.
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const staffStats = {
    total: staff?.length || 0,
    therapists:
      staff?.filter((member: User) => member.role === "therapist").length || 0,
    admins:
      staff?.filter((member: User) => member.role === "admin").length || 0,
    supervisors:
      staff?.filter((member: User) => member.role === "supervisor").length || 0,
    support:
      staff?.filter(
        (member: User) =>
          member.role === "frontdesk" || member.role === "staff",
      ).length || 0,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="flex">
        <Sidebar archivedCount={0} />

        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => (window.location.href = "/dashboard")}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Staff Management
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Manage team members and their roles within the practice.
                    </p>
                  </div>
                </div>
                <InviteStaffForm />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
                  <Users className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staffStats.total}</div>
                  <p className="text-xs text-gray-600">Team members</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Administrators</CardTitle>
                  <Shield className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staffStats.admins}</div>
                  <p className="text-xs text-gray-600">System admins</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Supervisors</CardTitle>
                  <UserCog className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staffStats.supervisors}</div>
                  <p className="text-xs text-gray-600">Team leaders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Therapists</CardTitle>
                  <UserCheck className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staffStats.therapists}</div>
                  <p className="text-xs text-gray-600">Licensed professionals</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Support Staff</CardTitle>
                  <Users className="h-4 w-4 text-gray-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{staffStats.support}</div>
                  <p className="text-xs text-gray-600">Front desk & staff</p>
                </CardContent>
              </Card>
            </div>

            {/* Staff List */}
            <Card>
                              <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <Button
                        variant={view === 'grid' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setView('grid')}
                        aria-label="Grid view"
                      >
                        <Grid3x3 className="h-5 w-5" />
                      </Button>
                      <Button
                        variant={view === 'list' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setView('list')}
                        aria-label="List view"
                      >
                        <List className="h-5 w-5" />
                      </Button>
                    </div>
                    <CardTitle>Team Members</CardTitle>
                  </div>
                </CardHeader>
              <CardContent>
                {!staff || staff.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No Staff Members Found
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Start building your team by inviting staff members.
                    </p>
                    <InviteStaffForm />
                  </div>
                ) : view === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {staff.map((member: User) => (
                      <Card
                        key={member.id}
                        className={`hover:shadow-md transition-shadow ${(user?.role === 'admin' || user?.role === 'supervisor') ? 'cursor-pointer' : ''}`}
                        onClick={(user?.role === 'admin' || user?.role === 'supervisor') ? () => handleCardClick(member) : undefined}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center space-x-4 mb-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage
                                src={member.profileImageUrl || undefined}
                              />
                              <AvatarFallback className="bg-primary-100 text-primary-600">
                                {getInitials(member.firstName, member.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-medium text-gray-900 truncate">
                                {member.firstName} {member.lastName}
                              </h3>
                              <div className="mt-1">
                                {getRoleBadge(member.role)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            {member.email && (
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Mail className="h-4 w-4" />
                                <span className="truncate">{member.email}</span>
                              </div>
                            )}

                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Joined:</span>{" "}
                              {member.createdAt
                                ? formatDate(member.createdAt)
                                : "Unknown"}
                            </div>

                            {member.updatedAt &&
                              member.updatedAt !== member.createdAt && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">
                                    Last updated:
                                  </span>{" "}
                                  {formatDate(member.updatedAt)}
                                </div>
                              )}
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="flex flex-col space-y-2">
                              <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                                <EditStaffForm staffMember={member} />
                                <ResetPasswordForm staffMember={member} />
                                {(user?.role === 'admin' || (user?.role === 'supervisor' && member.role !== 'admin')) && <RemoveStaffForm staffMember={member} />}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {staff.map((member: User) => (
                      <Card
                        key={member.id}
                        className={`hover:shadow-md transition-shadow ${(user?.role === 'admin' || user?.role === 'supervisor') ? 'cursor-pointer' : ''}`}
                        onClick={(user?.role === 'admin' || user?.role === 'supervisor') ? () => handleCardClick(member) : undefined}
                      >
                        <CardContent className="p-4 flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.profileImageUrl || undefined} />
                            <AvatarFallback className="bg-primary-100 text-primary-600">
                              {getInitials(member.firstName, member.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-medium text-gray-900 truncate">
                              {member.firstName} {member.lastName}
                            </h3>
                            <div className="mt-1">{getRoleBadge(member.role)}</div>
                            <div className="text-xs text-gray-600 mt-1">
                              {member.email}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                            <EditStaffForm staffMember={member} />
                            <ResetPasswordForm staffMember={member} />
                            {(user?.role === 'admin' || (user?.role === 'supervisor' && member.role !== 'admin')) && <RemoveStaffForm staffMember={member} />}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      {/* Modal for patients created by staff */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Patients Created by {selectedStaff?.firstName} {selectedStaff?.lastName}
            </DialogTitle>
          </DialogHeader>
          {loadingPatients ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div>
              <div className="mb-2 font-medium">Total: {patients.length}</div>
              <ul className="max-h-64 overflow-y-auto divide-y">
                {patients.map((p) => (
                  <li key={p.id} className="py-2">
                    {p.firstName} {p.lastName} <span className="text-xs text-gray-500">(ID: {p.id})</span>
                  </li>
                ))}
                {patients.length === 0 && <li className="py-2 text-gray-500">No patients found.</li>}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
