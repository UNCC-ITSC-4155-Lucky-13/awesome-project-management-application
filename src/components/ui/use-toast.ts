"use client";

import { toast as toastManager } from "./toast";

/**
 * Wrapper exposing `success`, `error`, and `info` helpers on top of the
 * base-ui ToastManager (which only exposes `.add`, `.close`, `.update`,
 * `.promise`).
 *
 * All other manager methods are spread onto the export so existing usages
 * (`toast.close`, `toast.update`, etc.) continue to work.
 */
export const toast = {
  // Preserve the original manager functionality
  ...toastManager,

  /** Show a success toast */
  success: (title: string, options?: { description?: string; timeout?: number }) => {
    toastManager.add({ title, type: "success", ...options });
  },

  /** Show an error toast */
  error: (title: string, options?: { description?: string; timeout?: number }) => {
    toastManager.add({ title, type: "error", ...options });
  },

  /** Show an informational toast */
  info: (title: string, options?: { description?: string; timeout?: number }) => {
    toastManager.add({ title, type: "info", ...options });
  },
};

export type Toast = typeof toast;
