import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a human-readable error message from API error responses.
 * Handles Pydantic validation errors (array format) and simple string errors.
 * 
 * @param error - The error object from response.json()
 * @param fallback - Fallback message if no detail found
 * @returns Human-readable error message
 */
export function extractErrorMessage(error: any, fallback: string = 'An error occurred'): string {
  if (!error) return fallback;
  
  if (error.detail) {
    if (Array.isArray(error.detail)) {
      // Pydantic validation error format: [{loc: [...], msg: "...", type: "..."}]
      return error.detail
        .map((e: any) => e.msg || e.message || JSON.stringify(e))
        .join(', ');
    } else if (typeof error.detail === 'string') {
      return error.detail;
    } else {
      return JSON.stringify(error.detail);
    }
  }
  
  if (error.message) {
    return error.message;
  }
  
  return fallback;
}
