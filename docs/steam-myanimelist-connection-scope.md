# Conexao inicial Steam/MyAnimeList

## Steam

- Steam Web Sign-In usa OpenID 2.0, nao OAuth2 comum.
- A identidade forte para ownership externo e o SteamID64 retornado pela Claimed ID no formato `https://steamcommunity.com/openid/id/<steamid>`.
- O CLUTCH ainda usa o fluxo legado de formulario com SteamID informado pelo usuario, mas persiste esse SteamID64 como `PlatformIntegration.externalId` via `ConnectedAccountService`.
- A importacao de biblioteca usa `IPlayerService/GetOwnedGames` com `STEAM_API_KEY`, `include_appinfo=true` e `include_played_free_games=true`.
- Quando a Steam nao retorna jogos por biblioteca privada ou detalhes nao visiveis, o CLUTCH trata como lista vazia e mantem a conexao, sem expor API key ou payload bruto ao frontend.
- O contrato atual nao diferencia com confianca biblioteca realmente vazia, biblioteca privada e resposta sem jogos por regra de visibilidade da Steam. A UI deve comunicar esse fallback sem transformar a ausencia de jogos em erro fatal.

## MyAnimeList

- MyAnimeList API v2 exige app registration e OAuth2 Authorization Code com PKCE.
- O fluxo real precisa de, no minimo, `MYANIMELIST_CLIENT_ID`, `MYANIMELIST_CLIENT_SECRET` quando aplicavel, redirect URI registrada, state seguro, code verifier/challenge e callback backend.
- Nao existe client OAuth, env de MyAnimeList ou callback seguro no CLUTCH nesta rodada.
- Por isso, MyAnimeList fica registrado como provider planejado/indisponivel no Connection Center, sem `OAUTH_CONNECT` e sem criar conexao falsa.
- Importacao de anime/manga lists e normalizacao de watchlist ficam fora da #274 ate haver contrato dedicado.

## Fontes consultadas

- Steamworks User Authentication and Ownership: https://partner.steamgames.com/doc/features/auth
- Steamworks IPlayerService/GetOwnedGames: https://partner.steamgames.com/doc/webapi/iplayerservice
- MyAnimeList authorization: https://myanimelist.net/apiconfig/references/authorization
- MyAnimeList API v2: https://myanimelist.net/apiconfig/references/api/v2
