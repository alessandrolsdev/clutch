'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

const MotionContext = createContext(true);
export function useMotionPaused() {
  return useContext(MotionContext);
}

export function MotionEnvironment({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const stopped = paused || reduced;
  return (
    <MotionContext.Provider value={stopped}>
      <div className="motion-world" data-motion-paused={stopped}>
        {children}
        <button
          type="button"
          className="motion-toggle"
          aria-pressed={stopped}
          disabled={reduced}
          onClick={() => setPaused((value) => !value)}
        >
          <span aria-hidden="true">{stopped ? '▷' : 'Ⅱ'}</span>
          {reduced
            ? 'Movimento reduzido'
            : paused
              ? 'Ativar animações'
              : 'Pausar animações'}
        </button>
      </div>
    </MotionContext.Provider>
  );
}
