import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import PatientDetail from "@/pages/PatientDetail";
import NewPatient from "@/pages/NewPatient";
import EditPatient from "@/pages/EditPatient";
import Appointments from "@/pages/Appointments";
import NewAppointment from "@/pages/NewAppointment";
import Records from "@/pages/Records";
import NewRecord from "@/pages/NewRecord";
import Staff from "@/pages/Staff";
import Reports from "@/pages/Reports";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/patients" component={Patients} />
          <Route path="/patients/new" component={NewPatient} />
          <Route path="/patients/:id" component={PatientDetail} />
          <Route path="/patients/:id/edit" component={EditPatient} />
          <Route path="/appointments" component={Appointments} />
          <Route path="/appointments/new" component={NewAppointment} />
          <Route path="/records" component={Records} />
          <Route path="/records/new" component={NewRecord} />
          <Route path="/staff" component={Staff} />
          <Route path="/reports" component={Reports} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
