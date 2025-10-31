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

let socket: import('socket.io-client').Socket | null = null;

// async function getSocket() {
//   if (socket?.connected || socket?.connecting) return socket!;
//   socket = io('/', {
//     path: '/socket.io',
//     transports: ['websocket'],
//     withCredentials: true,
//     auth: { projectName: 'dashboard' },
//   });
//   return socket!;
// }
async function getSocket() {
  if (socket) return socket;
  // Prefer local dep; fallback to CDN if missing
  let io;
  try {
    ({ io } = await import('socket.io-client'));
  } catch {
    // Fallback: load the UMD bundle from the CDN and read the global `io`.
    // This avoids TypeScript attempting to resolve types for a remote ES module specifier.
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load socket.io from CDN'));
      document.head.appendChild(s);
    });
    // The CDN UMD build exposes `io` on the global object.
    // @ts-ignore - runtime-provided global from CDN bundle
    io = (globalThis as any).io;
    if (!io) throw new Error('socket.io not found on globalThis after loading CDN');
  }
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
    transports: ['websocket'],
    withCredentials: true,
  });
  return socket;
}
function rid() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

// DEFAULT EXPORT to avoid named-import mismatch
export default async function createSocketLLMCaller() {
  // return ({
  //   model,
  //   messages,
  //   temperature,
  //   maxTokens,
  //   traceId,
  //   signal,
  //   stream,
  // }: CallArgs) =>
  //   new Promise<string>((resolve, reject) => {
  //     const s = getSocket();
  //     const requestId = rid();
  //     let acc = '';

  //     const onResponse = (m: any) => {
  //       if (m?.requestId !== requestId) return;
  //       cleanup();
  //       if (m.ok) resolve(m.text ?? acc ?? '');
  //       else reject(new Error(m.error || 'LLM failed'));
  //     };

  //     const onDelta = (m: any) => {
  //       if (m?.requestId !== requestId) return;
  //       if (typeof m.delta === 'string') acc += m.delta;
  //     };

  //     const onAbort = () => {
  //       cleanup();
  //       reject(new Error('aborted'));
  //     };

  //     const cleanup = () => {
  //       s.off('replay_llm_response', onResponse);
  //       s.off('replay_llm_delta', onDelta);
  //       signal?.removeEventListener?.('abort', onAbort);
  //     };

  //     s.on('replay_llm_response', onResponse);
  //     s.on('replay_llm_delta', onDelta);
  //     signal?.addEventListener?.('abort', onAbort);

  //     s.emit('replay_llm_request', {
  //       requestId,
  //       traceId,
  //       model,
  //       messages,
  //       temperature,
  //       maxTokens,
  //       stream: !!stream,
  //     });
  //   });
  const s = await getSocket();
  if (!s) throw new Error('Socket not available');

  function send(messages: { role: 'system' | 'user' | 'assistant'; content: string }[], opts?: {
    model?: string;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
  }) {
    return new Promise<{ ok: boolean; text?: string; error?: string }>((resolve, reject) => {
      const requestId = crypto.randomUUID();

      if (!s) {
        reject(new Error('Socket not available'));
        return;
      }

      const onResponse = (msg: any) => {
        if (msg.requestId !== requestId) return;
        s.off('replay_llm_response', onResponse);
        resolve(msg);
      };

      s.on('replay_llm_response', onResponse);

      s.emit('replay_llm_request', {
        requestId,
        model: opts?.model ?? 'gpt-3.5-turbo',
        messages,
        stream: !!opts?.stream,
        temperature: opts?.temperature ?? 0.7,
        maxTokens: opts?.maxTokens ?? 512,
      });
    });
}

function onDelta(cb: (delta: { requestId: string; delta: string }) => void) {
    if (!s) throw new Error('Socket not available');
    s.off('replay_llm_delta');
    s.on('replay_llm_delta', cb);
  }

  return { send, onDelta };
}
