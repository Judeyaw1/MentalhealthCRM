export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin() {
  window.location.href = "/login";
}

export function canSeeCreatedBy(user: any): boolean {
  if (!user || !user.role) return false;

  // Most roles can see "Created By" information for transparency
  return ["admin", "supervisor", "therapist", "staff", "frontdesk"].includes(user.role);
}
