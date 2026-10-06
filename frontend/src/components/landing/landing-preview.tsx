const games = [
  {
    name: 'Counter-Strike 2',
    platform: 'STEAM',
    hours: '980h',
    code: 'CS',
    color: 'orange',
  },
  {
    name: 'Fortnite',
    platform: 'EPIC GAMES',
    hours: '120h',
    code: 'FN',
    color: 'violet',
  },
  { name: 'Hades', platform: 'STEAM', hours: '42h', code: 'H', color: 'red' },
];

export function LandingPreview() {
  return (
    <div className="player-preview" data-testid="landing-preview">
      <div className="player-cover">
        <span>PLAYER CARD / 001</span>
        <span className="player-cover-mark" aria-hidden="true">
          C/
        </span>
        <span>PRÉVIA ILUSTRATIVA</span>
      </div>
      <div className="player-body">
        <div className="player-heading">
          <div className="player-avatar" aria-hidden="true">
            C
          </div>
          <div>
            <h3>CLUTCH Player</h3>
            <p>@clutchplayer</p>
          </div>
          <span className="player-status">
            <span className="live-dot" /> ONLINE
          </span>
        </div>
        <p className="player-bio">
          Mais uma partida. Mais uma história pra contar.
        </p>
        <div className="player-stats">
          <div>
            <strong>80</strong>
            <span>JOGOS</span>
          </div>
          <div>
            <strong>1.142</strong>
            <span>HORAS</span>
          </div>
          <div>
            <strong>12</strong>
            <span>AMIGOS</span>
          </div>
        </div>
        <div className="player-library">
          <p className="eyebrow">
            NA ROTAÇÃO <span>↗</span>
          </p>
          {games.map((game) => (
            <div className="player-game" key={game.name}>
              <div
                className={`game-cover-art cover-${game.color}`}
                aria-hidden="true"
              >
                {game.code}
              </div>
              <div>
                <h4>{game.name}</h4>
                <span>{game.platform}</span>
              </div>
              <strong>{game.hours}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="player-sticker" aria-hidden="true">
        100%
        <br />
        <span>VOCÊ.</span>
      </div>
    </div>
  );
}
