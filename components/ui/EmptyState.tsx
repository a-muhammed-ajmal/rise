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
      <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
        <Icon size={28} className="text-text-3" />
      </div>
      <h3 className="font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-3 max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}
