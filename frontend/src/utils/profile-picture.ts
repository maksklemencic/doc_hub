import { User } from '@/types'

/**
 * Validates if a URL is a proper image URL
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const urlObj = new URL(url)
    // Check if it's a common image hosting domain or Google profile picture
    const allowedDomains = [
      'lh3.googleusercontent.com',
      'googleusercontent.com',
      'graph.facebook.com',
      'secure.gravatar.com',
      'avatars.githubusercontent.com'
    ]

    // For Google profile pictures specifically
    if (urlObj.hostname.includes('googleusercontent.com')) {
      return true
    }

    // Check if it has valid image file extension
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
    const hasImageExtension = imageExtensions.some(ext =>
      urlObj.pathname.toLowerCase().endsWith(ext)
    )

    return hasImageExtension || allowedDomains.some(domain =>
      urlObj.hostname.includes(domain)
    )
  } catch {
    return false
  }
}

/**
 * Gets a normalized profile picture URL with fallback
 */
export function getProfilePictureUrl(user: User | null | undefined): {
  url: string | null
  isValid: boolean
  needsFallback: boolean
} {
  if (!user?.picture) {
    return { url: null, isValid: false, needsFallback: true }
  }

  // Handle URL encoding for Google profile pictures
  let pictureUrl = user.picture
  if (pictureUrl.includes(' ')) {
    pictureUrl = decodeURIComponent(pictureUrl)
  }

  const isValid = isValidImageUrl(pictureUrl)
  return {
    url: pictureUrl,
    isValid,
    needsFallback: !isValid
  }
}

/**
 * Gets user initials for fallback avatar
 */
export function getUserInitials(name: string | null | undefined): string {
  if (!name) {
    return 'U' // Default to 'U' for User
  }

  const names = name.trim().split(' ')
  if (names.length >= 2) {
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
  } else if (names.length === 1 && names[0].length > 0) {
    return names[0][0].toUpperCase()
  }

  return 'U'
}

/**
 * Profile picture error handler for React img onError
 */
export function handleProfilePictureError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackHandler?: () => void
) {
  // Hide the broken image
  event.currentTarget.style.display = 'none'

  // Call custom fallback handler if provided
  if (fallbackHandler) {
    fallbackHandler()
  }
}

/**
 * Creates a profile picture component configuration
 */
export function getProfilePictureConfig(user: User | null | undefined) {
  const { url, isValid, needsFallback } = getProfilePictureUrl(user)
  const initials = getUserInitials(user?.name)

  return {
    pictureUrl: isValid ? url : null,
    initials,
    alt: user?.name || 'User',
    needsFallback,
    hasPicture: !!user?.picture,
    isValidPicture: isValid
  }
}