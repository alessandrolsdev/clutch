import { Badge } from '@/components/ui/badge';
import { type ProfileResponse } from '@/schemas/profile';

type PlatformBadgesProps = {
  integrations: ProfileResponse['platformIntegrations'];
};

export function PlatformBadges({ integrations }: PlatformBadgesProps) {
  if (integrations.length === 0) {
    return <Badge tone="neutral">Sem integracoes conectadas</Badge>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {integrations.map((integration) => (
        <Badge key={integration.platform} tone="accent">
          {integration.platform}
        </Badge>
      ))}
    </div>
  );
}
