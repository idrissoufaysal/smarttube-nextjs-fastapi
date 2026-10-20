'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { useLocale, useTranslations } from 'next-intl';
import { BrainCircuit,ArrowUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';

interface ChatInterfaceProps {
  transcript: string;
  url?: string;
  onTimelineClick?: (seconds: number) => void;
}

export function ChatInterface({ transcript, url, onTimelineClick }: ChatInterfaceProps) {
  const videoId = url ? extractVideoId(url) : null;
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    if (!videoId) {
      setIsLoadingHistory(false);
      return;
    }

    fetch(`${API_BASE_URL}/chat/history?videoId=${videoId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setInitialMessages(
            data.map(m => ({
              id: m.id,
              role: m.role as 'user' | 'assistant' | 'system',
              content: m.content,
              parts: [{ type: 'text', text: m.content }],
            }))
          );
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingHistory(false));
  }, [videoId]);

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 12rem)' }}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ChatInterfaceInner 
      transcript={transcript} 
      videoId={videoId} 
      onTimelineClick={onTimelineClick} 
      initialMessages={initialMessages} 
    />
  );
}

function ChatInterfaceInner({ 
  transcript, 
  videoId, 
  onTimelineClick, 
  initialMessages 
}: { 
  transcript: string, 
  videoId: string | null, 
  onTimelineClick?: (seconds: number) => void,
  initialMessages: UIMessage[]
}) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const [input, setInput] = useState('');

  const renderMessageContent = (text: string) => {
    // Regex pour capturer [Source: mm:ss] ou [Source: hh:mm:ss]
    const regex = /\[Source:\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Texte avant la source
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const part1 = parseInt(match[1], 10);
      const part2 = parseInt(match[2], 10);
      const part3 = match[3] ? parseInt(match[3], 10) : undefined;

      let totalSeconds = 0;
      if (part3 !== undefined) {
        // hh:mm:ss
        totalSeconds = part1 * 3600 + part2 * 60 + part3;
      } else {
        // mm:ss
        totalSeconds = part1 * 60 + part2;
      }

      const label = part3 !== undefined 
        ? `${part1.toString().padStart(2, '0')}:${part2.toString().padStart(2, '0')}:${part3.toString().padStart(2, '0')}`
        : `${part1.toString().padStart(2, '0')}:${part2.toString().padStart(2, '0')}`;

      parts.push(
        <button
          key={match.index}
          onClick={() => { onTimelineClick?.(totalSeconds); toast.success(t('sourceToast', { label })); }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 my-1 mx-1 bg-primary/10 border border-primary/20 rounded-full text-xs font-bold text-primary hover:bg-primary/20 active:scale-95 transition-all cursor-pointer inline-block"
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>voir</span>
          [Source: {label}]
        </button>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: API_BASE_URL+'/chat',
      body: { transcript, videoId, locale },
    })
  });

  const isLoading = status === 'submitted';

  const containerRef = useRef<HTMLDivElement>(null);
  const lastMessagesLengthRef = useRef(messages.length);

  // Smart auto-scroll logic
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hasNewMessage = messages.length > lastMessagesLengthRef.current;
    const lastMessage = messages[messages.length - 1];
    const isUserLastMessage = lastMessage?.role === 'user';

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

    // Smooth scroll for new user messages, instant scroll for streaming/responses if already near bottom
    if (hasNewMessage && isUserLastMessage) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    } else if (isNearBottom || (hasNewMessage && !isUserLastMessage)) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'auto',
      });
    }

    lastMessagesLengthRef.current = messages.length;
  }, [messages, status]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) form.requestSubmit();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-surface-highest scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant space-y-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}><BrainCircuit/> </span>
            </div>
            <p className="text-sm text-center font-medium leading-relaxed">
              {t('greeting')}<br />
              <span className="text-xs text-muted-foreground font-normal">{t('greetingSub')}</span>
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'user' ? (
                <div className="flex flex-col items-end gap-2 max-w-[85%]">
                  <div className="bg-primary-container text-on-primary-container p-4 rounded-2xl rounded-tr-none shadow-sm shadow-primary/20">
                    <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                      {m.parts ? m.parts.map((part, i) => {
                        if (part.type === 'text') {
                          return part.text;
                        }
                        return null;
                      }) : (m as any).content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-2 max-w-[90%]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}> <BrainCircuit/> </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">SmartTube AI</span>
                  </div>
                  <div className="bg-surface-highest p-4 rounded-2xl rounded-tl-none border border-outline-variant/10 space-y-3">
                    {m.parts ? m.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return (
                          <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap text-on-surface/90">
                            {renderMessageContent(part.text)}
                          </div>
                        );
                      }
                      return null;
                    }) : typeof (m as any).content === 'string' && (
                       <div className="text-sm leading-relaxed whitespace-pre-wrap text-on-surface/90">
                          {renderMessageContent((m as any).content)}
                       </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex flex-col items-start gap-2 max-w-[90%]">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-xs animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}><BrainCircuit/> </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-tighter text-on-surface-variant">SmartTube AI</span>
            </div>
            <div className="bg-surface-container-high p-4 rounded-2xl rounded-tl-none border border-outline-variant/10">
              <div className="flex gap-1.5 items-center h-4 py-1">
                <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 bg-surface-low border-t border-outline-variant/10 mt-auto">
        <form onSubmit={handleSubmit}>
          <div className="relative group">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t('placeholder')}
              disabled={isLoading}
              rows={2}
              className="w-full bg-surface-container rounded-2xl p-4 pr-12 text-sm text-on-surface placeholder:text-muted-foreground/70 border border-outline-variant/10 focus:border-none resize-none transition-all outline-none min-h-16"
            />
            <Button
              type="submit"
              disabled={isLoading || !input?.trim() || input.length > 1000}
              size="icon"
              className="absolute bottom-3 right-3 w-8 h-8 bg-primary text-on-primary rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm font-bold"> <ArrowUp /> </span>
            </Button>
          </div>
          <div className="mt-3 flex items-center justify-between">
          {input.length >200 &&  <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium transition-colors ${input.length > 900 ? 'text-amber-500 font-bold' : 'text-muted-foreground'}`}>
                {input.length} / 1000
              </span>
            </div>}
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t('pressEnter')}</span>
          </div>
        </form>
      </div>
    </div>
  );

}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}