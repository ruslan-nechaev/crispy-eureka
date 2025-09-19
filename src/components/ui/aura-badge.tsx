import React, { useEffect, useMemo, useRef, useState } from 'react'

type AuraBadgeProps = {
  value: number
  className?: string
  variant?: 'fixed' | 'inline'
}

function formatAuraNumber(raw: number): string {
  if (raw >= 10000) {
    const k = raw / 1000
    const s = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)
    return `${s}k`
  }
  return raw.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

export const AuraBadge: React.FC<AuraBadgeProps> = ({ value, className, variant = 'fixed' }) => {
  // Track increases to pulse the frame
  const [display, setDisplay] = useState<number>(value)
  const prevRef = useRef<number>(value)
  const [pulse, setPulse] = useState<boolean>(false)
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (value !== display) setDisplay(value)
    if (!reducedMotion && value > prevRef.current) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 280)
      prevRef.current = value
      return () => clearTimeout(t)
    }
    prevRef.current = value
  }, [value, display, reducedMotion])

  const formatted = useMemo(() => formatAuraNumber(display), [display])

  const isFixed = variant === 'fixed'
  return (
    <div
      className={`${isFixed ? 'fixed top-[10px] left-[12px] z-[60] pointer-events-none' : 'relative'} inline-flex items-center ${className ?? ''}`}
      style={{ gap: 10, height: isFixed ? undefined : 48, padding: isFixed ? undefined : '0 12px', borderRadius: isFixed ? undefined : 12 }}
      aria-live="polite"
      role="status"
    >
      {/* Dark overlay removed by request */}
      {/* Left label: Aura */}
      <span
        className="select-none"
        style={{
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: 600,
          lineHeight: '22px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Aura
      </span>

      {/* Right framed number */}
      <span
        className={`select-none inline-flex items-center justify-center px-3 py-[6px] rounded-[8px] border`}
        style={{
          borderColor: '#FFD700',
          borderWidth: 2,
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: 600,
          lineHeight: '22px',
          fontFeatureSettings: '"tnum" 1, "lnum" 1',
          boxShadow: pulse ? '0 0 12px rgba(255,215,0,0.55)' : 'none',
          transition: 'box-shadow 200ms ease, transform 200ms ease',
          transform: pulse ? 'scale(1.10)' : 'scale(1)',
          position: 'relative',
          zIndex: 1,
          background: 'transparent'
        }}
      >
        {formatted}
      </span>

      {/* Subtle aura glow on increase */}
      {!isFixed && pulse && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-[14px]"
          style={{ boxShadow: '0 0 18px rgba(255,215,0,0.35)' }}
        />
      )}
    </div>
  )
}

export default AuraBadge


