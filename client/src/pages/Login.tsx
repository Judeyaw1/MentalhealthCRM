import { LoginForm } from "@/components/auth/LoginForm";
import { Brain } from "lucide-react";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mb-4">
            <Brain className="text-white h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">NewLife CRM</h1>
          <p className="text-gray-600">Mental Health Practice Management</p>
        </div>
        
        <LoginForm />
        
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don't have an account? Contact your administrator for access.
          </p>
        </div>
      </div>
    </div>
  );
} 