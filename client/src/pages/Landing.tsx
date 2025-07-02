import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Users, Calendar, Shield, BarChart3, FileText } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: Users,
      title: "Patient Management",
      description: "Comprehensive patient records and profile management with HIPAA compliance."
    },
    {
      icon: Calendar,
      title: "Appointment Scheduling",
      description: "Efficient scheduling system with calendar integration and automated reminders."
    },
    {
      icon: FileText,
      title: "Treatment Records",
      description: "Secure documentation of treatment notes and patient progress tracking."
    },
    {
      icon: Shield,
      title: "HIPAA Compliance",
      description: "Built-in security measures and audit logging for healthcare compliance."
    },
    {
      icon: BarChart3,
      title: "Analytics & Reports",
      description: "Comprehensive reporting and analytics for practice management insights."
    },
    {
      icon: Brain,
      title: "Mental Health Focus",
      description: "Specifically designed for mental health practices and therapy workflows."
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
                <Brain className="text-white h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">MindCare CRM</h1>
                <p className="text-sm text-gray-500">Mental Health Practice Management</p>
              </div>
            </div>
            
            <Button onClick={() => window.location.href = "/api/login"}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Streamline Your
            <span className="text-primary-500 block">Mental Health Practice</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            A comprehensive CRM solution designed specifically for mental health organizations 
            to manage patients, appointments, and records with HIPAA compliance.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-3"
            onClick={() => window.location.href = "/api/login"}
          >
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Manage Your Practice
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our platform provides all the tools necessary to run an efficient, 
              compliant mental health practice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary-600" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of mental health professionals who trust MindCare CRM 
            to manage their practice efficiently and securely.
          </p>
          <Button 
            size="lg" 
            className="text-lg px-8 py-3"
            onClick={() => window.location.href = "/api/login"}
          >
            Start Your Free Trial
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <Brain className="text-white h-4 w-4" />
              </div>
              <span className="text-lg font-semibold">MindCare CRM</span>
            </div>
            <p className="text-gray-400">
              © 2024 MindCare CRM. HIPAA Compliant Mental Health Practice Management.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
