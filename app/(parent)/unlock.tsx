import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { audit } from '@/data/repositories/policy';
import { formatRemaining } from '@/security/lockout';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH } from '@/security/pin';
import { lockStatus, resetWithRecoveryCode, unlock } from '@/security/pinStore';
import { useAppStore } from '@/state/appStore';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { Button, Card, Gap, Notice, Screen, Txt } from '@/ui/components/primitives';
import { MIN_TOUCH_TARGET, radius, shadow, space, typography } from '@/ui/theme';

import { useParentSession } from './_layout';

/**
 * Pantalla de PIN.
 *
 * El detalle importante está en qué se le dice a quien falla. No se revela
 * cuántos intentos quedan hasta que la penalización ya empezó: anunciarlo
 * desde el primer fallo le enseña al menor exactamente cuándo parar para no
 * activar el bloqueo, y le regala información gratis sobre el mecanismo.
 *
 * El teclado es propio y no el del sistema. En un teléfono pequeño el del
 * sistema tapa media pantalla, incluido el aviso de bloqueo; y un teclado de
 * terceros instalado en el teléfono del menor puede aprender o sugerir lo que
 * se escribe, cosa que un PIN no debería pasar nunca.
 */

type Tecla = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'borrar';

/** `null` es el hueco de la última fila, a la izquierda del cero. */
const TECLAS: readonly (Tecla | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'borrar'];

export default function UnlockScreen() {
  const palette = usePalette();
  const styles = useStyles();
  const session = useParentSession();
  const refreshCapabilities = useAppStore((state) => state.refreshCapabilities);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockedFor, setLockedFor] = useState<number>(0);
  const [showRecovery, setShowRecovery] = useState(false);

  // Si ya se llega bloqueado, se muestra desde el principio en lugar de
  // esperar a que la persona escriba un PIN que no se va a evaluar.
  useEffect(() => {
    void lockStatus().then((status) => setLockedFor(status.locked ? status.remainingMs : 0));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);

    const result = await unlock(pin);
    setBusy(false);
    setPin('');

    if (result.ok) {
      session.unlock();
      await refreshCapabilities();
      router.replace('/(parent)/dashboard');
      return;
    }

    switch (result.reason) {
      case 'sin_pin':
        router.replace('/onboarding');
        break;
      case 'bloqueado':
        setLockedFor(result.status.remainingMs);
        break;
      case 'incorrecto':
        setLockedFor(result.status.locked ? result.status.remainingMs : 0);
        setError(
          result.status.locked
            ? null
            : result.status.attemptsBeforeDelay === 0
              ? 'PIN incorrecto. El siguiente intento fallido activará una espera.'
              : 'PIN incorrecto.',
        );
        break;
    }
  };

  if (showRecovery) {
    return <RecoveryFlow onCancel={() => setShowRecovery(false)} />;
  }

  const blocked = lockedFor > 0;
  const inerte = blocked || busy;
  const puedeEntrar = pin.length >= PIN_MIN_LENGTH && !inerte;
  // Seis puntos, que es la longitud mínima; si el PIN es más largo aparecen
  // los que falten. Con puntos fijos, quien eligió ocho dígitos creería que se
  // le acabó el espacio a mitad de escribirlo.
  const huecos = Math.max(PIN_MIN_LENGTH, pin.length);

  const pulsar = (tecla: Tecla) => {
    setError(null);
    setPin((actual) =>
      tecla === 'borrar' ? actual.slice(0, -1) : actual.length < PIN_MAX_LENGTH ? actual + tecla : actual,
    );
  };

  return (
    <SafeAreaView style={styles.pantalla} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
        <View style={styles.candado}>
          <Text style={styles.candadoEmoji}>🔒</Text>
        </View>
        <Gap size="md" />
        <Text style={styles.titulo} accessibilityRole="header">
          Zona de tutores
        </Text>
        <Gap size="xs" />
        <Txt variant="body" align="center" color={palette.textMuted}>
          Escribe tu PIN para cambiar límites, horarios y apps
        </Txt>

        <Gap size="xl" />
        <View
          style={styles.puntos}
          accessible
          accessibilityLabel={`${pin.length} ${pin.length === 1 ? 'dígito escrito' : 'dígitos escritos'}`}
        >
          {Array.from({ length: huecos }, (_, indice) => (
            <View
              key={indice}
              style={[styles.punto, { backgroundColor: indice < pin.length ? palette.accent : palette.arcadePista }]}
            />
          ))}
        </View>

        {blocked ? (
          <>
            <Gap size="lg" />
            <Notice tone="warning" title={`Demasiados intentos · espera ${formatRemaining(lockedFor)}`}>
              El tiempo de espera crece con cada fallo. Si olvidaste el PIN, usa tu código de
              recuperación.
            </Notice>
          </>
        ) : null}

        {error ? (
          <>
            <Gap size="md" />
            <Txt variant="caption" color={palette.danger} align="center">
              {error}
            </Txt>
          </>
        ) : null}

        <Gap size="xl" />
        <View style={styles.teclado}>
          {TECLAS.map((tecla, indice) =>
            tecla === null ? (
              <View key={`hueco-${indice}`} style={styles.tecla} />
            ) : (
              <Pressable
                key={tecla}
                onPress={() => pulsar(tecla)}
                disabled={inerte}
                accessibilityRole="button"
                accessibilityLabel={tecla === 'borrar' ? 'Borrar el último dígito' : tecla}
                style={({ pressed }) => [
                  styles.tecla,
                  styles.teclaVisible,
                  pressed && styles.teclaPulsada,
                  inerte && styles.inerte,
                ]}
              >
                <Text style={styles.teclaTexto}>{tecla === 'borrar' ? '⌫' : tecla}</Text>
              </Pressable>
            ),
          )}
        </View>

        <Gap size="lg" />
        <Pressable
          onPress={submit}
          disabled={!puedeEntrar}
          accessibilityRole="button"
          accessibilityLabel="Entrar"
          accessibilityState={{ disabled: !puedeEntrar, busy }}
          style={({ pressed }) => [styles.entrar, !puedeEntrar && styles.inerte, pressed && styles.entrarPulsado]}
        >
          {busy ? (
            <ActivityIndicator color={palette.base} />
          ) : (
            <Text style={styles.entrarTexto}>Entrar</Text>
          )}
        </Pressable>

        <View style={styles.enlaces}>
          <Pressable
            onPress={() => setShowRecovery(true)}
            accessibilityRole="button"
            style={styles.enlace}
          >
            <Text style={styles.enlaceTexto}>Olvidé mi PIN</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(child)/home')}
            accessibilityRole="button"
            style={styles.enlace}
          >
            <Text style={[styles.enlaceTexto, styles.enlaceSuave]}>Volver</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

function RecoveryFlow({ onCancel }: { onCancel: () => void }) {
  const palette = usePalette();
  const styles = useStyles();
  const session = useParentSession();

  const [code, setCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMessage(null);

    const result = await resetWithRecoveryCode(code, newPin);
    setBusy(false);

    if (!result.ok) {
      setMessage(result.reason);
      return;
    }

    await audit('pin_restablecido');
    session.unlock();
    // El código nuevo se muestra en Ajustes, no aquí: en medio de una
    // recuperación la persona está buscando entrar, no anotar otro código.
    router.replace('/(parent)/settings');
  };

  return (
    <Screen>
      <Gap size="xxl" />
      <Txt variant="title">Recuperar acceso</Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted}>
        Escribe el código de 16 caracteres que guardaste al configurar NEUROpass y elige un PIN
        nuevo.
      </Txt>

      <Gap size="xl" />

      <Card>
        <Txt variant="caption" color={palette.textMuted}>
          Código de recuperación
        </Txt>
        <Gap size="xs" />
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          placeholderTextColor={palette.textFaint}
          style={styles.codeInput}
          accessibilityLabel="Código de recuperación"
        />

        <Gap size="lg" />

        <Txt variant="caption" color={palette.textMuted}>
          PIN nuevo
        </Txt>
        <Gap size="xs" />
        <TextInput
          value={newPin}
          onChangeText={(text) => setNewPin(text.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH))}
          keyboardType="number-pad"
          secureTextEntry
          style={styles.pinInput}
          accessibilityLabel="PIN nuevo"
        />
      </Card>

      {message ? (
        <>
          <Gap size="md" />
          <Txt variant="caption" color={palette.danger}>
            {message}
          </Txt>
        </>
      ) : null}

      <Gap size="xl" />
      <Button
        label="Restablecer PIN"
        onPress={submit}
        disabled={code.trim().length < 16 || newPin.length < PIN_MIN_LENGTH || busy}
        loading={busy}
      />
      <Gap size="md" />
      <Button label="Cancelar" variant="ghost" onPress={onCancel} />

      <View style={styles.spacer} />
    </Screen>
  );
}

const useStyles = makeStyles((palette) => ({
  pantalla: { flex: 1, backgroundColor: palette.surfaceRaised },
  contenido: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xxxl,
    paddingBottom: space.xl,
  },
  candado: {
    width: 70,
    height: 70,
    alignSelf: 'center',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoft,
  },
  candadoEmoji: { fontSize: 31, lineHeight: 38 },
  titulo: {
    fontFamily: 'Baloo2_700Bold',
    fontSize: 25,
    lineHeight: 30,
    color: palette.text,
    textAlign: 'center',
  },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: space.md },
  punto: { width: 18, height: 18, borderRadius: 9 },

  teclado: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  // `flexBasis` en vez de un ancho calculado: tres por fila con el hueco de en
  // medio, en cualquier ancho de pantalla, sin medir nada.
  tecla: { flexBasis: '30%', flexGrow: 1, height: 64, borderRadius: 24 },
  teclaVisible: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  teclaPulsada: { backgroundColor: palette.accentSoft },
  teclaTexto: { fontFamily: 'Baloo2_700Bold', fontSize: 23, lineHeight: 30, color: palette.text },
  inerte: { opacity: 0.45 },

  // El botón de entrar va en la tinta de la paleta y no en morado: en esta
  // pantalla el morado ya significa «dígito escrito», y un segundo uso lo
  // confundiría con un punto más.
  entrar: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.text,
  },
  entrarPulsado: { opacity: 0.85 },
  entrarTexto: { fontFamily: 'Baloo2_700Bold', fontSize: 17, lineHeight: 22, color: palette.base },
  enlaces: { marginTop: 'auto', paddingTop: space.lg, alignItems: 'center' },
  enlace: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: space.lg, justifyContent: 'center' },
  enlaceTexto: { fontFamily: 'Nunito_700Bold', fontSize: 14, lineHeight: 20, color: palette.textMuted },
  enlaceSuave: { opacity: 0.7 },

  pinInput: {
    ...(typography.title as object),
    color: palette.text,
    letterSpacing: 10,
    textAlign: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingVertical: space.lg,
  },
  codeInput: {
    ...(typography.mono as object),
    color: palette.text,
    textAlign: 'center',
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
  spacer: { height: space.xxxl },
}));
