import { describe, expect, it } from 'vitest';

import { darken, lighten, withAlpha } from '@/lib/color';

describe('color', () => {
  it('oscurecer y aclarar en los extremos', () => {
    expect(darken('#C64FE3', 0)).toBe('#c64fe3');
    expect(darken('#C64FE3', 1)).toBe('#000000');
    expect(lighten('#C64FE3', 1)).toBe('#ffffff');
  });

  it('admite la notación de tres dígitos', () => {
    expect(lighten('#FFF', 0)).toBe('#ffffff');
    expect(darken('#000', 0)).toBe('#000000');
  });

  it('oscurecer siempre reduce cada componente', () => {
    for (const hex of ['#7C5FFF', '#22D3EE', '#22D79E', '#FF5DA0', '#FFAA3C']) {
      const original = parseInt(hex.slice(1), 16);
      const oscuro = parseInt(darken(hex, 0.25).slice(1), 16);
      expect(oscuro, hex).toBeLessThan(original);
    }
  });

  it('la transparencia produce ocho dígitos válidos', () => {
    expect(withAlpha('#FFFFFF', 0.5)).toBe('#FFFFFF80');
    expect(withAlpha('#FFFFFF', 1)).toBe('#FFFFFFff');
    expect(withAlpha('#FFFFFF', 0)).toBe('#FFFFFF00');
  });
});
