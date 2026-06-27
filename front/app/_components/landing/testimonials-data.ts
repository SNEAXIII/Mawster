export type Testimonial = {
  name: string; // account name
  alliance: string; // alliance name or tag
  role: string; // e.g. Leader, Officer, Member
  quote: string;
};

// Fill these in with real quotes. While any field equals PLACEHOLDER,
// the testimonials section stays hidden (no fake quotes in production).
export const PLACEHOLDER = 'Placeholder quote. Please replace with a real quote.';

export const TESTIMONIALS: Testimonial[] = [
  { name: 'Babayaga', alliance: "2-1-1", role: "Leader", quote: PLACEHOLDER },
  { name: 'Ssalazard', alliance: 'WAM6', role: "Leader", quote: PLACEHOLDER },
];
