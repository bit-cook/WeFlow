import { useEffect, useState, type CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import './DualReportWindow.scss'

interface DualReportMessage {
  content: string
  isSentByMe: boolean
  createTime: number
  createTimeStr: string
}

interface DualReportData {
  year: number
  myName: string
  friendUsername: string
  friendName: string
  firstChat: {
    createTime: number
    createTimeStr: string
    content: string
    isSentByMe: boolean
    senderUsername?: string
  } | null
  thisYearFirstChat?: {
    createTime: number
    createTimeStr: string
    content: string
    isSentByMe: boolean
    friendName: string
    firstThreeMessages: DualReportMessage[]
  } | null
  yearlyStats: {
    totalMessages: number
    totalWords: number
    imageCount: number
    voiceCount: number
    emojiCount: number
    myTopEmojiMd5?: string
    friendTopEmojiMd5?: string
    myTopEmojiUrl?: string
    friendTopEmojiUrl?: string
  }
  wordCloud: {
    words: Array<{ phrase: string; count: number }>
    totalWords: number
    totalMessages: number
  }
}

const WordCloud = ({ words }: { words: { phrase: string; count: number }[] }) => {
  if (!words || words.length === 0) {
    return <div className="word-cloud-empty">暂无高频语句</div>
  }
  const maxCount = words.length > 0 ? words[0].count : 1
  const topWords = words.slice(0, 32)
  const baseSize = 520

  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  const placedItems: { x: number; y: number; w: number; h: number }[] = []

  const canPlace = (x: number, y: number, w: number, h: number): boolean => {
    const halfW = w / 2
    const halfH = h / 2
    const dx = x - 50
    const dy = y - 50
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxR = 49 - Math.max(halfW, halfH)
    if (dist > maxR) return false

    const pad = 1.8
    for (const p of placedItems) {
      if ((x - halfW - pad) < (p.x + p.w / 2) &&
        (x + halfW + pad) > (p.x - p.w / 2) &&
        (y - halfH - pad) < (p.y + p.h / 2) &&
        (y + halfH + pad) > (p.y - p.h / 2)) {
        return false
      }
    }
    return true
  }

  const wordItems = topWords.map((item, i) => {
    const ratio = item.count / maxCount
    const fontSize = Math.round(12 + Math.pow(ratio, 0.65) * 20)
    const opacity = Math.min(1, Math.max(0.35, 0.35 + ratio * 0.65))
    const delay = (i * 0.04).toFixed(2)

    const charCount = Math.max(1, item.phrase.length)
    const hasCjk = /[\u4e00-\u9fff]/.test(item.phrase)
    const hasLatin = /[A-Za-z0-9]/.test(item.phrase)
    const widthFactor = hasCjk && hasLatin ? 0.85 : hasCjk ? 0.98 : 0.6
    const widthPx = fontSize * (charCount * widthFactor)
    const heightPx = fontSize * 1.1
    const widthPct = (widthPx / baseSize) * 100
    const heightPct = (heightPx / baseSize) * 100

    let x = 50, y = 50
    let placedOk = false
    const tries = i === 0 ? 1 : 420

    for (let t = 0; t < tries; t++) {
      if (i === 0) {
        x = 50
        y = 50
      } else {
        const idx = i + t * 0.28
        const radius = Math.sqrt(idx) * 7.6 + (seededRandom(i * 1000 + t) * 1.2 - 0.6)
        const angle = idx * 2.399963 + seededRandom(i * 2000 + t) * 0.35
        x = 50 + radius * Math.cos(angle)
        y = 50 + radius * Math.sin(angle)
      }
      if (canPlace(x, y, widthPct, heightPct)) {
        placedOk = true
        break
      }
    }

    if (!placedOk) return null
    placedItems.push({ x, y, w: widthPct, h: heightPct })

    return (
      <span
        key={i}
        className="word-tag"
        style={{
          '--final-opacity': opacity,
          left: `${x.toFixed(2)}%`,
          top: `${y.toFixed(2)}%`,
          fontSize: `${fontSize}px`,
          animationDelay: `${delay}s`,
        } as CSSProperties}
        title={`${item.phrase} (出现 ${item.count} 次)`}
      >
        {item.phrase}
      </span>
    )
  }).filter(Boolean)

  return (
    <div className="word-cloud-wrapper">
      <div className="word-cloud-inner">
        {wordItems}
      </div>
    </div>
  )
}

function DualReportWindow() {
  const [reportData, setReportData] = useState<DualReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadingStage, setLoadingStage] = useState('准备中')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [myEmojiUrl, setMyEmojiUrl] = useState<string | null>(null)
  const [friendEmojiUrl, setFriendEmojiUrl] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '')
    const username = params.get('username')
    const yearParam = params.get('year')
    const parsedYear = yearParam ? parseInt(yearParam, 10) : 0
    const year = Number.isNaN(parsedYear) ? 0 : parsedYear
    if (!username) {
      setError('缺少好友信息')
      setIsLoading(false)
      return
    }
    generateReport(username, year)
  }, [])

  const generateReport = async (friendUsername: string, year: number) => {
    setIsLoading(true)
    setError(null)
    setLoadingProgress(0)

    const removeProgressListener = window.electronAPI.dualReport.onProgress?.((payload: { status: string; progress: number }) => {
      setLoadingProgress(payload.progress)
      setLoadingStage(payload.status)
    })

    try {
      const result = await window.electronAPI.dualReport.generateReport({ friendUsername, year })
      removeProgressListener?.()
      setLoadingProgress(100)
      setLoadingStage('完成')

      if (result.success && result.data) {
        setReportData(result.data)
        setIsLoading(false)
      } else {
        setError(result.error || '生成报告失败')
        setIsLoading(false)
      }
    } catch (e) {
      removeProgressListener?.()
      setError(String(e))
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const loadEmojis = async () => {
      if (!reportData) return
      const stats = reportData.yearlyStats
      if (stats.myTopEmojiUrl) {
        const res = await window.electronAPI.chat.downloadEmoji(stats.myTopEmojiUrl, stats.myTopEmojiMd5)
        if (res.success && res.localPath) {
          setMyEmojiUrl(res.localPath)
        }
      }
      if (stats.friendTopEmojiUrl) {
        const res = await window.electronAPI.chat.downloadEmoji(stats.friendTopEmojiUrl, stats.friendTopEmojiMd5)
        if (res.success && res.localPath) {
          setFriendEmojiUrl(res.localPath)
        }
      }
    }
    void loadEmojis()
  }, [reportData])

  if (isLoading) {
    return (
      <div className="dual-report-window loading">
        <Loader2 size={36} className="spin" />
        <div className="progress">{loadingProgress}%</div>
        <div className="stage">{loadingStage}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dual-report-window error">
        <p>生成报告失败：{error}</p>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="dual-report-window error">
        <p>暂无数据</p>
      </div>
    )
  }

  const yearTitle = reportData.year === 0 ? '全部时间' : `${reportData.year}年`
  const firstChat = reportData.firstChat
  const daysSince = firstChat
    ? Math.max(0, Math.floor((Date.now() - firstChat.createTime) / 86400000))
    : null
  const thisYearFirstChat = reportData.thisYearFirstChat
  const stats = reportData.yearlyStats

  return (
    <div className="dual-report-window">
      <section className="dual-section cover">
        <div className="label">DUAL REPORT</div>
        <h1>{reportData.myName} &amp; {reportData.friendName}</h1>
        <p>让我们一起回顾这段独一无二的对话</p>
      </section>

      <section className="dual-section">
        <div className="section-title">首次聊天</div>
        {firstChat ? (
          <div className="info-card">
            <div className="info-row">
              <span className="info-label">第一次聊天时间</span>
              <span className="info-value">{firstChat.createTimeStr}</span>
            </div>
            <div className="info-row">
              <span className="info-label">距今天数</span>
              <span className="info-value">{daysSince} 天</span>
            </div>
            <div className="info-row">
              <span className="info-label">首条消息</span>
              <span className="info-value">{firstChat.content || '（空）'}</span>
            </div>
          </div>
        ) : (
          <div className="info-empty">暂无首条消息</div>
        )}
      </section>

      {thisYearFirstChat ? (
        <section className="dual-section">
          <div className="section-title">今年首次聊天</div>
          <div className="info-card">
            <div className="info-row">
              <span className="info-label">首次时间</span>
              <span className="info-value">{thisYearFirstChat.createTimeStr}</span>
            </div>
            <div className="info-row">
              <span className="info-label">发起者</span>
              <span className="info-value">{thisYearFirstChat.isSentByMe ? reportData.myName : reportData.friendName}</span>
            </div>
            <div className="message-list">
              {thisYearFirstChat.firstThreeMessages.map((msg, idx) => (
                <div key={idx} className={`message-item ${msg.isSentByMe ? 'sent' : 'received'}`}>
                  <div className="message-meta">{msg.isSentByMe ? reportData.myName : reportData.friendName} · {msg.createTimeStr}</div>
                  <div className="message-content">{msg.content || '（空）'}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="dual-section">
        <div className="section-title">{yearTitle}常用语</div>
        <WordCloud words={reportData.wordCloud.words} />
      </section>

      <section className="dual-section">
        <div className="section-title">{yearTitle}统计</div>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalMessages.toLocaleString()}</div>
            <div className="stat-label">总消息数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalWords.toLocaleString()}</div>
            <div className="stat-label">总字数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.imageCount.toLocaleString()}</div>
            <div className="stat-label">图片</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.voiceCount.toLocaleString()}</div>
            <div className="stat-label">语音</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.emojiCount.toLocaleString()}</div>
            <div className="stat-label">表情</div>
          </div>
        </div>

        <div className="emoji-row">
          <div className="emoji-card">
            <div className="emoji-title">我常用的表情</div>
            {myEmojiUrl ? (
              <img src={myEmojiUrl} alt="my-emoji" />
            ) : (
              <div className="emoji-placeholder">{stats.myTopEmojiMd5 || '暂无'}</div>
            )}
          </div>
          <div className="emoji-card">
            <div className="emoji-title">{reportData.friendName}常用的表情</div>
            {friendEmojiUrl ? (
              <img src={friendEmojiUrl} alt="friend-emoji" />
            ) : (
              <div className="emoji-placeholder">{stats.friendTopEmojiMd5 || '暂无'}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

export default DualReportWindow
