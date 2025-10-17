import { addSseSubscriber } from '@/lib/ws';

export const runtime = 'nodejs';

export async function GET() {
  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (json: string) => {
        const chunk = `data: ${json}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
      };
      cleanup = addSseSubscriber(send);
      // send an initial ping so clients open immediately
      send(JSON.stringify({ type: 'sse.ready' }));
    },
    cancel() {
      try { cleanup?.(); } finally { cleanup = undefined; }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    }
  });
}


