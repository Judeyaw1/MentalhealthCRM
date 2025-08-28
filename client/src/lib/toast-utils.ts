import { toast } from "@/hooks/use-toast";

// Toast duration constants
export const TOAST_DURATIONS = {
  SHORT: 2000,      // 2 seconds - for quick confirmations
  MEDIUM: 4000,     // 4 seconds - default for success/info
  LONG: 6000,       // 6 seconds - for errors/warnings
  EXTRA_LONG: 8000, // 8 seconds - for important messages
  PERSISTENT: 0,    // No auto-hide
} as const;

// Helper functions for common toast types
export const showSuccessToast = (title: string, description?: string, duration = TOAST_DURATIONS.MEDIUM) => {
  return toast({
    title,
    description,
    duration,
    variant: "default",
  });
};

export const showErrorToast = (title: string, description?: string, duration = TOAST_DURATIONS.LONG) => {
  return toast({
    title,
    description,
    duration,
    variant: "destructive",
  });
};

export const showInfoToast = (title: string, description?: string, duration = TOAST_DURATIONS.MEDIUM) => {
  return toast({
    title,
    description,
    duration,
    variant: "default",
  });
};

export const showWarningToast = (title: string, description?: string, duration = TOAST_DURATIONS.LONG) => {
  return toast({
    title,
    description,
    duration,
    variant: "default", // Using default variant for warnings
  });
};

// Toast for file operations
export const showFileUploadToast = (success: boolean, fileName?: string) => {
  if (success) {
    return showSuccessToast(
      "File uploaded successfully",
      fileName ? `"${fileName}" has been uploaded.` : "File has been uploaded.",
      TOAST_DURATIONS.MEDIUM
    );
  } else {
    return showErrorToast(
      "Upload failed",
      "Failed to upload file. Please try again.",
      TOAST_DURATIONS.LONG
    );
  }
};

// Toast for CRUD operations
export const showCRUDToast = (operation: 'create' | 'update' | 'delete', resource: string, success: boolean) => {
  const operations = {
    create: { action: 'created', past: 'created' },
    update: { action: 'updated', past: 'updated' },
    delete: { action: 'deleted', past: 'deleted' },
  };
  
  const op = operations[operation];
  
  if (success) {
    return showSuccessToast(
      `${resource} ${op.action}`,
      `The ${resource} has been ${op.past} successfully.`,
      TOAST_DURATIONS.MEDIUM
    );
  } else {
    return showErrorToast(
      `${operation} failed`,
      `Failed to ${operation} ${resource}. Please try again.`,
      TOAST_DURATIONS.LONG
    );
  }
};
