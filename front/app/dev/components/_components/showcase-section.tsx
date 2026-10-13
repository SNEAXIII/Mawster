import type { ReactNode } from 'react'

/** One titled block of variants on a showcase page. */
export function Section({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className='flex flex-col gap-2'>
      <h2 className='text-sm font-semibold text-muted-foreground'>{title}</h2>
      <div className='flex flex-wrap items-end gap-4 rounded-md border bg-card p-4'>{children}</div>
    </section>
  )
}

/** A single variant with its label underneath. */
export function Variant({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className='flex flex-col items-start gap-1.5'>
      {children}
      <span className='text-[10px] leading-none text-muted-foreground'>{label}</span>
    </div>
  )
}
