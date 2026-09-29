import { toast } from 'sonner'

/** Runs a write, toasts its outcome, and resolves to its result — undefined when it failed. */
export async function withToast<T>(
  action: () => Promise<T>,
  success: string,
  fallbackError?: string
): Promise<T | undefined> {
  try {
    const result = await action()
    toast.success(success)
    return result
  } catch (err: unknown) {
    toast.error((err as Error).message || fallbackError)
    return undefined
  }
}
