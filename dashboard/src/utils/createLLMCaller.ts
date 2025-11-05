// // src/utils/createLLMCaller.ts
import { io, Socket } from 'socket.io-client';

type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type CallArgs = {
  model: string;
  messages: Msg[];
  temperature?: number;
  maxTokens?: number;
  traceId?: string;
  signal?: AbortSignal;
  stream?: boolean;
};

let socket: Socket | null = null;

function genRequestId() {
  return (globalThis as any)?.crypto?.randomUUID
    ? (globalThis as any).crypto.randomUUID()
    : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function getSocket(): Promise<Socket> {
  if (socket) return socket;

  // ✅ Use relative URL and explicit path to match backend + Vite proxy
  socket = io('/', {
    path: '/socket.io',
    transports: ['websocket'],
    withCredentials: true,
    auth: { projectName: 'dashboard' },
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return socket;
}

// DEFAULT EXPORT to avoid named-import mismatch
export default async function createSocketLLMCaller() {
  const s = await getSocket();
  if (!s) throw new Error('Socket not available');

  /**
   * Send a replay LLM request. Resolves on the **final** response/result for THIS requestId.
   * Also exposes onDelta/onResponse to attach global handlers (scoped here by requestId).
   */
  function send(
    messages: { role?: 'system' | 'user' | 'assistant'; content: string }[],
    opts?: {
      model?: string;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
      traceId?: string | null;
    }
  ): Promise<{ ok: boolean; text?: string; error?: string; requestId: string }> {
    return new Promise((resolve, reject) => {
      if (!s) {
        reject(new Error('Socket not available'));
        return;
      }

      const requestId = genRequestId();
      const model = opts?.model ?? 'gpt-4o-mini';
      const stream = !!opts?.stream;
      const temperature = typeof opts?.temperature === 'number' ? opts.temperature : 0.7;
      const maxTokens = typeof opts?.maxTokens === 'number' ? opts.maxTokens : 512;
      const traceId = opts?.traceId ?? null;

      // Normalize messages for safety
      const normalizedMessages = Array.isArray(messages)
        ? messages.map((m) => ({
            role: (m.role || 'user') as 'system' | 'user' | 'assistant',
            content: m.content || '',
          }))
        : [{ role: 'user' as const, content: String(messages || '') }];

      // Per-request listeners (scoped by requestId)
      const onResponse = (msg: any) => {
        if (msg?.requestId !== requestId) return;
        // Keep listening for replay_result to cleanup; resolve on response, though
        cleanupExceptResult();
        resolve({ ok: !!msg?.ok, text: msg?.text, error: msg?.error, requestId });
      };

      const onResult = (msg: any) => {
        if (msg?.requestId !== requestId) return;
        cleanupAll();
        // If send resolved already via onResponse, this is a no-op.
        // If not, resolve here as a fallback with minimal shape.
        if (typeof (resolve as any)._called === 'boolean') return;
        resolve({ ok: !!msg?.success, text: undefined, error: msg?.error, requestId });
      };

      const cleanupExceptResult = () => {
        s.off('replay_llm_response', onResponse);
        // keep onResult to ensure cleanup on result too
      };
      const cleanupAll = () => {
        s.off('replay_llm_delta', onDeltaPassthrough);
        s.off('replay_llm_response', onResponse);
        s.off('replay_result', onResult);
      };

      // Optional: passthrough delta logging (guarded by requestId)
      const onDeltaPassthrough = (d: any) => {
        if (d?.requestId !== requestId) return;
        // no-op here; consumers can subscribe via onDelta(..)
        // console.debug('[WS<-] replay_llm_delta', d);
      };

      s.on('replay_llm_delta', onDeltaPassthrough);
      s.on('replay_llm_response', onResponse);
      s.on('replay_result', onResult);

      // Fire request
      // console.log('▶️ sending replay_llm_request', { requestId, model, stream, msgCount: normalizedMessages.length });
      s.emit('replay_llm_request', {
        requestId,
        model,
        messages: normalizedMessages,
        temperature,
        maxTokens,
        stream,
        traceId,
      });

      // Abort support (optional)
      if (opts?.traceId && typeof AbortSignal !== 'undefined') {
        opts.signal?.addEventListener('abort', () => {
          cleanupAll();
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }
    });
  }

  // Attach a delta handler (do not wipe global listeners; only remove the passed one on re-register)
  function onDelta(cb: (delta: { requestId: string; delta: string }) => void) {
    if (!s) throw new Error('Socket not available');
    s.off('replay_llm_delta', cb);
    s.on('replay_llm_delta', cb);
  }

  // Attach a final response handler
  function onResponse(cb: (resp: { requestId: string; ok: boolean; text?: string; error?: string }) => void) {
    if (!s) throw new Error('Socket not available');
    s.off('replay_llm_response', cb);
    s.on('replay_llm_response', cb);
  }

  // Optional: expose socket for debugging (not required by callers)
  // ;(window as any).__axonSocket = s;

  return { send, onDelta, onResponse };
}
