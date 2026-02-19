import Image from 'next/image';

interface MainMawsterLogoProps {
  className?: string;
}

export default function MainMawsterLogo({ className = '' }: MainMawsterLogoProps) {
  return (
    <div
      className={`flex items-center gap-4 leading-none text-white ${className}`}
      aria-label='Mawster Logo'
    >
      <Image
        src='/logos/main_logo.png'
        alt='Logo Mawster'
        width={48}
        height={48}
      />
      <p className='text-xl font-semibold md:text-2xl'>Mawster</p>
    </div>
  );
}
