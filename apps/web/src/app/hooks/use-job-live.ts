import { useEffect, useRef, useState } from 'react'
import type { LiveMessage } from '@/shared/types'
import { parseLiveMessage, reconnectDelay, shouldReconnect } from '../lib/live'

/**
 * - off: not connecting (url is null, the job is not running)
 * - connecting / open: first connection
 * - reconnecting: the connection dropped and a retry is scheduled or running
 * - ended: the server closed for good (job ended, 4403, 4404)
 */
export type LiveConnection = 'off' | 'connecting' | 'open' | 'reconnecting' | 'ended'

export interface LiveHandlers {
  onMessage: (message: LiveMessage) => void
  /** Every successful (re)connection; the place to fetch what was missed. */
  onOpen: () => void
  /** The server closed the channel for good. */
  onEnded: () => void
}

interface LiveSession {
  attempt: number
  disposed: boolean
  socket: WebSocket | null
  timer: ReturnType<typeof setTimeout> | null
}

/** Subscribes to `GET .../live` while `url` is non-null (docs/SPEC.md §11). */
export function useJobLive(url: string | null, handlers: LiveHandlers): LiveConnection {
  const [connection, setConnection] = useState<LiveConnection>('off')
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (url === null) {
      setConnection('off')
      return
    }
    const session: LiveSession = { attempt: 0, disposed: false, socket: null, timer: null }

    const connect = () => {
      setConnection(session.attempt === 0 ? 'connecting' : 'reconnecting')
      const socket = new WebSocket(url)
      session.socket = socket
      socket.addEventListener('open', () => {
        session.attempt = 0
        setConnection('open')
        handlersRef.current.onOpen()
      })
      socket.addEventListener('message', (event) => {
        if (typeof event.data !== 'string') {
          return
        }
        const message = parseLiveMessage(event.data)
        if (message !== null) {
          handlersRef.current.onMessage(message)
        }
      })
      socket.addEventListener('close', (event) => {
        if (session.disposed) {
          return
        }
        if (!shouldReconnect(event.code)) {
          setConnection('ended')
          handlersRef.current.onEnded()
          return
        }
        setConnection('reconnecting')
        session.timer = setTimeout(connect, reconnectDelay(session.attempt))
        session.attempt += 1
      })
    }

    connect()
    return () => {
      session.disposed = true
      if (session.timer !== null) {
        clearTimeout(session.timer)
      }
      if (session.socket !== null) {
        session.socket.close(1000, 'leaving')
      }
    }
  }, [url])

  return connection
}
