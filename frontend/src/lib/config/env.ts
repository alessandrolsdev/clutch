type ClientEnv = {
  apiUrl: string;
  wsUrl: string;
};

export function getClientEnv(): ClientEnv {
  return {
    apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? '',
  };
}
