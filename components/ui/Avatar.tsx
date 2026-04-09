'use client';

import Image from 'next/image';
import { getAvatarColor, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AvatarProps {
  name: string;
  photoURL?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizes = {
  sm: { container: 'w-8 h-8', text: 'text-xs' },
  md: { container: 'w-10 h-10', text: 'text-sm' },
  lg: { container: 'w-12 h-12', text: 'text-base' },
  xl: { container: 'w-16 h-16', text: 'text-xl' },
};

export function Avatar({ name, photoURL, size = 'md', className }: AvatarProps) {
  const { container, text } = sizes[size];
  const color = getAvatarColor(name);
  const initials = getInitials(name);

  if (photoURL) {
    return (
      <div className={cn('rounded-full overflow-hidden flex-shrink-0', container, className)}>
        <Image
          src={photoURL}
          alt={name}
          width={64}
          height={64}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center flex-shrink-0 font-bold text-white',
        container,
        text,
        className
      )}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
