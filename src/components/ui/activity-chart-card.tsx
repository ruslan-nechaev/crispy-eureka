import * as React from "react";
import { motion } from "framer-motion";
import { ChevronDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/shadcn/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/shadcn/button";

interface ActivityDataPoint {
  day: string;
  value: number;
}

interface ActivityChartCardProps {
  title?: string;
  totalValue: string;
  data: ActivityDataPoint[];
  className?: string;
  dropdownOptions?: string[];
  variant?: 'default' | 'compact60' | 'height3x';
  chartHeightPx?: number;
  size?: 'md' | 'sm';
  density?: 'normal' | 'dense40';
}

export const ActivityChartCard: React.FC<ActivityChartCardProps> = ({
  title = "Activity",
  totalValue,
  data,
  className,
  dropdownOptions = ["Weekly", "Monthly", "Yearly"],
  variant = 'default',
  chartHeightPx,
  size = 'md',
  density = 'normal',
}) => {
  const [selectedRange, setSelectedRange] = React.useState(dropdownOptions[0] || "");

  const isCompact = variant === 'compact60';
  const isHeight3x = variant === 'height3x';
  const isSmall = size === 'sm';
  const minBarPx = 16;

  const displayData = React.useMemo(() => {
    const factor = selectedRange === 'Monthly' ? 4 : selectedRange === 'Yearly' ? 52 : 1;
    return data.map((d) => ({ ...d, value: d.value * factor }));
  }, [data, selectedRange]);

  const maxValue = React.useMemo(() => {
    return displayData.reduce((max, item) => (item.value > max ? item.value : max), 0);
  }, [displayData]);

  const chartVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  } as const;

  const barVariants = {
    hidden: { scaleY: 0, opacity: 0, transformOrigin: "bottom" },
    visible: {
      scaleY: 1,
      opacity: 1,
      transformOrigin: "bottom",
      transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
    },
  } as const;

  return (
    <Card
      className={cn(
        "w-full rounded-2xl border border-white/15 bg-neutral-900/70 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur",
        className
      )}
      aria-labelledby="activity-card-title"
    >
      <CardHeader className={cn(
        isCompact ? 'p-3' : (isSmall ? (density==='dense40' ? 'px-3 py-1.5' : 'p-4') : undefined)
      )}>
        <div className="flex items-center justify-between">
          <CardTitle
            id="activity-card-title"
            className={cn(
              isSmall && density==='dense40' ? 'text-lg' : undefined
            )}
          >
            {title}
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "flex items-center gap-1 text-sm",
                  isSmall && density==='dense40' ? 'h-7 px-2 text-xs' : undefined
                )}
                aria-haspopup="true"
              >
                {selectedRange}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6 as any}
              className={cn(
                'rounded-xl border border-white/15 bg-neutral-900 text-white shadow-xl',
                density==='dense40'
                  ? 'min-w-[7rem] text-[11px] py-1'
                  : 'min-w-[9rem] text-xs sm:text-sm py-1.5'
              )}
            >
              {dropdownOptions.map((option) => (
                <DropdownMenuItem
                  key={option}
                  className={cn(
                    'cursor-pointer rounded-md px-2 hover:bg-white/10',
                    density==='dense40' ? 'py-1' : 'py-1.5',
                    selectedRange === option ? 'bg-white/10' : undefined
                  )}
                  onSelect={() => setSelectedRange(option)}
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className={cn(
        isCompact ? 'p-3 pt-0' : (isSmall ? (density==='dense40' ? 'px-3 pb-3 pt-1' : 'p-4 pt-0') : undefined)
      )}>
        <div className={cn('flex flex-row items-end', isCompact ? 'gap-3' : (isSmall ? (density==='dense40' ? 'gap-2.5' : 'gap-3') : 'gap-4'))}>
          <div className={cn('flex flex-col', isSmall ? 'basis-1/5 min-w-[100px]' : undefined)}>
            <p
              className={cn(
                isCompact
                  ? 'text-3xl'
                  : (isSmall ? (density==='dense40' ? 'text-2xl' : 'text-3xl sm:text-4xl') : 'text-5xl'),
                'font-bold tracking-tighter text-white')}
            >
              {totalValue}
            </p>
            <CardDescription
              className={cn(
                'text-neutral-400 leading-tight relative',
                density==='dense40' ? 'text-xs pl-5' : 'text-sm pl-6'
              )}
            >
              <TrendingUp
                className={cn(
                  'absolute left-0 top-1/2 -translate-y-1/2 text-emerald-400',
                  density==='dense40' ? 'h-3.5 w-3.5' : 'h-4 w-4'
                )}
              />
              <span className="block">+12% from</span>
              <span className="block">last week</span>
            </CardDescription>
          </div>

          <div className={cn(isSmall ? 'basis-4/5 flex-1' : 'flex-1')}>
          <motion.div
            key={selectedRange}
            className={cn(
              "flex w-full items-end justify-between gap-3",
              !chartHeightPx && (isCompact ? 'h-12' : (isSmall ? 'h-14' : (isHeight3x ? 'h-[132px]' : 'h-28')))
            )}
            style={chartHeightPx ? { height: chartHeightPx } : undefined}
            variants={chartVariants}
            initial="hidden"
            animate="visible"
            aria-label="Activity chart"
          >
            {displayData.map((item, index) => {
              const ratio = maxValue > 0 ? item.value / maxValue : 0;
              const pxHeight = chartHeightPx ? Math.max(minBarPx, Math.round(ratio * chartHeightPx)) : undefined;
              return (
              <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2" role="presentation">
                <motion.div
                  className="w-full max-w-[30px] sm:max-w-[32px] md:max-w-[36px] rounded-md bg-neutral-300"
                  style={pxHeight !== undefined ? { height: pxHeight } : { height: `${maxValue > 0 ? ratio * 100 : 0}%` }}
                  variants={barVariants}
                  aria-label={`${item.day}: ${item.value} hours`}
                />
                <span className="text-[10px] sm:text-xs text-neutral-400">{item.day}</span>
              </div>
              )
            })}
          </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityChartCard;


