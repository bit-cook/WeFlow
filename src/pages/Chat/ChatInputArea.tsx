import React from 'react'
import { Lock, Search } from 'lucide-react'

export interface ChatInputAreaProps {
  disabled?: boolean
  placeholder?: string
  onFocusSearch?: () => void
}

function ChatInputArea({
  disabled = true,
  placeholder = '聊天记录',
  onFocusSearch
}: ChatInputAreaProps) {
  return (
    <div className="chat-input-area" aria-hidden={disabled ? undefined : false}>
      <button
        type="button"
        className="chat-input-search-btn"
        onClick={onFocusSearch}
        disabled={!onFocusSearch}
        title="搜索"
      >
        <Search size={16} />
      </button>
      <div className="chat-input-shell">
        <Lock size={15} />
        <span>{placeholder}</span>
      </div>
    </div>
  )
}

function areEqual(prev: ChatInputAreaProps, next: ChatInputAreaProps) {
  return (
    prev.disabled === next.disabled &&
    prev.placeholder === next.placeholder &&
    prev.onFocusSearch === next.onFocusSearch
  )
}

export default React.memo(ChatInputArea, areEqual)
