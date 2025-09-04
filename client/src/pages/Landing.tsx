import { Button } from "@/components/ui/button";
import { Shield, Users, Clock, FileText, BarChart3 } from "lucide-react";


export default function Landing() {
  const features = [
    {
      icon: <Shield className="h-8 w-8 text-blue-600" />,
      title: "Secure & Confidential",
      description: "HIPAA-compliant platform ensuring patient privacy and data security.",
    },
    {
      icon: <Users className="h-8 w-8 text-green-600" />,
      title: "Patient Management",
      description: "Comprehensive patient records, appointments, and treatment tracking.",
    },
    {
      icon: <Clock className="h-8 w-8 text-purple-600" />,
      title: "Appointment Scheduling",
      description: "Efficient scheduling system with automated reminders and notifications.",
    },
    {
      icon: <FileText className="h-8 w-8 text-orange-600" />,
      title: "Treatment Plans",
      description: "Detailed treatment planning and progress monitoring tools.",
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-red-600" />,
      title: "Analytics & Reports",
      description: "Comprehensive reporting and analytics for better decision making.",
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
                <span className="text-xl">🌱</span>
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

            <Button onClick={() => (window.location.href = "/login")}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                      <div className="mx-auto w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center mb-8">
              <span className="text-6xl">🌱</span>
            </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Mental Health Practice Management
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Streamline your mental health practice with our comprehensive CRM solution. 
            Manage patients, appointments, treatments, and more with ease.
          </p>
          <Button 
            size="lg" 
            onClick={() => (window.location.href = "/login")}
            className="text-lg px-8 py-3"
          >
            Get Started
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Practice
            </h2>
            <p className="text-lg text-gray-600">
              Comprehensive tools designed specifically for mental health professionals
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Practice?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join mental health professionals who trust NewLife CRM
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => (window.location.href = "/login")}
            className="text-lg px-8 py-3"
          >
            Start Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                      <div className="w-12 h-12 bg-primary-500 rounded-lg flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">🌱</span>
            </div>
          <h3 className="text-xl font-semibold text-white mb-2">NewLife CRM</h3>
          <p className="text-gray-400 mb-6">
            Empowering mental health professionals with modern practice management tools
          </p>
          <p className="text-gray-500 text-sm">
            © 2024 NewLife CRM. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
