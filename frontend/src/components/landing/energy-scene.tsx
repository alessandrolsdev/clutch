'use client';

import { useEffect, useRef } from 'react';
import { useMotionPaused } from '@/components/ui/motion-environment';

export function EnergyScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const paused = useMotionPaused();
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (paused) {
      scene.style.removeProperty('--scene-x');
      scene.style.removeProperty('--scene-y');
      scene.style.removeProperty('--scene-scroll');
      return;
    }
    let frame = 0;
    let x = 0;
    let y = 0;
    const draw = () => {
      frame = 0;
      const bounds = scene.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
      scene.style.setProperty('--scene-x', `${x}px`);
      scene.style.setProperty('--scene-y', `${y}px`);
      scene.style.setProperty(
        '--scene-scroll',
        `${Math.max(-45, Math.min(70, -bounds.top * 0.15))}px`,
      );
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(draw);
    };
    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const bounds = scene.getBoundingClientRect();
      x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 28;
      y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 20;
      schedule();
    };
    const reset = () => {
      x = 0;
      y = 0;
      schedule();
    };
    scene.addEventListener('pointermove', pointer);
    scene.addEventListener('pointerleave', reset);
    window.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      scene.removeEventListener('pointermove', pointer);
      scene.removeEventListener('pointerleave', reset);
      window.removeEventListener('scroll', schedule);
    };
  }, [paused]);
  return (
    <div className="energy-scene" ref={sceneRef} aria-hidden="true">
      <div className="energy-orbit orbit-one" />
      <div className="energy-orbit orbit-two" />
      <div className="energy-crosshair" />
      <div className="energy-word">C</div>
      <div className="energy-core">
        <svg viewBox="0 0 480 540" className="sentinel" fill="none">
          <defs>
            <linearGradient
              id="sentinel-metal"
              x1="100"
              y1="40"
              x2="350"
              y2="450"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#faf5ff" />
              <stop offset=".25" stopColor="#8b7baa" />
              <stop offset=".48" stopColor="#252031" />
              <stop offset=".65" stopColor="#c9bfdc" />
              <stop offset="1" stopColor="#30213f" />
            </linearGradient>
            <linearGradient
              id="sentinel-visor"
              x1="120"
              y1="230"
              x2="360"
              y2="250"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#c4ff51" />
              <stop offset="1" stopColor="#60f5d5" />
            </linearGradient>
          </defs>
          <path
            d="M70 181 101 100 166 69 240 25 313 69 380 100 410 181 390 360 316 438 240 483 161 438 91 360Z"
            fill="url(#sentinel-metal)"
            stroke="#d5c3f9"
            strokeWidth="2"
          />
          <path
            d="m101 100 55 61 84-43 85 43 55-61-67-31-73-44-74 44Z"
            fill="#302338"
            stroke="#a696b8"
          />
          <path
            d="m156 161 84-43 85 43-29 58H185Z"
            fill="url(#sentinel-metal)"
            stroke="#e0caff"
          />
          <path
            d="m70 181 72 34 24 88-75 57Z"
            fill="#1d1828"
            stroke="#b39cca"
          />
          <path
            d="m410 181-72 34-24 88 76 57Z"
            fill="#201929"
            stroke="#b39cca"
          />
          <path
            d="m129 219 111 19 111-19-21 77-90 25-90-25Z"
            fill="#090c0c"
            stroke="#d4c2f0"
            strokeWidth="3"
          />
          <path
            className="sentinel-visor"
            d="m148 241 79 19v23l-67-15Zm184 0-79 19v23l67-15Z"
            fill="url(#sentinel-visor)"
          />
          <path
            d="m166 303 74 25 74-25 27 54-46 63-55 29-55-29-46-63Z"
            fill="url(#sentinel-metal)"
            stroke="#bea1e3"
          />
          <path
            d="m197 357 43-18 43 18-14 36h-58Z"
            fill="#15101e"
            stroke="#95809f"
          />
          <path
            d="m220 358 20-8 20 8M213 372h54M223 386h34"
            stroke="#c4ff51"
            strokeWidth="3"
          />
          <path
            d="m101 100 5 72 36 43m238-115-5 72-37 43M240 25v93m-149 242 70 78 24-18m205-60-74 78-21-18"
            stroke="#f0dcff"
            strokeOpacity=".7"
          />
          <path
            d="m66 153-25 43 13 102 34 35m326-180 25 43-13 102-34 35"
            stroke="#c4ff51"
            strokeWidth="8"
          />
        </svg>
      </div>
      <div className="scene-chip chip-top">
        <span className="live-dot" /> PLAYER ONE / ONLINE
      </div>
      <div className="scene-chip chip-bottom">
        + IDENTIDADE DESBLOQUEADA <span>↗</span>
      </div>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <i key={index} className={`energy-shard shard-${index}`} />
      ))}
      <span className="scene-coordinate">23° / CLUTCH SYSTEM / 001</span>
    </div>
  );
}
