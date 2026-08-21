import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Gap, Notice, Screen, Txt } from '@/ui/components/primitives';
import { palette, space } from '@/ui/theme';

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

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <Txt style={styles.emoji}>{minutes > 0 ? (perfect ? '🏆' : '🎉') : '💪'}</Txt>

        <Gap size="lg" />
        <Txt variant="title" align="center">
          {minutes > 0 ? '¡Desbloqueaste tiempo!' : 'Buen intento'}
        </Txt>

        <Gap size="xl" />

        <Card raised style={styles.minutesCard}>
          <Txt variant="display" align="center" color={palette.success} style={styles.minutes}>
            +{minutes}
          </Txt>
          <Txt variant="caption" align="center" color={palette.textMuted}>
            {minutes === 1 ? 'minuto de juego' : 'minutos de juego'}
          </Txt>
        </Card>

        <Gap size="lg" />
        <Txt variant="body" color={palette.textMuted} align="center">
          Resolviste {correct} de {total} retos
          {perfect ? ' · sin un solo error' : ''}
        </Txt>

        {capped ? (
          <>
            <Gap size="lg" />
            <Notice tone="info" title="Llegaste al límite de hoy">
              Ganaste todos los minutos que tu familia configuró para un día. Mañana vuelve a contar
              desde cero.
            </Notice>
          </>
        ) : null}

        {minutes === 0 && total > 0 ? (
          <>
            <Gap size="lg" />
            <Notice tone="info" title="Los retos difíciles también cuentan">
              Equivocarse no resta nada. La próxima sesión te tocarán retos ajustados a tu nivel.
            </Notice>
          </>
        ) : null}
      </View>

      <Button label="Volver al inicio" onPress={() => router.replace('/(child)/home')} />
      <Gap size="lg" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  emoji: { fontSize: 72 },
  minutesCard: { alignSelf: 'stretch', paddingVertical: space.xl },
  minutes: { fontSize: 64, lineHeight: 70 },
});
