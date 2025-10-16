export function getUserInitials(name?: string): string {
  // Handle undefined, null, empty string, or whitespace-only strings
  if (!name || !name.trim()) {
    return 'U'
  }

  const trimmedName = name.trim()
  const names = trimmedName.split(/\s+/) // Split on any whitespace

  if (names.length >= 2) {
    // Take first letter of first two words
    return `${names[0][0]}${names[1][0]}`.toUpperCase()
  }

  // Single word - take first two letters if available, otherwise just first letter
  return trimmedName.length >= 2
    ? trimmedName.substring(0, 2).toUpperCase()
    : trimmedName[0].toUpperCase()
}