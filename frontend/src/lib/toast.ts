import { toast as toastify, type ToastOptions } from 'react-toastify';

const defaultSuccess: ToastOptions = { autoClose: 4000 };
const defaultError: ToastOptions = { autoClose: 8000 };

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    toastify.success(message, { ...defaultSuccess, ...options }),
  error: (message: string, options?: ToastOptions) =>
    toastify.error(message, { ...defaultError, ...options }),
  info: (message: string, options?: ToastOptions) =>
    toastify.info(message, options),
  warning: (message: string, options?: ToastOptions) =>
    toastify.warning(message, options),
};
