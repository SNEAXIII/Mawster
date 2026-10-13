import { LookProvider, LookToolbar } from './_components/look'

export default function ComponentsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <LookProvider>
      <LookToolbar />
      <main className='mx-auto flex max-w-7xl flex-col gap-6 p-6'>{children}</main>
    </LookProvider>
  )
}
