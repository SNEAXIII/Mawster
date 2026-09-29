import { toast } from 'sonner'

interface WithToastOptions<T> {
  success?: string | ((result: T) => string)
  error?: string
  /** Runs after the success toast; a failure here is toasted like the action's own. */
  onSuccess?: (result: T) => unknown
  rethrow?: boolean
}

/** Runs a write, toasts its outcome, and resolves to its result — undefined when it failed. */
export async function withToast<T>(
  action: () => Promise<T>,
  { success, error, onSuccess, rethrow }: WithToastOptions<T>
): Promise<T | undefined> {
  try {
    const result = await action()
    if (success) toast.success(typeof success === 'function' ? success(result) : success)
    await onSuccess?.(result)
    return result
  } catch (err: unknown) {
    toast.error((err as Error).message || error)
    if (rethrow) throw err
    return undefined
  }
}
