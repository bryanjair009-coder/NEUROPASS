import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { DEFAULT_REWARD_POLICY } from '@/engine/economy';
import { lighten, withAlpha } from '@/lib/color';
import { useActiveChild, useAppStore } from '@/state/appStore';
import { Aparece } from '@/ui/components/Aparece';
import { Axo } from '@/ui/components/Axo';
import { Button, Gap, Screen, Txt } from '@/ui/components/primitives';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { marca, radius, shadow, space } from '@/ui/theme';
import { useMovimientoReducido } from '@/ui/useMovimientoReducido';
import { useRacha } from '@/ui/useRacha';

/**
 * Resultado de la sesión.
 *
 * Celebra el esfuerzo, no la perfección. El número grande son los minutos
 * ganados —lo que al menor le importa— y el desglose de aciertos aparece
 * debajo, sin porcentajes ni comparaciones. Una sesión con dos aciertos de
 * cinco no se presenta como un fracaso: se ganaron minutos igual, y ese es el
 * mensaje que sostiene el hábito.
 */
export default function ResultScreen() {
  const palette = usePalette();
  const styles = useStyles();
  const child = useActiveChild();
  const settings = useAppStore((state) => state.settings);
  const ledger = useAppStore((state) => state.ledger);
  const params = useLocalSearchParams<{
    minutes?: string;
    correct?: string;
    total?: string;
    capped?: string;
  }>();

  const minutes = Number(params.minutes ?? 0);
  const correct = Number(params.correct ?? 0);
  const total = Number(params.total ?? 0);
  const capped = params.capped === '1';
  const perfect = total > 0 && correct === total;

  const racha = useRacha(
    child?.id ?? null,
    (settings?.rewardPolicy ?? DEFAULT_REWARD_POLICY).dayResetHour,
    ledger?.sessionsCompleted ?? 0,
  );

  return (
    <Screen
      formas
      footer={
        <Button
          label={minutes > 0 ? 'A jugar 🎮' : 'Volver al inicio'}
          onPress={() => router.replace('/(child)/home')}
        />
      }
    >
      <View style={styles.centro}>
        <Aparece desde="abajo" style={styles.heroe}>
          <Axo ancho={190} expresion={minutes > 0 ? 'acierto' : 'neutro'} tinte={marca.mango} />
          {/* El trofeo va al lado y no encima: superpuesto tapaba la cara, que
              es justo lo que comunica la celebración. */}
          {minutes > 0 ? <Medalla /> : null}
        </Aparece>

        <Gap size="lg" />
        <Txt variant="title" align="center">
          {minutes > 0 ? '¡Desbloqueaste tiempo!' : '¡Buen intento!'}
        </Txt>
        <Gap size="xs" />
        <Txt variant="bodyStrong" align="center" color={palette.textMuted}>
          {perfect ? `${correct} de ${total}, sin un solo error` : 'Cada reto que intentas entrena tu cerebro'}
        </Txt>

        <Gap size="lg" />
        <View style={[styles.ganaste, shadow('lg', marca.limaOsc)]}>
          <View style={styles.ganasteInterior}>
            <LinearGradient
              colors={[marca.lima, marca.limaOsc]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.brillo} />
            <Text style={styles.ganasteEtiqueta}>GANASTE</Text>
            <Text style={styles.ganasteCifra} accessibilityLabel={`${minutes} minutos de juego`}>
              +{minutes}
            </Text>
            <Text style={styles.ganasteNota}>{minutes === 1 ? 'minuto de juego' : 'minutos de juego'}</Text>
          </View>
        </View>

        <Gap size="md" />
        <View style={styles.metricas}>
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: palette.accent }]}>
              {correct}/{total}
            </Text>
            <Txt variant="caption" align="center" color={palette.textMuted}>
              retos resueltos
            </Txt>
          </View>
          <View style={styles.metrica}>
            <Text style={[styles.metricaValor, { color: palette.warning }]}>{racha} 🔥</Text>
            <Txt variant="caption" align="center" color={palette.textMuted}>
              {racha === 1 ? 'día de racha' : 'días de racha'}
            </Txt>
          </View>
        </View>

        <Gap size="md" />
        <View style={styles.mensaje}>
          <Axo ancho={60} expresion="neutro" tinte={marca.morado} />
          <Txt variant="bodyStrong" style={styles.mensajeTexto}>
            {mensajeDeAxo({ minutes, total, perfect, capped })}
          </Txt>
        </View>
      </View>
    </Screen>
  );
}

/**
 * Lo que dice AXO al cerrar. El límite diario va primero: si se alcanzó, es lo
 * único que explica por qué la cifra es menor de lo esperado.
 */
function mensajeDeAxo({
  minutes,
  total,
  perfect,
  capped,
}: {
  minutes: number;
  total: number;
  perfect: boolean;
  capped: boolean;
}): string {
  if (capped) {
    return 'Llegaste al límite de hoy: ganaste todos los minutos que tu familia configuró. Mañana vuelve a contar desde cero.';
  }
  if (minutes === 0 && total > 0) {
    return 'Equivocarse no resta nada. La próxima sesión te tocarán retos ajustados a tu nivel.';
  }
  if (perfect) return '¡Increíble! La próxima vez te traigo retos un poco más difíciles.';
  return 'Cada reto que intentas me ayuda a elegir los siguientes. ¡Seguimos pronto!';
}

/** Medalla del trofeo. Flota despacio; con «reducir movimiento» se queda quieta. */
function Medalla() {
  const styles = useStyles();
  const movimientoReducido = useMovimientoReducido();
  const [flotar] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (movimientoReducido) return undefined;
    const media = { duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const ciclo = Animated.loop(
      Animated.sequence([
        Animated.timing(flotar, { toValue: 1, ...media }),
        Animated.timing(flotar, { toValue: 0, ...media }),
      ]),
    );
    ciclo.start();
    return () => ciclo.stop();
  }, [flotar, movimientoReducido]);

  return (
    <Animated.View
      style={[
        styles.medalla,
        shadow('md', marca.mango),
        { transform: [{ translateY: flotar.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] },
      ]}
    >
      <View style={styles.medallaInterior}>
        <LinearGradient
          colors={[lighten(marca.mango, 0.3), marca.mango]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.medallaEmoji}>🏆</Text>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((palette) => ({
  centro: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  heroe: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.xs },
  medalla: { width: 60, height: 60, borderRadius: 30, marginBottom: space.lg },
  medallaInterior: {
    flex: 1,
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallaEmoji: { fontSize: 29, lineHeight: 36 },

  ganaste: { alignSelf: 'stretch', borderRadius: radius.xxl },
  ganasteInterior: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: space.lg + 6,
    paddingHorizontal: space.lg,
  },
  brillo: {
    position: 'absolute',
    top: -40,
    left: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: withAlpha(palette.white, 0.12),
  },
  ganasteEtiqueta: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.1,
    color: withAlpha(palette.white, 0.88),
  },
  ganasteCifra: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 72, lineHeight: 80, color: palette.white },
  ganasteNota: { fontFamily: 'Nunito_700Bold', fontSize: 16, lineHeight: 22, color: palette.white },

  metricas: { alignSelf: 'stretch', flexDirection: 'row', gap: space.md },
  metrica: {
    flex: 1,
    alignItems: 'center',
    padding: space.md + 3,
    borderRadius: radius.lg + 2,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  metricaValor: { fontFamily: 'Baloo2_800ExtraBold', fontSize: 25, lineHeight: 32 },

  mensaje: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: 26,
    backgroundColor: palette.surfaceRaised,
  },
  mensajeTexto: { flex: 1 },
}));
