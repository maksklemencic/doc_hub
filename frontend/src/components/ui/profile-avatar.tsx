'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User } from '@/types'
import { useProfilePicture } from '@/hooks/use-profile-picture'

interface ProfileAvatarProps {
  user: User | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProfileAvatar({
  user,
  size = 'md',
  className
}: ProfileAvatarProps) {
  const { config, imageState, handleImageLoad, handleImageError, handleImageLoadStart } = useProfilePicture(user)
  const shouldShowImage = config.pictureUrl && !imageState.hasError && !config.needsFallback

  // Size classes
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const fallbackSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg'
  }

  
  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {shouldShowImage && (
        <AvatarImage
          src={config.pictureUrl!}
          alt={config.alt}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onLoadStart={handleImageLoadStart}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            display: imageState.hasError ? 'none' : 'block',
            objectFit: 'cover'
          }}
        />
      )}

      <AvatarFallback
        className={`bg-primary text-primary-foreground ${fallbackSizeClasses[size]}`}
        style={{
          display: shouldShowImage && imageState.isLoaded ? 'none' : 'flex'
        }}
      >
        {config.initials}
      </AvatarFallback>
    </Avatar>
  )
}