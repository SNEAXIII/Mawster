import { Hero } from './_components/landing/hero';
import { StatStrip } from './_components/landing/stat-strip';
import { FeatureGrid } from './_components/landing/feature-grid';
import { StatsShowcase } from './_components/landing/stats-showcase';
import { FeatureRequest } from './_components/landing/feature-request';
import { ComingSoon } from './_components/landing/coming-soon';
import { Testimonials } from './_components/landing/testimonials';
import { Faq } from './_components/landing/faq';
import { Community } from './_components/landing/community';
import { Cta } from './_components/landing/cta';

export default function Page() {
  return (
    <div className='-m-3 min-h-full bg-background text-foreground'>
      <Hero />
      <StatStrip />
      <FeatureGrid />
      <Testimonials />
      <FeatureRequest />
      <StatsShowcase />
      <ComingSoon />
      <Community />
      <Faq />
      <Cta />
    </div>
  );
}
