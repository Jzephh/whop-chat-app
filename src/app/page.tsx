"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { createAppIframeSDK } from '@whop-apps/iframe';

type ChatMessage = {
  _id: string;
  userId: string;
  username?: string;
  content?: string;
  imageUrl?: string;
  mentions?: { userId: string; username?: string }[];
  createdAt: string;
};

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<ReturnType<typeof createAppIframeSDK> | null>(null);

  function ensureSdk() {
    if (!sdkRef.current) {
      try { sdkRef.current = createAppIframeSDK({}); } catch {}
    }
    return sdkRef.current;
  }

  const getWhopToken = useCallback(async (): Promise<string | undefined> => {
    try {
      const sdk = ensureSdk();
      // Some SDK versions don't expose getUserToken in the TS types; cast to augment
      const tokenResp = await (sdk as unknown as { getUserToken: () => Promise<{ token?: string }> })
        .getUserToken();
      return tokenResp?.token;
    } catch { return undefined; }
  }, []);

  useEffect(() => {
    // Use relative REST paths so Whop forwards auth headers and avoids CORS
    const API = '';
    let lastTs = 0;
    (async () => {
      const token = await getWhopToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // auth gate first
      const authRes = await fetch(`${API}/api/auth/verify`, { headers });
      if (!authRes.ok) {
        setAuthError('Unauthorized');
        return;
      }
      const authJson = await authRes.json().catch(() => null);
      if (authJson?.userId) setSelfUserId(authJson.userId as string);
      const res = await fetch(`${API}/api/chat/messages?limit=100`, { headers });
      const data = await res.json();
      setMessages(data);
      if (data?.length) lastTs = new Date(data[data.length - 1].createdAt).getTime();
    })();
    // Subscribe to SSE updates (works under apps.whop.com)
    let es: EventSource | null = null;
    let retryMs = 1000;
    const open = () => {
      try {
        es = new EventSource('/api/chat/stream');
        es.onmessage = async (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg?.type === 'message.created') {
              // If we somehow missed events, fetch since last timestamp to catch up
              const createdAt = new Date(msg.payload?.createdAt || Date.now()).getTime();
              if (createdAt <= lastTs) {
                const res = await fetch(`/api/chat/messages?since=${lastTs}`);
                const more = await res.json();
                if (Array.isArray(more) && more.length) {
                  setMessages((prev) => [...prev, ...more]);
                  lastTs = new Date(more[more.length - 1].createdAt).getTime();
                }
              } else {
                setMessages((prev) => [...prev, msg.payload]);
                lastTs = createdAt;
              }
            }
          } catch {}
        };
        es.onerror = () => {
          try { es?.close(); } catch {}
          es = null;
          setTimeout(open, Math.min(10000, (retryMs *= 2)));
        };
      } catch {
        setTimeout(open, Math.min(10000, (retryMs *= 2)));
      }
    };
    open();
    return () => { try { es?.close(); } catch {} };
  }, [getWhopToken]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage() {
    let imageUrl: string | undefined;
    // Use relative REST paths inside Whop to avoid CORS
    const API = '';
    const token = await getWhopToken();
    const authHeaders: Record<string, string> = {};
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;
    if (imageFile) {
      // Upload with progress to our server route (server owns Cloudinary config)
      const form = new FormData();
      form.append('file', imageFile);

      imageUrl = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/api/upload`);
        Object.entries(authHeaders).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
          else setUploadPct(null);
        };
        xhr.onerror = () => {
          console.error('Upload network error');
          reject(new Error('Upload failed'));
        };
        xhr.onload = () => {
          try {
            const resp = JSON.parse(xhr.responseText || '{}');
            const url = resp.url;
            if (xhr.status >= 200 && xhr.status < 300 && url) resolve(url as string);
            else {
              console.error('Upload error', xhr.status, resp);
              reject(new Error(resp?.error || 'Upload failed'));
            }
          } catch (e) {
            console.error('Upload parse error', e);
            reject(e as Error);
          }
        };
        setUploadPct(0);
        xhr.send(form);
      }).finally(() => setUploadPct(null));
      setImageFile(null);
    }
    const res = await fetch(`${API}/api/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ content: input || undefined, imageUrl })
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages(prev => [...prev, msg]);
      setInput("");
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('Send failed', res.status, err);
    }
  }

  if (authError) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-sm text-[var(--muted)]">Access denied. Please open this app from Whop.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4 scrollbar">
        {messages.map((m: ChatMessage & { avatarUrl?: string }) => {
          const isSelf = selfUserId && m.userId === selfUserId;
          return (
            <div key={m._id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
              {!isSelf && (
                <div className="mr-2 mt-1">
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-[#2a2a2e] border border-[var(--border)]">
                    {/* avatar placeholder from message avatarUrl when available */}
                    { m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    ) : null }
                  </div>
                </div>
              )}
              <div className={`max-w-[70%] ${isSelf ? '' : ''}`}>
                <div className={`bubble ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
                  {m.content && <div>{m.content}</div>}
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.imageUrl} alt="upload" className="mt-2 rounded-xl border border-[var(--border)] msg-img" />
                  )}
                </div>
                <div className="mt-1 text-[10px] text-[var(--muted)]">{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 w-full">
        <div className="relative bg-[#151517] border-t border-[var(--border)] flex items-center">
          {uploadPct !== null && (
            <div className="absolute -top-1 left-0 right-0 h-[2px] bg-zinc-800">
              <div className="h-full bg-blue-500" style={{ width: `${uploadPct}%` }} />
            </div>
          )}
          <button
            aria-label="Add"
            onClick={() => document.getElementById('fileInput')?.click()}
            className="mx-3 inline-flex items-center justify-center w-[28px] h-[28px] rounded-full bg-[#2a2a2e] text-[#9ca3af]"
          >
            {/* plus icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message #Post"
            className="flex-1 bg-transparent outline-none text-[14px] h-[48px] px-1 py-[14px] text-[var(--muted)] resize-none"
          />
          <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="hidden" id="fileInput" />
          <button aria-label="Emoji" className="mx-2 inline-flex items-center justify-center w-[28px] h-[28px] text-[#9ca3af]">
            {/* smile */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          <button aria-label="Voice" className="mx-3 inline-flex items-center justify-center w-[28px] h-[28px] text-[#9ca3af]">
            {/* mic icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10a7 7 0 0 1-14 0"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
