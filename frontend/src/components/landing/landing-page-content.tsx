import Link from 'next/link';
import { EnergyScene } from '@/components/landing/energy-scene';
import { LandingPreview } from '@/components/landing/landing-preview';

const experiences = [
  {
    number: '01',
    name: 'Seu squad.\nSua frequência.',
    tag: 'SOCIAL / CONEXÃO',
    text: 'Compartilhe aquela jogada, encontre seus amigos online e mantenha a conversa viva entre uma partida e outra.',
    shape: 'squad',
  },
  {
    number: '02',
    name: 'Uma biblioteca.\nTodos os seus mundos.',
    tag: 'BIBLIOTECA / IDENTIDADE',
    text: 'Reúna seus jogos, mostre suas horas de dedicação e transforme seu perfil em uma história que só você pode contar.',
    shape: 'worlds',
  },
  {
    number: '03',
    name: 'Aceite o desafio.\nDeixe sua marca.',
    tag: 'ARENA / COMUNIDADE',
    text: 'Entre em desafios semanais e encontre comunidades que compartilham a sua vontade de jogar.',
    shape: 'arena',
  },
];

export function LandingPageContent() {
  return (
    <div className="landing-experience" data-testid="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> SUA PRÓXIMA FASE COMEÇA AQUI
          </p>
          <h1 id="landing-title">
            NÃO É SÓ
            <br />
            UM JOGO.
            <br />
            <span>
              É QUEM
              <br className="mobile-break" /> VOCÊ É.
            </span>
          </h1>
          <p className="hero-description">
            Sua biblioteca. Seu squad. Sua história.
            <br />
            Todo o seu universo gamer, conectado no CLUTCH.
          </p>
          <div className="hero-actions">
            <Link href="/register" className="gamer-cta">
              CRIAR CONTA GRÁTIS <span aria-hidden="true">↗</span>
            </Link>
            <Link href="#universo" className="gamer-link">
              EXPLORAR O CLUTCH <span aria-hidden="true">↓</span>
            </Link>
          </div>
          <div className="hero-footnote">
            <span>FEITO PARA QUEM JOGA.</span>
            <span>CLUTCH / BETA</span>
          </div>
        </div>
        <EnergyScene />
      </section>
      <div
        className="signal-strip"
        aria-label="Conecte. Jogue. Compartilhe. Repita."
      >
        <div className="signal-track" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <span key={item}>
              CONECTE <b>✳</b> JOGUE <b>✳</b> COMPARTILHE <b>✳</b> REPITA{' '}
              <b>✳</b>{' '}
            </span>
          ))}
        </div>
      </div>
      <section
        id="universo"
        className="universe-section"
        aria-labelledby="universe-title"
      >
        <div className="editorial-heading">
          <p className="eyebrow">01 / SEU UNIVERSO, SEM FRONTEIRAS</p>
          <h2 id="universe-title">
            MUITO ALÉM
            <br />
            DO <span>GG.</span>
          </h2>
          <p>
            O jogo acaba.
            <br />A sua história continua.
          </p>
        </div>
        <div className="experience-grid">
          {experiences.map((item) => (
            <article
              className={`experience-panel experience-${item.shape}`}
              key={item.number}
            >
              <div className="experience-top">
                <span>{item.tag}</span>
                <span>↗</span>
              </div>
              <div
                className={`feature-art feature-${item.shape}`}
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <b>
                  {item.shape === 'squad'
                    ? '✳'
                    : item.shape === 'worlds'
                      ? '∞'
                      : '↗'}
                </b>
              </div>
              <div className="experience-copy">
                <span className="experience-number">/{item.number}</span>
                <h3>{item.name}</h3>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="identity-section" aria-labelledby="identity-title">
        <div className="identity-copy">
          <p className="eyebrow">02 / SEU PERFIL. SUAS REGRAS.</p>
          <h2 id="identity-title">
            SEU DNA
            <br />
            <span>É GAMER.</span>
          </h2>
          <p>
            Não deixe suas conquistas espalhadas. Conecte suas plataformas e
            mostre o que faz de você um jogador único.
          </p>
          <Link href="/register" className="gamer-link">
            CONSTRUIR MEU PERFIL <span aria-hidden="true">↗</span>
          </Link>
          <div className="platform-list">
            <span>STEAM</span>
            <span>EPIC GAMES</span>
            <span>DISCORD</span>
          </div>
        </div>
        <LandingPreview />
      </section>
      <section className="final-call" aria-labelledby="join-title">
        <span className="final-watermark" aria-hidden="true">
          CLUTCH
        </span>
        <p className="eyebrow">O PRÓXIMO CAPÍTULO É SEU.</p>
        <h2 id="join-title">
          ENTRE NO
          <br />
          <span>JOGO.</span>
        </h2>
        <Link href="/register" className="gamer-cta">
          COMEÇAR AGORA <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/login" className="gamer-link">
          Já tem conta? Entrar
        </Link>
      </section>
      <footer className="landing-footer">
        <Link href="/" className="brand-word">
          CLUTCH<span>®</span>
        </Link>
        <p>SEU JOGO. SUA IDENTIDADE.</p>
        <span>FEITO PARA CONECTAR JOGADORES.</span>
      </footer>
    </div>
  );
}
