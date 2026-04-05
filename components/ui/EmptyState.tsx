import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
        <Icon size={24} className="text-text-3" />
      </div>
      <h3 className="font-semibold text-text text-[15px] mb-1">{title}</h3>
      <p className="text-sm text-text-3 max-w-xs mb-5">{description}</p>
      {action}
    </div>
  );
}
