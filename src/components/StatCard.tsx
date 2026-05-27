import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: string | number;
    label: string;
    isUp?: boolean;
  };
  footer?: {
    label: string;
    value: string | number;
  };
  className?: string;
  key?: React.Key;
}

export const StatCard = ({ title, value, unit, trend, footer, className }: StatCardProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("dashboard-card flex flex-col justify-between min-h-[120px]", className)}
    >
      <div>
        <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">{title}</h3>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900">{value}</span>
          {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
        </div>
      </div>

      <div className="mt-3">
        {trend && trend.value !== 0 && trend.value !== '0' && trend.value !== '+0' && trend.value !== '-0' && (
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "text-[11px] font-bold",
              trend.isUp ? "text-emerald-600" : "text-rose-600"
            )}>
              {trend.isUp ? '↑' : '↓'} {trend.value}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{trend.label}</span>
          </div>
        )}
        {footer && (
          <div className="text-[11px] text-slate-400 font-medium">
            {footer.label} <span className="text-slate-600 font-semibold">{footer.value}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
