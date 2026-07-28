'use client'

import { Suspense } from 'react'
import ProfileContent from './_components/profile-content'

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileContent />
    </Suspense>
  )
}
