export interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: "super_admin" | "admin" | "editor";
  isActive: boolean;
  canManagePricing?: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}
