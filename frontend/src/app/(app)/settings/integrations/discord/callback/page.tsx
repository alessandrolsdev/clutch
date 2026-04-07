import { DiscordOAuthCallbackContent } from '@/components/settings/discord-oauth-callback-content';

type CallbackPageSearchParams = Record<string, string | string[] | undefined>;

type DiscordCallbackPageProps = {
  searchParams: Promise<CallbackPageSearchParams>;
};

function getQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return typeof value === 'string' ? value : undefined;
}

export default async function DiscordIntegrationCallbackPage({
  searchParams,
}: DiscordCallbackPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <DiscordOAuthCallbackContent
      searchParams={{
        code: getQueryValue(resolvedSearchParams.code),
        state: getQueryValue(resolvedSearchParams.state),
        error: getQueryValue(resolvedSearchParams.error),
        errorDescription: getQueryValue(resolvedSearchParams.error_description),
      }}
    />
  );
}
