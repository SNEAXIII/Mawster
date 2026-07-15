export type TestimonialRole = 'leader' | 'officer' | 'member'

export type Testimonial = {
  name: string // account name
  alliance: string // alliance name or tag
  roleKey: TestimonialRole
  quoteKey: string // key in landing.testimonialQuotes
}

// While a testimonial points at the 'placeholder' quote, it stays hidden
// (no fake quotes in production). Add a real quoteKey to publish it.
export const TESTIMONIALS: Testimonial[] = [
  { name: 'Babayaga', alliance: '2-1-1', roleKey: 'leader', quoteKey: 'babayaga' },
  { name: 'Aragorn', alliance: 'WAM6', roleKey: 'leader', quoteKey: 'aragorn' },
  { name: 'Elliebingo', alliance: 'SPYTY', roleKey: 'leader', quoteKey: 'elliebingo' },
]
