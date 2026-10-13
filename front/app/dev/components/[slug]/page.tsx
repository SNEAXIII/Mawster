'use client'

import { notFound, useParams } from 'next/navigation'
import { SHOWCASES } from '../_showcases/registry'
import { LookFrames } from '../_components/look'

export default function ShowcasePage() {
  const { slug } = useParams<{ slug: string }>()
  const showcase = SHOWCASES.find((s) => s.slug === slug)
  if (!showcase) notFound()
  const { Component } = showcase

  return (
    <>
      <header>
        <h1 className='text-xl font-semibold'>{showcase.title}</h1>
        <p className='text-sm text-muted-foreground'>{showcase.description}</p>
      </header>
      <LookFrames>
        <Component />
      </LookFrames>
    </>
  )
}
