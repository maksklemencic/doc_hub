# Doc Hub UI Design Specification

## Overview
Two-panel layout with contextual right panel for RAG chat. Focus on space-centric document management with per-space upload and chat functionality.

## Layout Structure

### Left Sidebar (Fixed Width, Always Visible)
```
📁 Documents (global/search - future feature)
📂 Spaces
  ├── 🟢 Current Space Name (highlighted/selected)
  ├── Recent Space 1
  ├── Recent Space 2  
  ├── Recent Space 3
  └── + See all spaces
```

**Key Points:**
- Current space is clearly highlighted with different styling (background, border, icon)
- Show 3-4 most recently used spaces for quick switching  
- No upload button in sidebar (upload is space-specific)
- Space switching is occasional, not frequent

### Main Content Area (Dynamic Content)

#### State 1: Documents View (Default state when space selected)
```
[Space Name Header with Storage Stats]
"Current Space Name • 12 documents • 2.4GB used • 7.6GB remaining"

[+ Upload Documents] [View: Grid/List] [Sort: Recent/Name/Size] [Search]

[Document Grid/List Display]
- Thumbnail previews for images/PDFs
- File type icons for other formats
- Show: filename, size, upload date
- Hover actions: download, share, delete
```

#### State 2: Document Preview (When document is clicked)
```
[← Back to Documents] [Document Name] [Actions: Share/Download/Delete]

[Document Viewer]
- PDF/text/image preview
- Full document display
```

### Right Panel (Contextual, Collapsible)

**Documents View State:**
- Collapsed or minimal
- Could show space description/recent activity

**Document Preview State:**  
- RAG Chat interface appears
- "Ask questions about this document"
- "Ask questions about this space"
- Chat history (scoped to current space)
- Can expand to take more width if needed

## Key User Flows

1. **Default Flow:**
   - User opens app → Most recently used space is auto-selected
   - Main area shows documents view for that space
   - Sidebar shows current space highlighted + recent spaces

2. **Document Viewing:**
   - Click document → Main area switches to document preview
   - Right panel appears with RAG chat
   - Use "← Back" to return to documents view

3. **Upload Flow:**
   - In documents view → Click "+ Upload Documents"
   - Modal opens with drag & drop zone
   - Multi-file selection, progress indicators
   - Files uploaded to current space

4. **Space Switching:**
   - Click different space in sidebar
   - Main area updates to show documents for new space
   - New space becomes "current" (highlighted)

## UI Components Details

### Space Storage Stats
- Horizontal progress bar showing usage
- Color coding: green → yellow → red as storage fills
- Text: "12 documents • 2.4GB used • 7.6GB remaining"

### Document Grid/List
- Thumbnail previews where possible
- File metadata clearly visible
- Hover states for quick actions
- Support both grid and list view modes

### Upload Modal
- Large drag & drop area
- Multiple file support
- Real-time upload progress
- Stay within current space context
- File type validation

### RAG Chat (Right Panel)
- Context-aware prompting
- Document-specific vs space-specific queries
- Chat history persistence per space
- Expandable interface

## Navigation Principles

1. **Always show current context** - User always knows which space they're in
2. **Minimal navigation depth** - Max 2 clicks to get anywhere
3. **Contextual actions** - Upload and chat are context-aware
4. **Clear back navigation** - Easy to return to previous state

## Future Considerations

- Global document search from sidebar "Documents" section
- Mobile responsive behavior (collapsible panels)
- Collaborative features (sharing, comments)
- Document preview on hover
- Advanced filtering and search

## Technical Notes

- Main content area handles two distinct views (documents list vs document preview)
- Right panel appears/disappears based on context
- Space selection state management is critical
- Chat history scoped per space
- Upload functionality scoped per space