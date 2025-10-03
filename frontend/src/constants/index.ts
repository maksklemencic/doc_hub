// Storage keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  USER: 'user',
  THEME: 'theme',
} as const

// Routes
export const ROUTES = {
  LANDING: '/',
  AUTH_CALLBACK: '/auth/callback',
  SPACES: (spaceId?: string) => spaceId ? `/spaces/${spaceId}` : '/spaces',
} as const
