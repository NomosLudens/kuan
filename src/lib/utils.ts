import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/integrations/supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isAuthSessionError(error: unknown): boolean {
  if (!error) return false;

  let message = "";
  let status = "";

  if (typeof error === "string") {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object") {
    const errObj = error as Record<string, unknown>;
    message = String(errObj.message || errObj.error || errObj.error_description || "");
    status = String(errObj.status || errObj.statusCode || errObj.code || "");
  }

  const triggers = [
    "jwt expired",
    "invalid jwt",
    "authsessionmissingerror",
    "session_not_found",
    "unauthorized",
    "401",
    "403",
    "jwt_expired",
    "invalid_jwt",
    "invalid claim",
    "claims",
  ];

  const lowerMessage = message.toLowerCase();
  const lowerStatus = status.toLowerCase();

  return triggers.some((t) => lowerMessage.includes(t) || lowerStatus.includes(t));
}

export async function handleAuthSessionExpiry() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Silently ignore if signout fails
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem("supabase.auth.token");
    window.location.href = "/auth";
  }
}
