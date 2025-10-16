import { useCallback, useEffect, useState } from 'react'
import { User } from '@/types'
import { getProfilePictureConfig } from '@/utils/profile-picture'

export function useProfilePicture(user: User | null | undefined) {
  const [imageState, setImageState] = useState<{
    isLoading: boolean
    hasError: boolean
    isLoaded: boolean
  }>({
    isLoading: false,
    hasError: false,
    isLoaded: false
  })

  const config = getProfilePictureConfig(user)

  const resetImageState = useCallback(() => {
    setImageState({
      isLoading: false,
      hasError: false,
      isLoaded: false
    })
  }, [])

  const handleImageLoad = useCallback(() => {
    setImageState(prev => ({
      ...prev,
      isLoading: false,
      hasError: false,
      isLoaded: true
    }))
  }, [])

  const handleImageError = useCallback(() => {
    setImageState(prev => ({
      ...prev,
      isLoading: false,
      hasError: true,
      isLoaded: false
    }))
  }, [])

  const handleImageLoadStart = useCallback(() => {
    setImageState(prev => ({
      ...prev,
      isLoading: true,
      hasError: false,
      isLoaded: false
    }))
  }, [])

  // Reset state when user changes
  useEffect(() => {
    resetImageState()
  }, [user, resetImageState])

  return {
    config,
    imageState,
    handleImageLoad,
    handleImageError,
    handleImageLoadStart,
    resetImageState
  }
}