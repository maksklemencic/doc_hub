/**
 * Structured logging utility with environment awareness and context support
 *
 * This logger provides consistent logging across the application with:
 * - Environment-aware output (development vs production)
 * - Context information for better debugging
 * - Structured log levels
 * - Ready for error tracking service integration
 */

export interface LogContext {
  component?: string
  action?: string
  userId?: string
  spaceId?: string
  [key: string]: any
}

class Logger {
  /**
   * Debug level logging - only shown in development
   */
  debug(message: string, data?: any, context?: string | LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const contextStr = this.formatContext(context)
      console.log(`[DEBUG]${contextStr}${message}`, data || '')
    }
  }

  /**
   * Info level logging - only shown in development
   */
  info(message: string, data?: any, context?: string | LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const contextStr = this.formatContext(context)
      console.info(`[INFO]${contextStr}${message}`, data || '')
    }
  }

  /**
   * Warning level logging - always shown
   */
  warn(message: string, data?: any, context?: string | LogContext): void {
    const contextStr = this.formatContext(context)
    console.warn(`[WARN]${contextStr}${message}`, data || '')
  }

  /**
   * Error level logging - always shown
   */
  error(message: string, error?: Error | any, context?: string | LogContext): void {
    const contextStr = this.formatContext(context)
    console.error(`[ERROR]${contextStr}${message}`, error || '')

    // TODO: Send to error tracking service
    // Example integration for services like Sentry, LogRocket, etc.
    // if (typeof window !== 'undefined' && window.errorTracking) {
    //   window.errorTracking.captureException(error, {
    //     tags: { context: contextStr },
    //     extra: { message }
    //   })
    // }
  }

  /**
   * User action logging - for tracking user interactions
   */
  userAction(action: string, data?: any, context?: string | LogContext): void {
    const contextStr = this.formatContext(context)
    const message = `User action: ${action}`

    if (process.env.NODE_ENV === 'development') {
      console.info(`[USER-ACTION]${contextStr}${message}`, data || '')
    }

    // TODO: Send to analytics service
    // Example integration for services like Mixpanel, Amplitude, etc.
    // if (typeof window !== 'undefined' && window.analytics) {
    //   window.analytics.track(action, { ...data, ...context })
    // }
  }

  /**
   * Performance logging - for tracking performance metrics
   */
  performance(metric: string, value: number, unit: string = 'ms', context?: string | LogContext): void {
    const contextStr = this.formatContext(context)
    const message = `Performance: ${metric} = ${value}${unit}`

    if (process.env.NODE_ENV === 'development') {
      console.info(`[PERF]${contextStr}${message}`)
    }

    // TODO: Send to performance monitoring service
    // Example integration for services like New Relic, DataDog, etc.
  }

  /**
   * API logging - for tracking API requests and responses
   */
  api(method: string, url: string, status: number, duration?: number, context?: string | LogContext): void {
    const contextStr = this.formatContext(context)
    const durationStr = duration ? ` (${duration}ms)` : ''
    const message = `API ${method} ${url} → ${status}${durationStr}`

    if (process.env.NODE_ENV === 'development') {
      console.info(`[API]${contextStr}${message}`)
    }
  }

  /**
   * Format context for logging
   */
  private formatContext(context?: string | LogContext): string {
    if (!context) return ' '

    if (typeof context === 'string') {
      return `[${context}] `
    }

    const parts = []
    if (context.component) parts.push(context.component)
    if (context.action) parts.push(context.action)
    if (context.userId) parts.push(`user:${context.userId}`)
    if (context.spaceId) parts.push(`space:${context.spaceId}`)

    return parts.length > 0 ? `[${parts.join(' | ')}] ` : ' '
  }

  /**
   * Create a child logger with predefined context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger()

    // Override methods to include predefined context
    const originalDebug = childLogger.debug.bind(childLogger)
    const originalInfo = childLogger.info.bind(childLogger)
    const originalWarn = childLogger.warn.bind(childLogger)
    const originalError = childLogger.error.bind(childLogger)
    const originalUserAction = childLogger.userAction.bind(childLogger)
    const originalPerformance = childLogger.performance.bind(childLogger)
    const originalApi = childLogger.api.bind(childLogger)

    childLogger.debug = (message: string, data?: any, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalDebug(message, data, mergedContext)
    }

    childLogger.info = (message: string, data?: any, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalInfo(message, data, mergedContext)
    }

    childLogger.warn = (message: string, data?: any, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalWarn(message, data, mergedContext)
    }

    childLogger.error = (message: string, error?: Error | any, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalError(message, error, mergedContext)
    }

    childLogger.userAction = (action: string, data?: any, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalUserAction(action, data, mergedContext)
    }

    childLogger.performance = (metric: string, value: number, unit?: string, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalPerformance(metric, value, unit, mergedContext)
    }

    childLogger.api = (method: string, url: string, status: number, duration?: number, additionalContext?: string | LogContext) => {
      const mergedContext = { ...context, ...(typeof additionalContext === 'object' ? additionalContext : {}) }
      originalApi(method, url, status, duration, mergedContext)
    }

    return childLogger
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience functions for common use cases
export const createLogger = (context: LogContext) => logger.child(context)

// Export component-specific loggers
export const authLogger = createLogger({ component: 'Auth' })
export const spaceLogger = createLogger({ component: 'Space' })
export const documentLogger = createLogger({ component: 'Document' })
export const chatLogger = createLogger({ component: 'Chat' })
export const uploadLogger = createLogger({ component: 'Upload' })
export const storageLogger = createLogger({ component: 'Storage' })
export const settingsLogger = createLogger({ component: 'Settings' })
export const apiLogger = createLogger({ component: 'API' })
export const tabLogger = createLogger({ component: 'TabManagement' })
export const uiLogger = createLogger({ component: 'UI' })

export default logger