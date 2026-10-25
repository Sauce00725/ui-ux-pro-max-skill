import { attach, detach, insertMessage, markRead, olderMessages, type Listener } from '../demo/world'

/*
 * Just enough of supabase-js for the parts of the real app that talk to it from
 * the browser: the chat (realtime + messages), photo uploads and account
 * deletion. Backed by the demo world.
 */

type Row = Record<string, unknown>

function channel(name: string) {
  const matchId = /^match:(.+)$/.exec(name)?.[1] ?? ''
  const handlers: Listener[] = []
  const ch = {
    on(type: string, filter: { event?: string }, cb: (payload: unknown) => void) {
      handlers.push({ type, filter, cb })
      return ch
    },
    subscribe(cb?: (status: string) => void) {
      attach(matchId, handlers)
      setTimeout(() => cb?.('SUBSCRIBED'), 120)
      return ch
    },
    async send(_payload: unknown) {
      return 'ok'
    },
    _matchId: matchId,
    _handlers: handlers,
  }
  return ch
}

/** A query you can await (or chain): enough of PostgREST's builder for loading earlier messages. */
function messagesQuery() {
  const f: { match?: string; before?: string; limit: number } = { limit: 40 }
  const q = {
    select: (_cols?: string) => q,
    eq: (col: string, v: string) => ((col === 'match_id' ? (f.match = v) : null), q),
    lt: (col: string, v: string) => ((col === 'created_at' ? (f.before = v) : null), q),
    order: (_col: string, _o?: unknown) => q,
    limit: (n: number) => ((f.limit = n), q),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: olderMessages(f.match ?? '', f.before ?? '9999', f.limit) as unknown as Row[], error: null }).then(resolve),
  }
  return q
}

const client = {
  channel,
  removeChannel(ch: ReturnType<typeof channel>) {
    detach(ch._matchId, ch._handlers)
    return Promise.resolve('ok')
  },
  from(table: string) {
    if (table !== 'messages') {
      return { select: () => Promise.resolve({ data: [], error: null }) }
    }
    return {
      insert(row: { client_id: string; match_id: string; sender_id: string; body: string }) {
        const stored = insertMessage(row)
        return { select: () => ({ single: () => Promise.resolve({ data: stored as unknown as Row, error: null }) }) }
      },
      select: (cols?: string) => messagesQuery().select(cols),
    }
  },
  rpc(name: string, args?: { p_match_id?: string }) {
    if (name === 'mark_match_read' && args?.p_match_id) markRead(args.p_match_id)
    return Promise.resolve({ data: null, error: null })
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (_path: string, _file: unknown, _opts?: unknown) => ({ data: { path: _path }, error: null }),
      remove: async (_paths: string[]) => ({ data: [], error: null }),
      list: async (_prefix?: string, _opts?: unknown) => ({ data: [], error: null }),
    }),
  },
  auth: {
    signOut: async () => ({ error: null }),
  },
}

export const createClient = () => client
