import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

// Simple toast state management to avoid circular imports
import { useState, useEffect } from "react";

interface ToastItem {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  open?: boolean;
  variant?: "default" | "destructive";
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Listen for toast events from the global toast function
  useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      const { toast } = event.detail;
      setToasts(prev => [toast, ...prev].slice(0, 1));
    };

    const handleDismissToast = (event: CustomEvent) => {
      const { toastId } = event.detail;
      if (toastId) {
        setToasts(prev => prev.map(t => 
          t.id === toastId ? { ...t, open: false } : t
        ));
      } else {
        setToasts(prev => prev.map(t => ({ ...t, open: false })));
      }
    };

    const handleUpdateToast = (event: CustomEvent) => {
      const { toast } = event.detail;
      setToasts(prev => prev.map(t => 
        t.id === toast.id ? { ...t, ...toast } : t
      ));
    };

    window.addEventListener('show-toast', handleShowToast as EventListener);
    window.addEventListener('dismiss-toast', handleDismissToast as EventListener);
    window.addEventListener('update-toast', handleUpdateToast as EventListener);
    
    return () => {
      window.removeEventListener('show-toast', handleShowToast as EventListener);
      window.removeEventListener('dismiss-toast', handleDismissToast as EventListener);
      window.removeEventListener('update-toast', handleUpdateToast as EventListener);
    };
  }, []);

  // Remove closed toasts after animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.open !== false));
    }, 300); // Wait for animation to complete

    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
