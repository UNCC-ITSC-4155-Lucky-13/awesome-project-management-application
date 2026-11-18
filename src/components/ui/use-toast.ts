"use client";

import { toast as toastManager } from "./toast";

/**
 * Wrapper exposing `success`, `error`, and `info` helpers that match the
 * common `react-hot-toast` API used elsewhere in the codebase.
 *
 * The underlying toast manager (created via `ToastPrimitive.createToastManager()`)
 * already provides a `show` method that accepts a `type` field. We simply forward
 * the helpers to that method. All other manager methods are spread onto the export
 * so existing usages (`toast.dismiss`, `toast.update`, etc.) continue to work.
 */
export const toast = {
  // Preserve the original manager functionality
  ...toastManager,

  /** Show a success toast */
  success: (title: string, options?: Parameters<typeof toastManager.show>[0]) => {
    toastManager.show({
      title,
      type: "success",
      ...options,
    });
  },

  /** Show an error toast */
  error: (title: string, options?: Parameters<typeof toastManager.show>[0]) => {
    toastManager.show({
      title,
      type: "error",
      ...options,
    });
  },

  /** Show an informational toast */
  info: (title: string, options?: Parameters<typeof toastManager.show>[0]) => {
    toastManager.show({
      title,
      type: "info",
      ...options,
    });
  },
};

export type Toast = typeof toast;
