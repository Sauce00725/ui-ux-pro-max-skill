'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { ChatMessage } from '@/lib/types'

type MessageRow = Omit<ChatMessage, 'status'>

const PAGE_SIZE = 40
const TYPING_TIMEOUT_MS = 3000
const TYPING_THROTTLE_MS = 2000

/** Insert or replace by client_id, keeping the list ordered by created_at. */
function merge(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  const i = list.findIndex((m) => m.client_id === incoming.client_id)
  if (i >= 0) {
    const next = [...list]
    next[i] = { ...list[i], ...incoming }
    return next
  }
  const next = [...list, incoming]
  return next[next.length - 2]?.created_at > incoming.created_at
    ? next.sort((a, b) => a.created_at.localeCompare(b.created_at))
    : next
}

/**
 * Real-time conversation for one match.
 * - New messages and read receipts arrive via Postgres Changes (RLS-filtered).
 * - Typing indicators use Broadcast, so they never touch the database.
 * - Sends are optimistic; the sender-generated client_id dedupes the echo.
 */
export function useChat({
  matchId,
  currentUserId,
  initialMessages,
  initialHasMore,
}: {
  matchId: string
  currentUserId: string
  initialMessages: MessageRow[]
  initialHasMore: boolean
}) {
  const supabase = useRef(createClient()).current
  const channelRef = useRef<RealtimeChannel | null>(null)
  const typingTimer = useRef<number | undefined>(undefined)
  const lastTypingSent = useRef(0)

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map((m) => ({ ...m, status: 'sent' as const })),
  )
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [otherTyping, setOtherTyping] = useState(false)
  const [connected, setConnected] = useState(false)

  const markRead = useCallback(() => {
    void supabase.rpc('mark_match_read', { p_match_id: matchId })
  }, [supabase, matchId])

  useEffect(() => {
    const channel = supabase
      .channel(`match:${matchId}`)
      .on<MessageRow>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        ({ new: row }) => {
          setMessages((prev) => merge(prev, { ...row, status: 'sent' }))
          if (row.sender_id !== currentUserId) {
            setOtherTyping(false)
            if (document.visibilityState === 'visible') markRead()
          }
        },
      )
      .on<MessageRow>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `match_id=eq.${matchId}` },
        ({ new: row }) => setMessages((prev) => merge(prev, { ...row, status: 'sent' })),
      )
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.userId === currentUserId) return
        setOtherTyping(true)
        window.clearTimeout(typingTimer.current)
        typingTimer.current = window.setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS)
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    channelRef.current = channel
    markRead()

    const onVisible = () => document.visibilityState === 'visible' && markRead()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearTimeout(typingTimer.current)
      supabase.removeChannel(channel)
    }
  }, [supabase, matchId, currentUserId, markRead])

  const insert = useCallback(
    async (msg: ChatMessage) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ client_id: msg.client_id, match_id: matchId, sender_id: currentUserId, body: msg.body })
        .select()
        .single<MessageRow>()

      setMessages((prev) =>
        merge(prev, error ? { ...msg, status: 'failed' } : { ...data, status: 'sent' }),
      )
    },
    [supabase, matchId, currentUserId],
  )

  const send = useCallback(
    (body: string) => {
      const text = body.trim()
      if (!text) return
      const optimistic: ChatMessage = {
        id: null,
        client_id: crypto.randomUUID(),
        match_id: matchId,
        sender_id: currentUserId,
        body: text,
        created_at: new Date().toISOString(),
        read_at: null,
        kind: 'text',
        context: null,
        status: 'sending',
      }
      setMessages((prev) => merge(prev, optimistic))
      lastTypingSent.current = 0
      void insert(optimistic)
    },
    [matchId, currentUserId, insert],
  )

  const retry = useCallback(
    (clientId: string) => {
      const msg = messages.find((m) => m.client_id === clientId)
      if (!msg) return
      const pending = { ...msg, status: 'sending' as const }
      setMessages((prev) => merge(prev, pending))
      void insert(pending)
    },
    [messages, insert],
  )

  const notifyTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return
    lastTypingSent.current = now
    void channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId } })
  }, [currentUserId])

  const loadOlder = useCallback(async () => {
    const oldest = messages.find((m) => m.status === 'sent')
    if (!oldest) return
    const { data } = await supabase
      .from('messages')
      .select('id, client_id, match_id, sender_id, body, created_at, read_at, kind, context')
      .eq('match_id', matchId)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const older = (data ?? []).reverse().map((m) => ({ ...m, status: 'sent' as const }))
    setHasMore(older.length === PAGE_SIZE)
    setMessages((prev) => [...older, ...prev])
  }, [supabase, matchId, messages])

  return { messages, send, retry, notifyTyping, otherTyping, connected, hasMore, loadOlder }
}
