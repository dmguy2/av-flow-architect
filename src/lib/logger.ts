import { useLogStore, type LogCategory, type LogLevel } from '@/store/log-store'

export function log(
  category: LogCategory,
  message: string,
  detail?: string,
  level?: LogLevel,
) {
  useLogStore.getState().log(category, message, detail, level)
}
