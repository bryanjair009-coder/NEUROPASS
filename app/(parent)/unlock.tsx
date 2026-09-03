import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { audit } from '@/data/repositories/policy';
import { formatRemaining } from '@/security/lockout';
import { PIN_MAX_LENGTH } from '@/security/pin';
import { lockStatus, resetWithRecoveryCode, unlock } from '@/security/pinStore';
import { useAppStore } from '@/state/appStore';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { Button, Card, Gap, Notice, Screen, Txt } from '@/ui/components/primitives';
import { radius, space, typography } from '@/ui/theme';

import { useParentSession } from './_layout';

/**
 * Pantalla de PIN.
 *
 * El detalle importante está en qué se le dice a quien falla. No se revela
 * cuántos intentos quedan hasta que la penalización ya empezó: anunciarlo
 * desde el primer fallo le enseña al menor exactamente cuándo parar para no
 * activar el bloqueo, y le regala información gratis sobre el mecanismo.
 */
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

  return (
    <Screen>
      <Gap size="xxl" />
      <Txt style={styles.emoji} align="center">
        🔒
      </Txt>
      <Gap size="lg" />
      <Txt variant="title" align="center">
        Panel de tutores
      </Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted} align="center">
        Escribe tu PIN para cambiar límites, horarios y apps.
      </Txt>

      <Gap size="xxl" />

      <TextInput
        value={pin}
        onChangeText={(text) => setPin(text.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH))}
        keyboardType="number-pad"
        secureTextEntry
        editable={!blocked && !busy}
        style={styles.pinInput}
        accessibilityLabel="PIN"
        autoFocus={!blocked}
      />

      <Gap size="lg" />

      {blocked ? (
        <Notice tone="warning" title={`Demasiados intentos · espera ${formatRemaining(lockedFor)}`}>
          El tiempo de espera crece con cada fallo. Si olvidaste el PIN, usa tu código de
          recuperación.
        </Notice>
      ) : null}

      {error ? (
        <Txt variant="caption" color={palette.danger} align="center">
          {error}
        </Txt>
      ) : null}

      <Gap size="lg" />
      <Button label="Entrar" onPress={submit} disabled={pin.length < 6 || blocked || busy} loading={busy} />

      <Gap size="md" />
      <Button label="Olvidé mi PIN" variant="ghost" onPress={() => setShowRecovery(true)} />

      <Gap size="md" />
      <Button label="Volver" variant="ghost" onPress={() => router.replace('/(child)/home')} />
    </Screen>
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
        disabled={code.trim().length < 16 || newPin.length < 6 || busy}
        loading={busy}
      />
      <Gap size="md" />
      <Button label="Cancelar" variant="ghost" onPress={onCancel} />

      <View style={styles.spacer} />
    </Screen>
  );
}

const useStyles = makeStyles((palette) => ({
  emoji: { fontSize: 56 },
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
