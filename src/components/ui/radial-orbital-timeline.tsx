"use client";
import { useState, useEffect, useRef } from "react";
import type { ElementType } from "react";
import { ChevronRight, Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/shadcn/card";
import GitHubButton from "@/components/ui/button-1";

interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  onExpandedChange?: (expanded: boolean) => void;
  collapseAllSignal?: number;
  onComplete?: (id: number) => void;
  completedIds?: number[];
}

export default function RadialOrbitalTimeline({ timelineData, onExpandedChange, collapseAllSignal, onComplete, completedIds }: RadialOrbitalTimelineProps) {
  const ORBIT_RADIUS = 115;

  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset] = useState<{ x: number; y: number }>({ x: 0, y: -60 });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const angleRef = useRef<number>(0);
  const rafRef = useRef<number>();
  const lastTsRef = useRef<number>(0);
  const alignRafRef = useRef<number>();

  const AnimatedMount: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    }, []);
    return (
      <div className={`${visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95"} transition-all duration-300 ease-out ${className || ""}`}>
        {children}
      </div>
    );
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-expanded-card="true"]')) return;
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
  };

  const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const normalizeAngle = (a: number) => ((a % 360) + 360) % 360;

  const animateToAngle = (targetAngle: number, durationMs: number = 500): Promise<void> => {
    return new Promise((resolve) => {
      if (alignRafRef.current) cancelAnimationFrame(alignRafRef.current);
      const orbitEl = orbitRef.current;
      if (!orbitEl) {
        resolve();
        return;
      }
      const startAngle = normalizeAngle(angleRef.current);
      const endAngle = normalizeAngle(targetAngle);
      let delta = ((endAngle - startAngle + 540) % 360) - 180;
      const startTime = performance.now();
      const step = () => {
        const now = performance.now();
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = easeInOutCubic(t);
        const current = normalizeAngle(startAngle + delta * eased);
        angleRef.current = current;
        // Apply transform directly to avoid React re-renders
        orbitEl.style.transform = `translate(${centerOffset.x}px, ${centerOffset.y}px) rotate(${current}deg)`;
        // Update CSS variables so children can counter-rotate and remain upright
        orbitEl.style.setProperty('--aura-rot', `${current}deg`);
        orbitEl.style.setProperty('--aura-rot-neg', `${-current}deg`);
        if (t < 1) {
          alignRafRef.current = requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      alignRafRef.current = requestAnimationFrame(step);
    });
  };

  const openItem = async (id: number) => {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
    const nextPulse: Record<number, boolean> = {};
    relatedItems.forEach((rid) => (nextPulse[rid] = true));
    setPulseEffect(nextPulse);

    const nodeIndex = timelineData.findIndex((i) => i.id === id);
    const total = timelineData.length;
    const targetAngle = 270 - (nodeIndex / total) * 360;
    await animateToAngle(targetAngle, 500);
    setExpandedItems((prev) => ({ ...prev, [id]: true }));
  };

  const closeItem = (id: number) => {
    setExpandedItems((prev) => ({ ...prev, [id]: false }));
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
  };

  const toggleItem = (id: number) => {
    if (expandedItems[id]) closeItem(id);
    else {
      setExpandedItems({});
      openItem(id);
    }
  };

  const goToNext = () => {
    if (activeNodeId == null) return;
    const index = timelineData.findIndex((i) => i.id === activeNodeId);
    const nextIndex = (index + 1) % timelineData.length;
    setExpandedItems({});
    openItem(timelineData[nextIndex].id);
  };

  useEffect(() => {
    if (!onExpandedChange) return;
    onExpandedChange(Object.values(expandedItems).some(Boolean));
  }, [expandedItems, onExpandedChange]);

  useEffect(() => {
    if (collapseAllSignal == null) return;
    setExpandedItems({});
    setActiveNodeId(null);
    setPulseEffect({});
    setAutoRotate(true);
  }, [collapseAllSignal]);

  // rAF-driven rotation that also sets CSS variables for counter-rotation
  useEffect(() => {
    const el = orbitRef.current;
    if (!el) return;
    let raf: number | undefined;
    const speedDegPerSec = 12;
    const step = (ts: number) => {
      if (!autoRotate) return;
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      angleRef.current = (angleRef.current + speedDegPerSec * dt) % 360;
      const a = angleRef.current;
      el.style.transform = `translate(${centerOffset.x}px, ${centerOffset.y}px) rotate(${a}deg)`;
      el.style.setProperty('--aura-rot', `${a}deg`);
      el.style.setProperty('--aura-rot-neg', `${-a}deg`);
      raf = requestAnimationFrame(step);
    };
    if (autoRotate) {
      raf = requestAnimationFrame(step);
    } else {
      const a = angleRef.current;
      el.style.transform = `translate(${centerOffset.x}px, ${centerOffset.y}px) rotate(${a}deg)`;
      el.style.setProperty('--aura-rot', `${a}deg`);
      el.style.setProperty('--aura-rot-neg', `${-a}deg`);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      lastTsRef.current = 0;
    };
  }, [autoRotate, centerOffset.x, centerOffset.y]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360) % 360; // base angle; container rotates via CSS
    const rad = (angle * Math.PI) / 180;
    const x = ORBIT_RADIUS * Math.cos(rad);
    const y = ORBIT_RADIUS * Math.sin(rad);
    const zIndex = Math.round(100 + 50 * Math.cos(rad));
    return { x, y, angle, zIndex };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const current = timelineData.find((i) => i.id === itemId);
    return current ? current.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-visible" ref={containerRef} onClick={handleContainerClick}>
      <style>{`@keyframes aura-rotate { from { transform: translate(${centerOffset.x}px, ${centerOffset.y}px) rotate(0deg) } to { transform: translate(${centerOffset.x}px, ${centerOffset.y}px) rotate(360deg) } }`}</style>
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
        <div className="absolute w-full h-full flex items-center justify-center" ref={orbitRef} style={{ perspective: "1000px", transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)` }}>
          {/* Center orb with waves */}
          <div className="absolute z-10 w-16 h-16 rounded-full bg-white/85 animate-pulse flex items-center justify-center shadow-[0_0_22px_rgba(255,255,255,0.55)]" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="absolute w-20 h-20 rounded-full border border-white/70 animate-ping opacity-80"></div>
            <div className="absolute w-24 h-24 rounded-full border border-white/40 animate-ping opacity-40" style={{ animationDelay: "0.6s" }}></div>
            <div className="w-8 h-8 rounded-full bg-white backdrop-blur-md shadow-[0_0_12px_rgba(255,255,255,0.8)]"></div>
          </div>

          {/* Orbit ring */}
          <div className="absolute rounded-full border" style={{ width: ORBIT_RADIUS * 2, height: ORBIT_RADIUS * 2, borderColor: 'rgba(255,255,255,0.5)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}></div>

          {timelineData.map((item, index) => {
            const pos = calculateNodePosition(index, timelineData.length);
            const isExpanded = !!expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const Icon = item.icon;
            // Place node's center exactly on the orbit by translating to point and then centering itself
            const nodeStyle = {
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(var(--aura-rot-neg, 0deg))`,
              zIndex: isExpanded ? 200 : pos.zIndex,
              willChange: 'transform',
            } as React.CSSProperties;
            const completed = item.status === "completed" || (completedIds?.includes(item.id) ?? false);
            return (
              <div key={item.id} ref={(el) => (nodeRefs.current[item.id] = el)} className="absolute cursor-pointer" style={nodeStyle} onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}>
                <div className={`absolute rounded-full -inset-1`} style={{ background: completed ? `radial-gradient(circle, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0) 70%)` : `radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)`, width: `${item.energy * 0.5 + 40}px`, height: `${item.energy * 0.5 + 40}px`, left: `-${(item.energy * 0.5 + 40 - 40) / 2}px`, top: `-${(item.energy * 0.5 + 40 - 40) / 2}px` }}></div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${completed ? "bg-emerald-500 text-white border-emerald-300 shadow-lg shadow-emerald-400/30" : isExpanded ? "bg-white text-black border-white shadow-lg shadow-white/30" : isRelated ? "bg-white/50 text-black border-white animate-pulse" : "bg-black text-white border-white"} border-2 transition-transform duration-300 transform ${isExpanded ? "scale-150" : ""}`}>
                  {completed ? (
                    <Check size={20} />
                  ) : (
                    (item as any).emoji ? (
                      <span className="text-[20px] leading-none">{(item as any).emoji}</span>
                    ) : (
                      <Icon size={20} />
                    )
                  )}
                </div>
                <div className={`absolute top-14 left-1/2 -translate-x-1/2 text-center text-xs font-semibold tracking-wider text-white`}>{item.title}</div>

                {isExpanded && (
                  <AnimatedMount className="absolute top-20 left-1/2 -translate-x-1/2">
                    <Card data-expanded-card="true" className="relative w-[20rem] md:w-[30rem] bg-black/90 backdrop-blur-lg border-white/30 shadow-xl shadow-white/10 overflow-visible rounded-[32px]">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-white/50"></div>
                      <CardHeader className="pb-0"></CardHeader>
                      <CardContent className="text-xs text-white/80 pb-2 flex flex-col min-h-[300px] md:min-h-[280px]">
                        <div className="mb-5">
                          <div className="mx-1 md:mx-2 text-center text-[22px] md:text-[26px] font-extrabold text-white leading-tight w-full break-words hyphens-auto tracking-[0.01em]">
                            {item.title}
                          </div>
                          <div className="mt-2 flex items-center justify-center gap-6 md:gap-10">
                            <span className="text-white border border-white/60 rounded-xl px-3 py-1">
                              <span className="text-[22px] md:text-[24px] font-extrabold">{(item as any).sets}</span>
                              <span className="ml-2 text-[14px] md:text-[15px] text-white/80">подходы</span>
                            </span>
                            <span className="text-white border border-white/60 rounded-xl px-3 py-1">
                              <span className="text-[22px] md:text-[24px] font-extrabold">{(item as any).reps}</span>
                              <span className="ml-2 text-[14px] md:text-[15px] text-white/80">повторы</span>
                            </span>
                          </div>
                        </div>

                        {/* 2x2 action buttons */}
                        <div className="mt-auto mb-2 px-2 grid grid-cols-2 gap-3 w-full">
                          <div className="flex flex-col gap-3">
                            <button className="h-11 md:h-12 w-full rounded-xl bg-cyan-400 text-white font-semibold text-[16px] md:text-[18px] leading-none px-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-cyan-300 active:translate-y-[1px]">Упростить</button>
                            <button className="h-11 md:h-12 w-full rounded-xl bg-cyan-400 text-white font-semibold text-[16px] md:text-[18px] leading-none px-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-cyan-300 active:translate-y-[1px]">Заменить</button>
                          </div>
                          <div className="flex flex-col gap-3">
                            <button className="h-11 md:h-12 w-full rounded-xl bg-cyan-400 text-white font-semibold text-[16px] md:text-[18px] leading-none px-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-cyan-300 active:translate-y-[1px]">Усложнить</button>
                            <button className="h-11 md:h-12 w-full rounded-xl bg-cyan-400 text-white font-semibold text-[16px] md:text-[18px] leading-none px-4 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:bg-cyan-300 active:translate-y-[1px]">Техника</button>
                          </div>
                      </div>

                        <div className="mt-1 mb-[2px] px-1 flex justify-center w-full">
                          {completed ? (
                            <button className="w-full h-16 md:h-18 rounded-2xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2" type="button" aria-label="Выполнено">
                              <Check className="h-5 w-5" /> Выполнено
                            </button>
                          ) : (
                            <GitHubButton
                              autoAnimate
                              label="+10 Aura"
                              className="w-full h-16 md:h-18 rounded-2xl overflow-hidden"
                              onClick={() => {
                                try { (document.activeElement as HTMLElement)?.blur?.() } catch {}
                                onComplete?.(item.id)
                              }}
                            />
                          )}
                        </div>

                        <button onClick={(e) => { e.stopPropagation(); goToNext(); }} className="absolute -bottom-4 -right-4 h-10 w-10 rounded-full bg-black/80 border border-white/10 shadow-[0_6px_18px_rgba(0,0,0,0.7)] backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70" aria-label="Next card">
                          <ChevronRight size={16} strokeWidth={2.6} className="text-white/85" />
                        </button>
                    </CardContent>
                  </Card>
                  </AnimatedMount>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}














