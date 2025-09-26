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
  const [isWebApp, setIsWebApp] = useState<boolean>(false)
  const autoPayRef = useRef<boolean>(false)
  const [aura, setAura] = useState<number>(0)
  const [completedIds, setCompletedIds] = useState<number[]>([])
  const [weekly, setWeekly] = useState<number[]>([0,0,0,0,0,0,0])

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

  // Helper: надёжнее определяем WebApp контекст
  const isInWebApp = (): boolean => {
    try {
      const tg: any = (window as any)?.Telegram?.WebApp
      if (!tg) return false
      if (tg.initData && typeof tg.initData === 'string' && tg.initData.length > 0) return true
      if (tg.initDataUnsafe?.user) return true
      return false
    } catch { return false }
  }

  // Restore state once on mount
  useEffect(() => {
    userIdRef.current = getTelegramUserId()
    try {
      const tg: any = (window as any)?.Telegram?.WebApp
      try { tg?.ready && tg.ready(); tg?.expand && tg.expand(); } catch {}
      setIsWebApp(isInWebApp())
      const key = `user_state_${userIdRef.current}`
      const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.messages)) setMessages(parsed.messages as ChatMessage[])
        if (Array.isArray(parsed?.planTimeline)) setPlanTimeline(parsed.planTimeline as any[])
        if (typeof parsed?.showTimeline === 'boolean') setShowTimeline(Boolean(parsed.showTimeline))
        if (typeof parsed?.isPlus === 'boolean') setIsPlus(Boolean(parsed.isPlus))
        if (typeof parsed?.aura === 'number') setAura(Number(parsed.aura) || 0)
        if (Array.isArray(parsed?.completedIds)) setCompletedIds(parsed.completedIds.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n)))
        if (Array.isArray(parsed?.weekly) && parsed.weekly.length === 7) setWeekly(parsed.weekly.map((n: any) => Number(n) || 0))
      }
    } catch (err) {
      console.warn('State restore failed', err)
    }
  }, [])

  // Автозапуск оплаты при старте из deep-link ?startapp=plus — переносим ниже определения payPlus (чтобы избежать TDZ)

  // Persist state after every interaction/update
  useEffect(() => {
    try {
      const key = `user_state_${userIdRef.current}`
      const toSave = {
        messages,
        planTimeline,
        showTimeline,
        isPlus,
        aura,
        completedIds,
        weekly,
        savedAt: Date.now(),
      }
      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(toSave))
    } catch (err) {
      // Ignore storage quota / private mode errors to avoid breaking UI
    }
  }, [messages, planTimeline, showTimeline, isPlus, aura, completedIds, weekly])

  // Helper to persist current snapshot immediately (before payment)
  const persistNow = useCallback(() => {
    try {
      const key = `user_state_${userIdRef.current}`
      const toSave = {
        messages,
        planTimeline,
        showTimeline,
        isPlus,
        aura,
        completedIds,
        weekly,
        savedAt: Date.now(),
      }
      if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(toSave))
    } catch {}
  }, [messages, planTimeline, showTimeline, isPlus, aura, completedIds, weekly])

  const handleCompletePlan = useCallback((id: number) => {
    setCompletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setAura((prev) => prev + 10)
    // increment today's weekly bar by +10
    setWeekly((prev) => {
      const idx = new Date().getDay() // 0..6, Sunday first
      const next = [...prev]
      next[idx] = (next[idx] || 0) + 10
      return next
    })
    // update plan status if present
    setPlanTimeline((prev) => {
      if (!prev) return prev
      return prev.map((it) => (it.id === id ? { ...it, status: 'completed' } : it)) as any
    })
  }, [])

  // Deep link into Telegram WebApp if пользователь не в контексте WebApp
  const BOT_USERNAME = (import.meta as any)?.env?.VITE_TG_BOT_USERNAME || 'F1tA1Bot'
  const openInTelegramWebApp = useCallback(() => {
    const tgDeep = `tg://resolve?domain=${BOT_USERNAME}&startapp=plus`
    const httpsDeep = `https://t.me/${BOT_USERNAME}?startapp=plus`
    try { window.location.href = tgDeep } catch {}
    setTimeout(() => { try { window.location.href = httpsDeep } catch {} }, 200)
  }, [BOT_USERNAME])

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
      const tgRoot: any = (window as any)?.Telegram
      persistNow()
      const link = await createPaymentLink()
      if (!link) throw new Error('Empty invoice link')
      // Пытаемся открыть строго через openInvoice (встроенная модалка)
      if (tg?.openInvoice) {
        const opened = tg.openInvoice(link, (status: string) => {
          if (status === 'paid') {
            setIsPlus(true)
            try { tg.showPopup && tg.showPopup({ title: 'Оплата', message: 'Оплата успешно прошла! Теперь вы на Plus.', buttons: [{ type: 'ok' }] }) } catch {}
          } else if (status === 'failed') {
            try { tg.showPopup && tg.showPopup({ title: 'Оплата', message: 'Ошибка оплаты. Попробуйте снова.', buttons: [{ type: 'ok' }] }) } catch {}
          } else if (status === 'cancelled') {
            // silently ignore
          }
        })
        if ((opened === false || typeof opened === 'undefined')) {
          // Fallback внутри Telegram: откроем ссылку счета в контейнере TG
          const attach = link.includes('?') ? '&' : '?'
          if (typeof tg.openTelegramLink === 'function') tg.openTelegramLink(`${link}${attach}startattach=pay`)
          else if (tgRoot?.openTelegramLink) tgRoot.openTelegramLink(`${link}${attach}startattach=pay`)
          else window.location.href = link
        }
      } else {
        // Нет openInvoice — откроем ссылку счета в Telegram или, в крайнем случае, прямой переход
        const attach = link.includes('?') ? '&' : '?'
        if (tg && typeof tg.openTelegramLink === 'function') tg.openTelegramLink(`${link}${attach}startattach=pay`)
        else if (tgRoot?.openTelegramLink) tgRoot.openTelegramLink(`${link}${attach}startattach=pay`)
        else window.location.href = link
      }
    } catch (e) {
      alert('Не удалось открыть оплату. Попробуйте позже.')
    }
  }, [createPaymentLink, persistNow])

  // Автозапуск оплаты при старте из deep-link ?startapp=plus (после объявления payPlus)
  useEffect(() => {
    try {
      const tg: any = (window as any)?.Telegram?.WebApp
      const startParam: string | undefined = tg?.initDataUnsafe?.start_param
      if (isWebApp && !isPlus && !autoPayRef.current && (startParam === 'plus')) {
        autoPayRef.current = true
        setTimeout(() => { try { payPlus() } catch {} }, 150)
      }
    } catch {}
  }, [isWebApp, isPlus, payPlus])

  // Subscribe to invoiceClosed to reliably capture the final status
  useEffect(() => {
    const tg: any = (typeof window !== 'undefined') ? (window as any).Telegram?.WebApp : undefined
    if (!tg?.onEvent) return
    const handler = (data: any) => {
      try {
        if (data?.status === 'paid') {
          setIsPlus(true)
        }
      } catch {}
    }
    tg.onEvent('invoiceClosed', handler)
    // Also handle 'themeChanged' or other events if needed later
    return () => {
      try { tg.offEvent && tg.offEvent('invoiceClosed', handler) } catch {}
    }
  }, [])

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

  // Рендерим всегда основной UI, а лоадер кладём как оверлей, чтобы избежать "чёрного экрана"

  const weeklyActivityData = useMemo(() => {
    const labels = ['S','M','T','W','T','F','S']
    return labels.map((d, i) => ({ day: d, value: weekly[i] || 0 }))
  }, [weekly])

  const weeklySum = useMemo(() => weekly.reduce((a, b) => a + (b || 0), 0), [weekly])

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-black rounded-none border-0 outline-none">
      {!showMain && (
        <div className="absolute inset-0 z-50">
          <SilkBackground showCopy />
        </div>
      )}
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
              onComplete={handleCompletePlan}
              completedIds={completedIds}
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
          <div className="pointer-events-auto flex-1 min-w-0 mr-3 transform scale-y-[0.8] origin-bottom">
            <ActivityChartCard
              className="max-w-none"
              title="Aura"
              totalValue={`${aura}`}
              data={weeklyActivityData}
              size="sm"
              density="dense40"
              chartHeightPx={56}
              deltaText={`+${weeklySum} за\nнеделю`}
            />
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


