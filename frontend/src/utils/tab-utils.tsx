import { ReactNode } from 'react'
import { FileText, Video, Mic, Sparkles, Edit3, Globe, FileType } from 'lucide-react'

export type TabDocumentType = 'pdf' | 'word' | 'video' | 'audio' | 'ai-note' | 'user-note' | 'web' | 'image' | 'other'
export type TabType = TabDocumentType | 'documents' | 'ai-chat'

export const iconMap: Record<TabType, any> = {
  documents: FileText,
  pdf: FileType,
  word: FileText,
  video: Video,
  audio: Mic,
  'ai-note': Sparkles,
  'user-note': Edit3,
  'ai-chat': Sparkles,
  web: Globe,
  image: FileText,
  other: FileText,
}

export const colorMap: Record<TabType, string> = {
  documents: 'text-foreground',
  pdf: 'text-red-600',
  word: 'text-blue-600',
  video: 'text-purple-600',
  audio: 'text-blue-600',
  'ai-note': 'text-teal-600',
  'user-note': 'text-indigo-600',
  'ai-chat': 'text-primary',
  web: 'text-indigo-600',
  image: 'text-green-600',
  other: 'text-gray-600',
}

export function getTabIcon(type: TabType): any {
  return iconMap[type]
}

export function getTabColor(type: TabType): string {
  return colorMap[type]
}
