import Image from 'next/image';
import { JSX } from 'react/jsx-dev-runtime';

interface MainMawsterLogoProps {
  className?: string;
}

export function MawsterLogo(): JSX.Element {
  return (
    <Image
      src='/logos/main_logo.png'
      alt='Logo Mawster'
      width={48}
      height={48}
    />
  );
}
export default function MainMawsterLogo({ className = '' }: Readonly<MainMawsterLogoProps>) {
  return (
    <div
      className={`flex items-center gap-4 leading-none text-primary-foreground ${className}`}
      aria-label='Mawster Logo'
    >
      <MawsterLogo />
      <p className='text-xl font-semibold md:text-2xl'>Mawster</p>
    </div>
  );
}
