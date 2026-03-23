import axios from 'axios';

// ─────────────────────────────────────────────────────────────
// Epic Games Service — proxy para o Python service
// ─────────────────────────────────────────────────────────────

const EPIC_SERVICE_URL = process.env['EPIC_SERVICE_URL'] ?? 'http://localhost:8000';
const EPIC_TIMEOUT     = 30_000;

export interface EpicGame {
  id:        string;
  title:     string;
  namespace: string;
  coverUrl:  string | null;
}

export const epicService = {

  async getLibrary(authToken: string): Promise<EpicGame[]> {
    const response = await axios.get<{ games: EpicGame[] }>(
      `${EPIC_SERVICE_URL}/library`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: EPIC_TIMEOUT,
      },
    );

    return response.data.games ?? [];
  },

  async validateToken(authToken: string): Promise<boolean> {
    try {
      await axios.get(`${EPIC_SERVICE_URL}/validate`, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 5_000,
      });
      return true;
    } catch {
      return false;
    }
  },

};