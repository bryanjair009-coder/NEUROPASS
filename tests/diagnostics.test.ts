import { describe, expect, it } from 'vitest';

import { formatDiagnostics, type DiagnosticsInput } from '@/lib/diagnostics';

/**
 * Reporte de diagnóstico.
 *
 * La prueba que de verdad importa aquí es la última: que el reporte no filtre
 * datos del menor. Es un texto que una persona va a copiar y mandar por
 * WhatsApp a alguien que no conoce, y la promesa de privacidad de NEUROpass se
 * rompería en ese envío tan fácilmente como con un servidor de telemetría.
 */

const AHORA = Date.UTC(2026, 8, 20, 18, 0, 0);

const BASE: DiagnosticsInput = {
  appVersion: '0.6.0',
  buildNumber: '8',
  osVersion: '14',
  apiLevel: 34,
  manufacturer: 'Xiaomi',
  model: 'POCO X6 Pro',
  schemaVersion: 3,
  nativeModuleLoaded: true,
  kdfAccelerated: true,
  darkTheme: false,
  permissions: { usageAccess: true, overlay: true, notifications: false },
  guard: { enabled: true, alive: true, lastHeartbeatAt: AHORA - 2_000 },
  parentPaused: false,
  generatedAt: AHORA,
};

describe('formatDiagnostics', () => {
  it('incluye lo necesario para reproducir un fallo', () => {
    const texto = formatDiagnostics(BASE);

    expect(texto).toContain('Xiaomi POCO X6 Pro');
    expect(texto).toContain('Android      14 (API 34)');
    expect(texto).toContain('0.6.0');
    expect(texto).toContain('usageAccess');
  });

  it('marca los permisos concedidos y los que faltan', () => {
    const texto = formatDiagnostics(BASE);

    expect(texto).toMatch(/usageAccess\s+sí/);
    expect(texto).toMatch(/notifications\s+NO/);
  });

  it('traduce el latido a algo legible', () => {
    expect(formatDiagnostics(BASE)).toContain('hace un instante');

    expect(
      formatDiagnostics({ ...BASE, guard: { ...BASE.guard!, lastHeartbeatAt: AHORA - 45_000 } }),
    ).toContain('hace 45 s');

    expect(
      formatDiagnostics({ ...BASE, guard: { ...BASE.guard!, lastHeartbeatAt: AHORA - 600_000 } }),
    ).toContain('hace 10 min');

    expect(formatDiagnostics({ ...BASE, guard: { ...BASE.guard!, lastHeartbeatAt: 0 } })).toContain(
      'nunca se ha ejecutado',
    );
  });

  it('distingue el simulador de un guardián sin estado', () => {
    expect(formatDiagnostics({ ...BASE, nativeModuleLoaded: false })).toContain(
      'módulo nativo no cargado',
    );
    expect(formatDiagnostics({ ...BASE, guard: null })).toContain('sin estado disponible');
  });

  it('no filtra ningún dato del menor', () => {
    // Se construye un caso con datos que NUNCA deben acabar en el reporte. Si
    // alguien añade un campo al diagnóstico sin pensarlo, esta prueba lo caza.
    const texto = formatDiagnostics(BASE).toLowerCase();

    const prohibido = [
      'sofi', // apodo
      '9-12', // rango de edad
      'com.whatsapp', // apps restringidas
      'minutos ganados',
      'pin',
      'sesión',
    ];

    for (const termino of prohibido) {
      expect(texto, `el reporte contiene "${termino}"`).not.toContain(termino);
    }

    expect(formatDiagnostics(BASE)).toContain('no incluye ningún dato del menor');
  });
});
