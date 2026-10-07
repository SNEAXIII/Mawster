import Image from 'next/image'
import type { JSX } from 'react/jsx-dev-runtime'

interface MainMawsterLogoProps {
  className?: string
}

export function MawsterLogo(): JSX.Element {
  return (
    <Image
      src='/static/logos/main_logo.webp'
      unoptimized
      alt='Logo Mawster'
      width={40}
      height={40}
    />
  )
}
export default function MainMawsterLogo({ className = '' }: Readonly<MainMawsterLogoProps>) {
  return (
    <div
      className={`flex items-center gap-2 leading-none text-primary-foreground ${className}`}
      aria-label='Mawster Logo'
    >
      <MawsterLogo />
      <p className='text-xl font-semibold md:text-xl'>Mawster</p>
    </div>
  )
}
