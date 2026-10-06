import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionEnvironment } from '@/components/ui/motion-environment';
import { EnergyScene } from '@/components/landing/energy-scene';

function mockPreference(initial: boolean) {
  let listener: (() => void) | undefined;
  const media = {
    matches: initial,
    addEventListener: vi.fn((_event: string, callback: () => void) => {
      listener = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return {
    media,
    change: (value: boolean) =>
      act(() => {
        media.matches = value;
        listener?.();
      }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MotionEnvironment', () => {
  it('pauses and resumes decorative motion without hiding content', () => {
    mockPreference(false);
    const { container } = render(
      <MotionEnvironment>
        <p>Conteúdo</p>
      </MotionEnvironment>,
    );
    expect(container.firstChild).toHaveAttribute('data-motion-paused', 'false');
    fireEvent.click(screen.getByRole('button', { name: /pausar animações/i }));
    expect(container.firstChild).toHaveAttribute('data-motion-paused', 'true');
    expect(screen.getByText('Conteúdo')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /ativar animações/i }));
    expect(container.firstChild).toHaveAttribute('data-motion-paused', 'false');
  });
  it('honors changes to the system preference and cleans up its listener', () => {
    const preference = mockPreference(true);
    const { unmount } = render(<MotionEnvironment>Conteúdo</MotionEnvironment>);
    expect(
      screen.getByRole('button', { name: /movimento reduzido/i }),
    ).toBeDisabled();
    preference.change(false);
    expect(
      screen.getByRole('button', { name: /pausar animações/i }),
    ).toBeEnabled();
    preference.change(true);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    unmount();
    expect(preference.media.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
  it('removes parallax listeners and cancels the pending frame when paused', () => {
    mockPreference(false);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 42),
    );
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const remove = vi.spyOn(window, 'removeEventListener');
    const { container } = render(
      <MotionEnvironment>
        <EnergyScene />
      </MotionEnvironment>,
    );
    const scene = container.querySelector('.energy-scene');
    expect(scene).toHaveAttribute('aria-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: /pausar animações/i }));
    expect(cancel).toHaveBeenCalledWith(42);
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(scene).not.toHaveAttribute('style');
  });
});
