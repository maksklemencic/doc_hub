'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { ArrowLeft, FileText, FileCode, File } from 'lucide-react'
import { documentsApi, DocumentResponse } from '@/lib/api'
import { useSpaceDocuments } from '@/hooks/use-documents'
import { useSpacesContext } from '@/contexts/spaces-context'
import { useNavbar } from '@/contexts/navbar-context'
import { SpaceLayout } from '@/components/layout/space-layout'
import { SpaceChat } from '@/components/chat/space-chat'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export default function DocumentViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { getSpaceById } = useSpacesContext()
  const { setTitle } = useNavbar()
  const spaceId = params.spaceId as string
  const docId = params.docId as string
  const space = getSpaceById(spaceId)
  const spaceName = space?.name || 'Space'

  const [activeTab, setActiveTab] = useState('pdf')
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [textContent, setTextContent] = useState<string>('')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false)
  const [isLoadingText, setIsLoadingText] = useState(false)
  const [isLoadingPdf, setIsLoadingPdf] = useState(false)
  const [markdownError, setMarkdownError] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [numPages, setNumPages] = useState<number>(0)
  const [pdfKey, setPdfKey] = useState<string>(docId)
  const [chatState, setChatState] = useState<'visible' | 'hidden' | 'fullscreen'>('visible')

  // Set navbar title
  useEffect(() => {
    setTitle(spaceName)
    return () => setTitle(null) // Clear title on unmount
  }, [spaceName, setTitle])

  // Fetch documents to get document name
  const { data: documentsData } = useSpaceDocuments(spaceId)
  const document = documentsData?.documents?.find((doc: DocumentResponse) => doc.id === docId)
  const documentName = document?.filename || 'Document'

  // Load PDF on mount (default tab)
  useEffect(() => {
    let currentUrl: string | null = null
    let mounted = true

    const loadPdf = async () => {
      // Revoke old URL if it exists
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
        setNumPages(0)
      }

      setIsLoadingPdf(true)
      setPdfError(null)
      setPdfKey(docId) // Update key to force remount of PDF component

      try {
        const url = await documentsApi.getDocumentFile(docId)
        currentUrl = url

        if (mounted) {
          setPdfUrl(url)
        } else {
          // If component unmounted during fetch, clean up immediately
          URL.revokeObjectURL(url)
        }
      } catch (error) {
        console.error('Failed to load PDF:', error)
        if (mounted) {
          setPdfError('Failed to load PDF document')
        }
      } finally {
        if (mounted) {
          setIsLoadingPdf(false)
        }
      }
    }

    loadPdf()

    // Cleanup: revoke blob URL when component unmounts or docId changes
    return () => {
      mounted = false
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl)
      }
    }
  }, [docId])

  // Load markdown content when markdown tab is activated
  useEffect(() => {
    if (activeTab === 'markdown' && !markdownContent && !isLoadingMarkdown && !markdownError) {
      const loadMarkdown = async () => {
        setIsLoadingMarkdown(true)
        setMarkdownError(null)
        try {
          const content = await documentsApi.getDocumentMarkdown(docId)
          setMarkdownContent(content)
        } catch (error) {
          console.error('Failed to load markdown:', error)
          setMarkdownError('Failed to load markdown content')
        } finally {
          setIsLoadingMarkdown(false)
        }
      }

      loadMarkdown()
    }
  }, [activeTab, docId, markdownContent, isLoadingMarkdown, markdownError])

  // Load text content when text tab is activated
  useEffect(() => {
    if (activeTab === 'text' && !textContent && !isLoadingText && !textError) {
      const loadText = async () => {
        setIsLoadingText(true)
        setTextError(null)
        try {
          const content = await documentsApi.getDocumentText(docId)
          setTextContent(content)
        } catch (error) {
          console.error('Failed to load text:', error)
          setTextError('Failed to load text content')
        } finally {
          setIsLoadingText(false)
        }
      }

      loadText()
    }
  }, [activeTab, docId, textContent, isLoadingText, textError])


  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    console.log('PDF loaded successfully with', numPages, 'pages')
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setPdfError('Failed to render PDF document')
  }

  // No need to memoize - blob URLs are strings and don't have detachment issues

  const handleBack = () => {
    router.push(`/spaces/${spaceId}`)
  }

  const documentContent = (
    <div className="h-full flex flex-col bg-background">
      {/* Header with Back Button, Document Name, and Tabs */}
      <div className="border-b bg-white p-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Back Button */}
          <Button variant="ghost" size="sm" onClick={handleBack} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Space
          </Button>

          {/* Center: Document Name */}
          <div className="flex-1 text-center min-w-0">
            <h2 className="text-lg font-semibold truncate" title={documentName}>
              {documentName}
            </h2>
          </div>

          {/* Right: Tabs */}
          <TabsList className="flex-shrink-0">
            <TabsTrigger value="pdf" className="cursor-pointer">
              <File className="h-4 w-4 mr-2" />
              View
            </TabsTrigger>
            <TabsTrigger value="markdown" className="cursor-pointer">
              <FileCode className="h-4 w-4 mr-2" />
              Markdown
            </TabsTrigger>
            <TabsTrigger value="text" className="cursor-pointer">
              <FileText className="h-4 w-4 mr-2" />
              Text
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        {/* PDF Tab */}
        <TabsContent value="pdf" className="h-full m-0 px-8 py-6">
          <div className="h-full bg-white overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-8 flex flex-col items-center">
                {isLoadingPdf ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="mr-2" />
                    <span className="text-muted-foreground">Loading PDF...</span>
                  </div>
                ) : pdfError ? (
                  <div className="text-center py-12">
                    <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Failed to load PDF</h3>
                    <p className="text-muted-foreground">{pdfError}</p>
                  </div>
                ) : pdfUrl ? (
                  <Document
                    key={pdfKey}
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center py-12">
                        <Spinner className="mr-2" />
                        <span className="text-muted-foreground">Loading PDF...</span>
                      </div>
                    }
                    error={
                      <div className="text-center py-12">
                        <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Failed to render PDF</h3>
                        <p className="text-muted-foreground">The PDF file could not be displayed</p>
                      </div>
                    }
                    className="w-full"
                  >
                    {Array.from(new Array(numPages), (el, index) => (
                      <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        className="mb-4 shadow-lg"
                        width={Math.min(800, typeof window !== 'undefined' ? window.innerWidth - 200 : 800)}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                      />
                    ))}
                  </Document>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Markdown Tab */}
        <TabsContent value="markdown" className="h-full m-0 px-8 py-6">
          <div className="h-full bg-white overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-8">
                {isLoadingMarkdown ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="mr-2" />
                    <span className="text-muted-foreground">Loading markdown...</span>
                  </div>
                ) : markdownError ? (
                  <div className="text-center py-12">
                    <FileCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Failed to load markdown</h3>
                    <p className="text-muted-foreground">{markdownError}</p>
                  </div>
                ) : (
                  <article className="prose prose-sm max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-lg prose-h3:mt-4 prose-h3:mb-2 prose-h4:text-base prose-h4:mt-3 prose-h4:mb-2 prose-p:text-gray-800 prose-p:leading-relaxed prose-p:mb-3 prose-ul:my-3 prose-ol:my-3 prose-li:text-gray-800 prose-li:my-1 prose-a:text-blue-600 prose-a:underline prose-strong:font-bold prose-strong:text-gray-900 prose-code:bg-gray-100 prose-code:text-gray-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-table:my-4 prose-th:bg-gray-100 prose-th:p-2 prose-th:font-semibold prose-td:p-2 prose-td:border">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {markdownContent}
                    </ReactMarkdown>
                  </article>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* Text Tab */}
        <TabsContent value="text" className="h-full m-0 px-8 py-6">
          <div className="h-full bg-white overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-8">
                {isLoadingText ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="mr-2" />
                    <span className="text-muted-foreground">Loading text...</span>
                  </div>
                ) : textError ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Failed to load text</h3>
                    <p className="text-muted-foreground">{textError}</p>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-sm text-gray-700 leading-relaxed">
                    {textContent}
                  </pre>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>
      </div>
    </div>
  )

  const chatContent = (
    <SpaceChat
      spaceId={spaceId}
      spaceName={spaceName}
      chatState={chatState}
      onChatStateChange={setChatState}
    />
  )

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
      <SpaceLayout
        chat={chatState !== 'hidden' ? chatContent : null}
        chatState={chatState}
        onChatStateChange={setChatState}
      >
        {documentContent}
      </SpaceLayout>
    </Tabs>
  )
}