'use client'

import { useEffect, useState } from 'react'

export interface SettingsSection {
  id: string
  label: string
  ref: React.RefObject<HTMLDivElement | null>
}

export function useSettingsScroll(sections: SettingsSection[]) {
  const [activeSection, setActiveSection] = useState('profile')

  useEffect(() => {
    const handleScroll = () => {
      // Cache the scroll area element to avoid repeated DOM queries
      let scrollArea: HTMLElement | null = document.querySelector('[data-radix-scroll-area-viewport]')

      if (!scrollArea) {
        scrollArea = document.querySelector('[data-radix-scroll-area]')
      }

      if (!scrollArea) {
        scrollArea = document.querySelector('.radix-scroll-area-viewport')
      }

      if (!scrollArea) {
        scrollArea = document.querySelector('main')
      }

      if (!scrollArea) {
        return
      }

      const scrollPosition = scrollArea.scrollTop + 80 // Adjusted offset for proper white space above sections

      for (const section of sections) {
        const element = section.ref.current

        if (element && element.offsetTop) {
          const elementTop = element.offsetTop
          const elementBottom = elementTop + element.offsetHeight

          if (scrollPosition >= elementTop && scrollPosition < elementBottom) {
            setActiveSection(section.id)
            break
          }
        }
      }
    }

    // Find the ScrollArea viewport element and add scroll listener
    let scrollArea: HTMLElement | null = document.querySelector('[data-radix-scroll-area-viewport]')

    if (scrollArea) {
      scrollArea.addEventListener('scroll', handleScroll)
      handleScroll() // Initial check
      return () => {
        scrollArea.removeEventListener('scroll', handleScroll)
      }
    }
  }, [sections])

  return { activeSection, setActiveSection }
}