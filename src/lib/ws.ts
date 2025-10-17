type WSClient = WebSocket;
type SSESubscriber = (data: string) => void;

type GlobalState = {
  clients: Set<WSClient>;
  sseSubscribers: Set<SSESubscriber>;
};

const g = globalThis as unknown as { __whop_ws__?: GlobalState };

if (!g.__whop_ws__) {
  g.__whop_ws__ = { clients: new Set(), sseSubscribers: new Set() };
}

export function addClient(ws: WSClient) {
  g.__whop_ws__!.clients.add(ws);
  // heartbeat keepalive (Edge terminates idle sockets)
  const interval = setInterval(() => {
    try {
      if (ws.readyState === ws.OPEN) ws.send('{"type":"ping"}');
    } catch {}
  }, 25000);

  ws.addEventListener('close', () => {
    g.__whop_ws__!.clients.delete(ws);
    clearInterval(interval);
  });
}

export function broadcastJson(payload: unknown) {
  const data = JSON.stringify(payload);
  for (const ws of g.__whop_ws__!.clients) {
    try {
      if (ws.readyState === ws.OPEN) ws.send(data);
    } catch {}
  }
  for (const fn of g.__whop_ws__!.sseSubscribers) {
    try { fn(data); } catch {}
  }
}

export function addSseSubscriber(fn: SSESubscriber) {
  g.__whop_ws__!.sseSubscribers.add(fn);
  return () => {
    g.__whop_ws__!.sseSubscribers.delete(fn);
  };
}

