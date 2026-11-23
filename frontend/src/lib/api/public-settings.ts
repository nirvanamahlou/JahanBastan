import { cache } from "react";
import { apiGet } from "./client";

type PublicSettings = {
  siteName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  workingHours: string | null;
  socialLinks: Record<string, string>;
};

// Share one fresh result across the layout, page and footer in this render.
// React's cache ends with the request; settings are never stale across users.
export const getPublicSettings = cache(() => apiGet<PublicSettings>("/settings"));
