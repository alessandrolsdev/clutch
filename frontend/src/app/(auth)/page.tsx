import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';

export default function AuthLandingPage() {
  return (
    <section className="grid w-full gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <Card tone="accent" className="p-card shadow-glow">
        <div className="flex flex-col gap-section">
          <Badge tone="accent">CLUTCH</Badge>
          <SectionHeading
            level="h1"
            eyebrow="Frontend foundation"
            title="The shell is ready for the authenticated product."
            description="The public entry stays light while the authenticated area gets its own navbar and sidebar shell for the next frontend issues."
          />
        </div>
      </Card>

      <Card tone="default">
        <div className="flex h-full flex-col gap-section">
          <p className="text-xs uppercase tracking-[0.35em] text-secondary">
            What is ready
          </p>
          <ul className="space-y-4 text-sm leading-6 text-secondary">
            <li>Root layout with providers and strict foundation tokens.</li>
            <li>Authenticated shell with responsive navbar and sidebar.</li>
            <li>Separate route groups for auth and app surfaces.</li>
          </ul>
        </div>
      </Card>
    </section>
  );
}
