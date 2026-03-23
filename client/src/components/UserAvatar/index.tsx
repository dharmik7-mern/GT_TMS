import React from 'react';
import { cn, getInitials, getAvatarColor } from '../../utils/helpers';

interface UserAvatarProps {
  name: string;
  avatar?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  className?: string;
  showTooltip?: boolean;
  isOnline?: boolean;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
  xl: 'w-12 h-12 text-lg',
};

const STATUS_SIZE = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatar,
  size = 'md',
  color,
  className,
  isOnline,
}) => {
  const bgColor = color || getAvatarColor(name);
  const initials = getInitials(name);

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className={cn(SIZE_MAP[size], 'rounded-full object-cover')}
        />
      ) : (
        <div
          className={cn(
            SIZE_MAP[size],
            'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0'
          )}
          style={{ backgroundColor: bgColor }}
          title={name}
        >
          {initials}
        </div>
      )}
      {isOnline !== undefined && (
        <span
          className={cn(
            STATUS_SIZE[size],
            'absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-surface-900',
            isOnline ? 'bg-emerald-500' : 'bg-surface-400'
          )}
        />
      )}
    </div>
  );
};

interface AvatarGroupProps {
  users: Array<{ id: string; name: string; avatar?: string; color?: string }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  users,
  max = 4,
  size = 'sm',
  className,
}) => {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className={cn('flex items-center', className)}>
      {visible.map((user, i) => (
        <div
          key={user.id}
          className={cn('ring-2 ring-white dark:ring-surface-900 rounded-full', i !== 0 && '-ml-2')}
          title={user.name}
        >
          <UserAvatar
            name={user.name}
            avatar={user.avatar}
            color={user.color}
            size={size}
          />
        </div>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            '-ml-2 ring-2 ring-white dark:ring-surface-900 rounded-full',
            'bg-surface-200 dark:bg-surface-700 flex items-center justify-center',
            'text-xs font-medium text-surface-600 dark:text-surface-300',
            size === 'xs' ? 'w-5 h-5 text-[9px]' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-8 h-8 text-sm'
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
