import { toast } from "sonner";

type ErrorToastOptions = Parameters<typeof toast.error>[1];
type InfoToastOptions = Parameters<typeof toast.info>[1];
type SuccessToastOptions = Parameters<typeof toast.success>[1];
type WarningToastOptions = Parameters<typeof toast.warning>[1];

export const notify = {
  error(message: string, options?: ErrorToastOptions) {
    return toast.error(message, options);
  },
  info(message: string, options?: InfoToastOptions) {
    return toast.info(message, options);
  },
  success(message: string, options?: SuccessToastOptions) {
    return toast.success(message, options);
  },
  warning(message: string, options?: WarningToastOptions) {
    return toast.warning(message, options);
  }
};
