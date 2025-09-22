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
}) => {
  const [selectedRange, setSelectedRange] = React.useState(dropdownOptions[0] || "");

  const isCompact = variant === 'compact60';
  const isHeight3x = variant === 'height3x';
  const isSmall = size === 'sm';

  const maxValue = React.useMemo(() => {
    return data.reduce((max, item) => (item.value > max ? item.value : max), 0);
  }, [data]);

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
      <CardHeader className={cn(isCompact ? 'p-3' : (isSmall ? 'p-4' : undefined))}>
        <div className="flex items-center justify-between">
          <CardTitle id="activity-card-title">{title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm" aria-haspopup="true">
                {selectedRange}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {dropdownOptions.map((option) => (
                <DropdownMenuItem key={option} onSelect={() => setSelectedRange(option)}>
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className={cn(isCompact ? 'p-3 pt-0' : (isSmall ? 'p-4 pt-0' : undefined))}>
        <div className={cn("flex flex-col sm:flex-row items-start sm:items-end", isCompact ? 'gap-3' : (isSmall ? 'gap-3' : 'gap-4'))}>
          <div className="flex flex-col">
            <p className={cn(isCompact ? 'text-3xl' : (isSmall ? 'text-3xl sm:text-4xl' : 'text-5xl'), 'font-bold tracking-tighter text-white')}>{totalValue}</p>
            <CardDescription className="flex items-center gap-1 text-neutral-400">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              +12% from last week
            </CardDescription>
          </div>

          <motion.div
            key={selectedRange}
            className={cn(
              "flex w-full items-end justify-between gap-2",
              !chartHeightPx && (isCompact ? 'h-12' : (isSmall ? 'h-14' : (isHeight3x ? 'h-[132px]' : 'h-28')))
            )}
            style={chartHeightPx ? { height: chartHeightPx } : undefined}
            variants={chartVariants}
            initial="hidden"
            animate="visible"
            aria-label="Activity chart"
          >
            {data.map((item, index) => (
              <div key={index} className="flex h-full w-full flex-col items-center justify-end gap-2" role="presentation">
                <motion.div
                  className="w-full rounded-md bg-neutral-300"
                  style={{ height: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%` }}
                  variants={barVariants}
                  aria-label={`${item.day}: ${item.value} hours`}
                />
                <span className="text-xs text-neutral-400">{item.day}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityChartCard;


