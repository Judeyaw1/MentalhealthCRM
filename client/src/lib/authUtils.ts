export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin() {
  window.location.href = "/login";
}

export function canSeeCreatedBy(user: any): boolean {
  if (!user || !user.role) return false;
  
  // Only staff and admin can see "Created By" information
  return user.role === 'staff' || user.role === 'admin';
}