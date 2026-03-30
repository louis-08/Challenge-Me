import React, { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { resolveAvatarUrl } from './avatarUtils';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
}

const joinClasses = (...classes: Array<string | undefined>) =>
  classes.filter(Boolean).join(' ');

const getInitials = (name?: string) => {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Profilbild',
  name,
  className,
  imgClassName,
  fallbackClassName,
}) => {
  const resolvedSrc = resolveAvatarUrl(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  const initials = getInitials(name);

  return (
    <div
      className={joinClasses(
        'relative overflow-hidden rounded-full bg-slate-100',
        className
      )}
    >
      {resolvedSrc && !hasError ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className={joinClasses('h-full w-full object-cover object-center', imgClassName)}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={joinClasses(
            'flex h-full w-full items-center justify-center bg-slate-200 text-slate-500',
            fallbackClassName
          )}
          aria-label={alt}
          role="img"
        >
          {initials ? (
            <span className="text-[0.7em] font-bold uppercase">{initials}</span>
          ) : (
            <UserIcon className="h-[55%] w-[55%]" />
          )}
        </div>
      )}
    </div>
  );
};
