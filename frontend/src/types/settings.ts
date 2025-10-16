export interface AIModel {
  value: string
  label: string
  provider: string
}

export interface LLMData {
  modelName: string
  rateLimits: {
    requestsPerMinute: number
    requestsRemaining: number
    tokensPerMinute: number
    tokensRemaining: number
  }
  systemPrompt: string
}

export interface Space {
  id: string
  name: string
  icon?: string
  icon_color?: string
}

export type ThemeMode = 'light' | 'dark' | 'system'