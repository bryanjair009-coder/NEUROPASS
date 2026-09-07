import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { TARGET_SCHEMA_VERSION } from '@/data/migrations';
import { formatDiagnostics } from '@/lib/diagnostics';
import { isSimulated, screenTime } from '@/screentime';
import { kdfIsAccelerated } from '@/security/kdf';
import { useAppStore } from '@/state/appStore';
import { makeStyles } from '@/ui/makeStyles';
import { useTheme } from '@/ui/ThemeProvider';
import { Button, Card, Gap, Notice, Screen, Txt } from '@/ui/components/primitives';
import { typography } from '@/ui/theme';

import { useParentSession } from './_layout';

/**
 * Reporte de diagnóstico.
 *
 * Existe para las pruebas con gente real. Los fallos de esta app dependen casi
 * siempre del fabricante y de qué permisos se concedieron, y pedir esos datos
 * uno por uno por mensaje es lento y se contesta mal.
 *
 * El reporte se copia o se comparte por donde la persona quiera. No se envía a
 * ningún servidor: NEUROpass no hace peticiones de red, y añadir telemetría
 * —aunque fuera cómodo para depurar— rompería justo la propiedad que permite
 * prometerle a una familia que nada de su hijo sale del teléfono.
 */
export default function Diagnostics() {
  const { palette, isDark } = useTheme();
  const styles = useStyles();
  const session = useParentSession();

  const capabilities = useAppStore((state) => state.capabilities);
  const parentPause = useAppStore((state) => state.parentPause);

  const [reporte, setReporte] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const generar = useCallback(async () => {
    const [guard, kdfAccelerated] = await Promise.all([
      isSimulated ? Promise.resolve(null) : screenTime.getGuardStatus(),
      kdfIsAccelerated(),
    ]);

    // `Platform.constants` trae fabricante, modelo y nivel de API en Android sin
    // añadir ninguna dependencia. Es exactamente lo que hace falta y nada más.
    const constants = Platform.constants as Partial<{
      Manufacturer: string;
      Model: string;
      Release: string;
      Version: number;
    }>;

    setReporte(
      formatDiagnostics({
        appVersion: Constants.expoConfig?.version ?? 'desconocida',
        buildNumber: String(Constants.expoConfig?.android?.versionCode ?? '—'),
        osVersion: constants.Release ?? String(Platform.Version),
        apiLevel: constants.Version ?? Platform.Version,
        manufacturer: constants.Manufacturer ?? 'desconocido',
        model: constants.Model ?? 'desconocido',
        schemaVersion: TARGET_SCHEMA_VERSION,
        nativeModuleLoaded: !isSimulated,
        kdfAccelerated,
        darkTheme: isDark,
        permissions: capabilities
          ? {
              usageAccess: capabilities.usageAccess,
              overlay: capabilities.overlay,
              notifications: capabilities.notifications,
              bateriaSinLimite: capabilities.batteryUnrestricted,
              adminDispositivo: capabilities.deviceAdmin,
            }
          : {},
        guard: guard
          ? {
              enabled: guard.enabled,
              alive: guard.alive,
              lastHeartbeatAt: guard.lastHeartbeatAt,
            }
          : null,
        parentPaused: parentPause !== null,
        generatedAt: Date.now(),
      }),
    );
  }, [capabilities, isDark, parentPause]);

  useFocusEffect(
    useCallback(() => {
      void generar();
    }, [generar]),
  );

  if (!session.unlocked) return <Redirect href="/(parent)/unlock" />;

  return (
    <Screen>
      <Notice tone="info" title="Para reportar un problema">
        Copia este reporte y envíalo junto con una descripción de lo que pasó. Contiene el modelo del
        teléfono y el estado de los permisos, que es lo que hace falta para reproducir el fallo.
      </Notice>

      <Gap size="lg" />

      <Card>
        <Txt style={styles.reporte}>{reporte ?? 'Recopilando…'}</Txt>
      </Card>

      <Gap size="lg" />

      <Button
        label={copiado ? '✓ Copiado' : 'Copiar reporte'}
        disabled={!reporte}
        onPress={async () => {
          if (!reporte) return;
          await Clipboard.setStringAsync(reporte);
          setCopiado(true);
        }}
      />

      <Gap size="md" />

      <Button
        label="Compartir"
        variant="secondary"
        disabled={!reporte}
        onPress={() => {
          if (!reporte) return;
          // El diálogo del sistema deja elegir destino: correo, mensajería o
          // notas. Es la persona quien decide a dónde va, no la app.
          void Share.share({ message: reporte });
        }}
      />

      <Gap size="xl" />

      <View>
        <Txt variant="caption" color={palette.textMuted}>
          El reporte no incluye el apodo del menor, su rango de edad, su progreso ni qué
          aplicaciones tiene restringidas.
        </Txt>
      </View>

      <Gap size="xxl" />
    </Screen>
  );
}

const useStyles = makeStyles((palette) => ({
  reporte: {
    ...(typography.mono as object),
    color: palette.text,
    fontSize: 12,
    lineHeight: 18,
  },
}));
