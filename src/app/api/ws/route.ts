import { addClient } from '@/lib/ws';

type EdgeServerWebSocket = WebSocket & { accept(): void };
type EdgeResponseInit = ResponseInit & { webSocket: WebSocket };

export const runtime = 'edge';

export async function GET(request: Request) {
  const upgradeHeader = request.headers.get('upgrade');
  if (upgradeHeader?.toLowerCase() !== 'websocket') {
    return new Response('Expected a websocket request', { status: 426 });
  }

  // WebSocketPair is provided by Edge runtime; use unknown to satisfy TS during node builds
  const EdgeWebSocketPair = (globalThis as unknown as { WebSocketPair: new () => unknown }).WebSocketPair;
  const pair = new EdgeWebSocketPair() as unknown as [EdgeServerWebSocket, EdgeServerWebSocket];
  const client = pair[0];
  const server = pair[1];
  addClient(server as unknown as WebSocket);
  server.accept();

  return new Response(null, { status: 101, webSocket: client } as EdgeResponseInit);
}

