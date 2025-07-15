import { Switch, Route, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChangePasswordForm } from "@/components/staff/ChangePasswordForm";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import PatientDetail from "@/pages/PatientDetail";
import NewPatient from "@/pages/NewPatient";
import EditPatient from "@/pages/EditPatient";
import Appointments from "@/pages/Appointments";
import NewAppointment from "@/pages/NewAppointment";
import AppointmentDetail from "@/pages/AppointmentDetail";
import EditAppointment from "@/pages/EditAppointment";
import Records from "@/pages/Records";
import NewRecord from "@/pages/NewRecord";
import Staff from "@/pages/Staff";
import Reports from "@/pages/Reports";
import AuditLogs from "@/pages/AuditLogs";
import Settings from "@/pages/Settings";

function RouterComponent() {
  const { logout, isAuthenticated, user, forcePasswordChange } = useAuth();
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Show password change dialog if required
  useEffect(() => {
    if (forcePasswordChange) {
      setShowPasswordChange(true);
    }
  }, [forcePasswordChange]);

  const handlePasswordChangeSuccess = () => {
    setShowPasswordChange(false);
    // Clear the force password change flag
    localStorage.removeItem("forcePasswordChange");
    // Redirect to dashboard instead of reloading
    window.location.href = "/dashboard";
  };

  return (
    <>
      <Switch>
        {/* Always show Landing page at root, regardless of auth status */}
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        
        {/* Protected routes - only accessible when authenticated */}
        {isAuthenticated ? (
          <>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/patients" component={Patients} />
            <Route path="/patients/new" component={NewPatient} />
            <Route path="/patients/:id" component={PatientDetail} />
            <Route path="/patients/:id/edit" component={EditPatient} />
            <Route path="/appointments" component={Appointments} />
            <Route path="/appointments/new" component={NewAppointment} />
            <Route path="/appointments/:id" component={AppointmentDetail} />
            <Route path="/appointments/:id/edit" component={EditAppointment} />
            <Route path="/records" component={Records} />
            <Route path="/records/new" component={NewRecord} />
            <Route path="/staff" component={Staff} />
            <Route path="/reports" component={Reports} />
            <Route path="/audit" component={AuditLogs} />
            <Route path="/settings" component={Settings} />
            <Route path="*" component={NotFound} />
          </>
        ) : (
          <>
            {/* Redirect unauthenticated users to login for protected routes */}
            <Route
              path="*"
              component={() => {
                window.location.href = "/login";
                return null;
              }}
            />
          </>
        )}
      </Switch>

      {/* Password Change Dialog */}
      <ChangePasswordForm
        isOpen={showPasswordChange}
        onClose={() => setShowPasswordChange(false)}
        onSuccess={handlePasswordChangeSuccess}
      />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <WouterRouter>
          <RouterComponent />
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
