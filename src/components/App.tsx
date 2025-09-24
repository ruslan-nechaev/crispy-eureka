// [ПОДСКАЗКА] Основной компонент приложения.
// - Визуальный каркас для ауры, рамок, чата тренера и планов.
// - Подключение shadcn/ui предполагается через будущую установку и стили.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Component as SilkBackground } from '@/components/ui/silk-background-animation'
// import AuraBadge from '@/components/ui/aura-badge'
import { LavaLamp } from '@/components/ui/fluid-blob'
import { OrbInput } from '@/components/ui/animated-input'
import { PearlButton } from '@/components/ui/pearl-button'
// Removed footer/HUD: render only Plan button above input
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline'
import { Calendar, FileText, Code, User, Clock, Sparkles, Menu, MessageSquarePlus } from 'lucide-react'
import WeatherButton from '@/components/ui/button'
import { routeWebhookPayload, mapPlanToTimeline } from '@/lib/plan-router'
import { BlurText } from '@/components/ui/animated-blur-text'
import { motion } from 'framer-motion'
import ActivityChartCard from '@/components/ui/activity-chart-card'

export function App(): JSX.Element {
  const [showMain, setShowMain] = useState(false)
  type ChatMessage = { id: string; role: 'user' | 'bot'; text: string; variant?: 'plain' | 'bubble' }
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  // Dynamic timeline data from routed plan
  const [planTimeline, setPlanTimeline] = useState<any[] | null>(null)
  const [isPlus, setIsPlus] = useState<boolean>(false)

  // Webhook for outbound user messages
  const WEBHOOK_URL = 'https://fit-ai-fg.app.n8n.cloud/webhook-test/20123bc1-5e8c-429d-8790-f20e6138b0f3'
  const [showTimeline, setShowTimeline] = useState(false)

  const GREETING_TEXT = useMemo(
    () => (
      'Привет!\n\nТы получил персонального AI-тренера, который:\n• Всегда онлайн\n• Готов помочь\n• Фокус на тебе'
    ),
    []
  )
  const TPL_QUESTION = 'Задавайте ваш вопрос — я готов помочь!'
  const TPL_TECHNIQUE = 'Пожалуйста, уточни, по какой именно технике тебя интересуют вопросы: техника выполнения какого упражнения или общий принцип тренировок?'
  const TPL_PLAN = 'Хочешь упор на силу, скорость, выносливость, гибкость или комплексный подход? Выбери вектор тренировок!'

  const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  // --- Telegram WebApp persistent state (per device) ---
  const userIdRef = useRef<string>('guest')
  const getTelegramUserId = (): string => {
    try {
      const uid = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.id
      return uid ? String(uid) : 'guest'
    } catch {
      return 'guest'
    }
  }

  // Restore state once on mount
  useEffect(() => {
    userIdRef.current = getTelegramUserId()
    try {
      const key = `user_state_${userIdRef.current}`
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages as ChatMessage[])
        if (Array.isArray(parsed?.planTimeline)) setPlanTimeline(parsed.planTimeline as any[])
        if (typeof parsed?.showTimeline === 'boolean') setShowTimeline(Boolean(parsed.showTimeline))
        if (typeof parsed?.isPlus === 'boolean') setIsPlus(Boolean(parsed.isPlus))
      }
    } catch (err) {
      console.warn('State restore failed', err)
    }
  }, [])

  // Persist state after every interaction/update
  useEffect(() => {
    try {
      const key = `user_state_${userIdRef.current}`
      const toSave = {
        messages,
        planTimeline,
        showTimeline,
        isPlus,
        savedAt: Date.now(),
      }
      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(toSave))
    } catch (err) {
      // Ignore storage quota / private mode errors to avoid breaking UI
    }
  }, [messages, planTimeline, showTimeline, isPlus])

  // --- Telegram Stars payment integration ---
  const createPaymentLink = useCallback(async (): Promise<string> => {
    const tg: any = (window as any)?.Telegram?.WebApp
    const uid = userIdRef.current || getTelegramUserId()
    const url = `https://api.telegram.org/bot8265953307:AAG51J5sUw26d1d4j9XDiKK9yEZ3HvEGD44/createInvoiceLink`
    const body = {
      title: 'Plus подписка',
      description: 'Подписка на расширенные возможности сервиса на 30 дней',
      payload: `plus_subscription_${uid}`,
      currency: 'XTR',
      prices: [{ label: 'Plus подписка', amount: 500 }],
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!data?.ok) throw new Error('Failed to create invoice link')
    return data.result as string
  }, [])

  const payPlus = useCallback(async () => {
    try {
      const tg: any = (window as any)?.Telegram?.WebApp
      const link = await createPaymentLink()
      if (tg?.openInvoice) {
        tg.openInvoice(link, (status: string) => {
          if (status === 'paid') {
            setIsPlus(true)
            alert('Оплата успешно прошла! Теперь вы на Plus.')
          } else if (status === 'failed') {
            alert('Ошибка оплаты. Попробуйте снова.')
          }
        })
      } else {
        // Fallback: open invoice link (outside TG webapp, for local testing)
        window.open(link, '_blank')
      }
    } catch (e) {
      alert('Не удалось открыть оплату. Попробуйте позже.')
    }
  }, [createPaymentLink])

  const handleSend = useCallback(async (text: string): Promise<void> => {
    const userMsg: ChatMessage = { id: createId(), role: 'user', text, variant: 'bubble' }
    setMessages((m) => [...m, userMsg])
    try {
      const params = new URLSearchParams({
        message: text,
        sentAt: new Date().toISOString(),
        origin: 'AuraProject',
        path: typeof window !== 'undefined' ? window.location.pathname : ''
      })
      // Try primary webhook; on failure try production variant
      const candidates: string[] = [
        `${WEBHOOK_URL}?${params.toString()}`,
        `${WEBHOOK_URL.replace('/webhook-test/', '/webhook/')}?${params.toString()}`,
      ]

      let res: Response | null = null
      let lastError: unknown = null
      for (const candidate of candidates) {
        try {
          const r = await fetch(candidate, { method: 'GET', mode: 'cors' })
          if (r.ok) {
            res = r
            break
          }
          // Non-OK response, try next
          lastError = new Error(`HTTP ${r.status}`)
        } catch (err) {
          lastError = err
        }
      }
      if (!res) throw lastError ?? new Error('Webhook unreachable')
      let payload = ''
      try {
        const json = await res.clone().json()
        payload = typeof json === 'string' ? json : JSON.stringify(json)
      } catch {
        payload = await res.text()
      }
      // Route payload: if it's a plan, show timeline with mapped items
      const routed = routeWebhookPayload(payload)
      if (routed.kind === 'plan') {
        const mapped = mapPlanToTimeline(routed)
        setPlanTimeline(mapped as any)
        setShowTimeline(true)
        // Используем встроенный React-таймлайн через состояние planTimeline
        // Also reflect in chat briefly
        setMessages((m) => [...m, { id: createId(), role: 'bot', text: 'План получен. Отобразил упражнения на орбитах.', variant: 'bubble' }])
      } else if (routed.kind === 'text') {
        // Чистый текст без префиксов/сырого JSON
        const clean = (() => {
          try {
            // если пришла строка вида '[{"output":"..."}]' — вытащим output
            const arr = JSON.parse(routed.text);
            if (Array.isArray(arr) && arr[0] && typeof arr[0].output === 'string') {
              return String(arr[0].output);
            }
          } catch {}
          return routed.text;
        })();
        setMessages((m) => [...m, { id: createId(), role: 'bot', text: clean, variant: 'plain' }])
      } else {
      setMessages((m) => [...m, { id: createId(), role: 'bot', text: payload || 'OK', variant: 'plain' }])
      }
    } catch (err) {
      // swallow network errors to avoid disturbing UI
      console.warn('Webhook send failed', err)
      setMessages((m) => [...m, { id: createId(), role: 'bot', text: 'Network error', variant: 'plain' }])
    }
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    const t = setTimeout(() => setShowMain(true), 2000)
    return () => clearTimeout(t)
  }, [])

  // Show animated greeting once main screen is visible
  useEffect(() => {
    if (!showMain) return
    setMessages((prev) => (prev.length === 0
      ? [...prev, { id: createId(), role: 'bot', text: GREETING_TEXT, variant: 'plain' }]
      : prev))
  }, [showMain, GREETING_TEXT])

  if (!showMain) return <SilkBackground showCopy />

  const weeklyActivityData = [
    { day: 'S', value: 8 },
    { day: 'M', value: 12 },
    { day: 'T', value: 9 },
    { day: 'W', value: 4 },
    { day: 'T', value: 7 },
    { day: 'F', value: 14 },
    { day: 'S', value: 2 },
  ]

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-black rounded-none border-0 outline-none">
      {/* HUD removed */}
      {/* Lightweight background on main screen for smoothness */}
      <SilkBackground showCopy={false} mode="lite" />
      {/* Top bar: icons left/right and Plus centered on same baseline */}
      <div className="absolute inset-x-0 top-3 z-40 px-4 pointer-events-none">
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            aria-label="Menu"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl text-white hover:bg-white/10 active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={payPlus}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-[#3F2EA6] px-5 py-2 md:px-6 md:py-2.5 text-[#C9B8FF] font-semibold shadow-[0_2px_12px_rgba(63,46,166,0.45)]"
            aria-label="Перейти на Plus"
          >
            <Sparkles className="h-4 w-4 text-[#C9B8FF]/90" />
            <span className="text-sm md:text-base">{isPlus ? 'Plus активен' : 'Перейти на Plus'}</span>
          </button>
          <button
            type="button"
            aria-label="Chat Plus"
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl text-white hover:bg-white/10 active:scale-95"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </div>
      </div>
      {/* Activity card above input on the left */}
      {/* Временная навигация: держим смонтированной, переключаем видимость CSS-классами */}
      <div className={`absolute inset-0 z-30 flex items-center justify-center transition-all duration-500 ease-out ${showTimeline ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="w-full h-full md:scale-100 scale-[0.8] origin-center transition-transform duration-500 ease-out">
            <RadialOrbitalTimeline
              timelineData={
                planTimeline ?? [
                { id:1,title:'Planning',date:'Jan 2024',content:'Project planning and requirements gathering phase.',category:'Planning',icon:Calendar,relatedIds:[2],status:'completed',energy:100},
                { id:2,title:'Design',date:'Feb 2024',content:'UI/UX design and system architecture.',category:'Design',icon:FileText,relatedIds:[1,3],status:'completed',energy:90},
                { id:3,title:'Development',date:'Mar 2024',content:'Core features implementation and testing.',category:'Development',icon:Code,relatedIds:[2,4],status:'in-progress',energy:60},
                { id:4,title:'Testing',date:'Apr 2024',content:'User testing and bug fixes.',category:'Testing',icon:User,relatedIds:[3,5],status:'pending',energy:30},
                { id:5,title:'Release',date:'May 2024',content:'Final deployment and release.',category:'Release',icon:Clock,relatedIds:[4],status:'pending',energy:10},
                ]
              }
            />
          </div>
        </div>

      {/* Чат: всегда смонтирован, переключаем видимость */}
      <div className={`absolute z-20 inset-x-0 top-[60px] md:top-[72px] bottom-[160px] md:bottom-[176px] flex justify-center px-0 transition-opacity duration-300 ${showTimeline ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}>
          <div className="w-full h-full relative flex justify_center">
            {/* Лента сообщений ниже, отступ сохранён под глобальную линию */}
            <div
              ref={listRef}
              className={`h-full overflow-y-auto no-scrollbar touch-pan-y ${
                (messages[0]?.text === GREETING_TEXT ? 'pt-0' : 'pt-10')
              } pb-6 overscroll-contain w-full space-y-2`}
              style={{ WebkitOverflowScrolling: 'touch' as any }}
            >
          {messages.map((msg) => {
            const isPlain = msg.variant === 'plain' && msg.role === 'bot';
            return (
              <div key={msg.id} className={`flex ${isPlain ? 'justify-start' : (msg.role === 'user' ? 'justify-end' : 'justify-start')}`}>
                {isPlain ? (
                  <div className="max-w-[96%] md:max-w-[92%] mr-auto">
                    <BlurText
                      text={msg.text}
                      delay={60}
                      animateBy="words"
                      direction="top"
                      layout="block"
                      className="coach-text text-[15px] leading-[24px] tracking-[0.01em] text-white whitespace-pre-wrap break-words py-3 px-4"
                    />
                    {msg.text === GREETING_TEXT && (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => setMessages((m) => [...m, { id: createId(), role: 'bot', text: TPL_QUESTION, variant: 'plain' }])}
                          className="h-9 px-3 rounded-lg border border-white/20 bg-neutral-800 text-neutral-100 text-[13px] font-medium hover:bg-neutral-700 active:scale-95"
                        >
                          Вопрос
                        </button>
                        <button
                          onClick={() => setMessages((m) => [...m, { id: createId(), role: 'bot', text: TPL_TECHNIQUE, variant: 'plain' }])}
                          className="h-9 px-3 rounded-lg border border-white/20 bg-neutral-800 text-neutral-100 text-[13px] font-medium hover:bg-neutral-700 active:scale-95"
                        >
                          Техника
                        </button>
                        <button
                          onClick={() => setMessages((m) => [...m, { id: createId(), role: 'bot', text: TPL_PLAN, variant: 'plain' }])}
                          className="h-9 px-3 rounded-lg border border-white/20 bg-neutral-800 text-neutral-100 text-[13px] font-medium hover:bg-neutral-700 active:scale-95"
                        >
                          План
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <motion.div
                    className={`${msg.role === 'user' 
                      ? 'inline-block bg-[#2E2E2E] text-white rounded-[16px] max-w_[75%] px-3 py-2 mr-3'
                      : 'bg-white/10 text-white rounded-3xl max-w-[85%] px-4 py-3'} shadow-lg backdrop-blur-sm whitespace-pre-wrap break-words`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    style={{ overflow: 'hidden', backgroundColor: msg.role === 'user' ? '#2E2E2E' : undefined }}
                    {...(msg.role === 'user' ? { 'data-user-msg': 'true' } : {})}
                  >
                    <BlurText
                      text={msg.text}
                      delay={60}
                      animateBy="words"
                      direction="top"
                      layout="block"
                      className={`coach-text text-[15px] leading-[20px] tracking-[0.01em] ${msg.role === 'user' ? 'text-white' : 'text-white'} m-0 text-left`}
                    />
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>
        {/* Убран нижний градиент, чтобы не было "края" у текста */}
      </div>
      </div>

      {/* Нижняя панель: карточка слева до кнопки, справа кнопка; ниже инпут. Малый равный зазор. */}
      <div className="absolute inset-x-0 bottom-2 z-40 flex flex-col items-center gap-2 px-3 transition-all duration-500 ease-out">
        <div className="w-full max-w-[340px] md:max-w-[560px] mx-auto flex items-center justify-between">
          <div className="pointer-events-auto flex-1 min-w-0 mr-3">
            <ActivityChartCard className="max-w-none" title="Activity" totalValue="21h" data={weeklyActivityData} size="sm" density="dense40" chartHeightPx={56} />
          </div>
          <button
            type="button"
            aria-label="Plan"
            className="w-[44px] h-[36px] rounded-[10px] bg-[#007AFF] flex items-center justify-center active:scale-95"
            onClick={() => {
              const hasPlan = Array.isArray(planTimeline) && planTimeline.length > 0;
              if (!hasPlan) {
                setShowTimeline(false);
                setMessages((m) => [
                  ...m,
                  {
                    id: createId(),
                    role: 'bot',
                    text: 'Отлично, давай создадим для тебя план на день. Что хочешь потренировать?',
                    variant: 'plain',
                  },
                ]);
                return;
              }
              setShowTimeline((v) => !v);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </button>
        </div>
        <div className="w-full max-w-[340px] md:max-w-[560px] mx-auto">
        <OrbInput onSend={handleSend} />
        </div>
      </div>
    </div>
  )
}


