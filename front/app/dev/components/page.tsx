import Link from 'next/link'
import { SHOWCASE_GROUPS, SHOWCASES } from './_showcases/registry'

/** Dev-only hub: every showcase, grouped. Not linked from the app. */
export default function ComponentsHubPage() {
  return (
    <>
      <header>
        <h1 className='text-xl font-semibold'>Components</h1>
        <p className='text-sm text-muted-foreground'>
          Fixed mock data, every variant. Switch the look in the toolbar.
        </p>
      </header>

      {SHOWCASE_GROUPS.map((group) => (
        <section
          key={group}
          className='flex flex-col gap-2'
        >
          <h2 className='text-sm font-semibold text-muted-foreground'>{group}</h2>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            {SHOWCASES.filter((s) => s.group === group).map((s) => (
              <Link
                key={s.slug}
                href={`/dev/components/${s.slug}`}
                className='rounded-lg border bg-card p-4 transition-colors hover:border-primary'
              >
                <p className='font-medium'>{s.title}</p>
                <p className='text-xs text-muted-foreground'>{s.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
