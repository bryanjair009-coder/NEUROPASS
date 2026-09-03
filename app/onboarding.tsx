import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { AGE_BANDS, AGE_BAND_LABEL, type AgeBand } from '@/domain/age';
import { createChild } from '@/data/repositories/children';
import { audit } from '@/data/repositories/policy';
import { useAppStore } from '@/state/appStore';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, validatePinStrength } from '@/security/pin';
import { formatRecoveryCode, setPin } from '@/security/pinStore';
import {
  Button,
  Card,
  Gap,
  Notice,
  ProgressBar,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { radius, space, typography } from '@/ui/theme';

/**
 * Configuración inicial, en cuatro pasos.
 *
 * El orden no es arbitrario. El PIN va primero porque es lo que protege todo
 * lo demás: si el perfil del menor se creara antes, existiría una ventana —por
 * corta que sea— en la que la app está configurada y cualquiera puede cambiar
 * los límites. Y el código de recuperación se muestra inmediatamente después,
 * en su propio paso, porque un tutor que olvide el PIN sin él pierde el acceso
 * a la configuración de forma definitiva.
 */

type Step = 'bienvenida' | 'pin' | 'recuperacion' | 'menor';

const AVATARS = ['🦊', '🐼', '🦉', '🐙', '🦕', '🐧', '🦁', '🐢', '🦋', '🐳'] as const;

export default function Onboarding() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const unlockParent = useAppStore((state) => state.unlockParent);
  const pinConfigured = useAppStore((state) => state.pinConfigured);

  const [step, setStep] = useState<Step>(pinConfigured ? 'menor' : 'bienvenida');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const stepIndex = { bienvenida: 0, pin: 1, recuperacion: 2, menor: 3 }[step];

  return (
    <Screen>
      <ProgressBar value={(stepIndex + 1) / 4} />
      <Gap size="xl" />

      {step === 'bienvenida' ? <Welcome onNext={() => setStep('pin')} /> : null}

      {step === 'pin' ? (
        <PinStep
          onDone={(code) => {
            setRecoveryCode(code);
            setStep('recuperacion');
          }}
        />
      ) : null}

      {step === 'recuperacion' && recoveryCode ? (
        <RecoveryStep code={recoveryCode} onNext={() => setStep('menor')} />
      ) : null}

      {step === 'menor' ? (
        <ChildStep
          onDone={async () => {
            await bootstrap();
            // Quien acaba de elegir el PIN ya demostró conocerlo: pedírselo otra
            // vez al instante es fricción sin ninguna ganancia de seguridad.
            unlockParent();
            router.replace('/(parent)/dashboard');
          }}
        />
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Welcome({ onNext }: { onNext: () => void }) {
  const palette = usePalette();
  return (
    <View>
      <Txt variant="display">NEUROpass</Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted}>
        El tiempo de pantalla se gana resolviendo retos de matemáticas, lógica, memoria, lenguaje y
        creatividad, ajustados a la edad.
      </Txt>

      <Gap size="xl" />

      <Card>
        <Txt variant="heading">Cómo funciona</Txt>
        <Gap size="md" />
        <Bullet emoji="🎯" text="Tú eliges qué apps se limitan y en qué horarios." />
        <Bullet emoji="🧠" text="El menor resuelve una sesión corta de retos para desbloquear minutos." />
        <Bullet emoji="📈" text="La dificultad se ajusta sola al nivel real de cada pilar." />
        <Bullet emoji="🔒" text="Todo se guarda solo en este dispositivo. Nada viaja a internet." />
      </Card>

      <Gap size="xl" />
      <Notice tone="info" title="Antes de empezar">
        Instala NEUROpass en el teléfono del menor, no en el tuyo. Es el dispositivo donde se aplican
        los límites.
      </Notice>

      <Gap size="xl" />
      <Button label="Comenzar" onPress={onNext} />
    </View>
  );
}

function Bullet({ emoji, text }: { emoji: string; text: string }) {
  const palette = usePalette();
  const styles = useStyles();
  return (
    <Row gap="md" align="flex-start" style={styles.bullet}>
      <Txt variant="body">{emoji}</Txt>
      <Txt variant="body" color={palette.textMuted} style={styles.bulletText}>
        {text}
      </Txt>
    </Row>
  );
}

// ---------------------------------------------------------------------------

function PinStep({ onDone }: { onDone: (recoveryCode: string) => void }) {
  const palette = usePalette();
  const [pin, setPinValue] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const strength = validatePinStrength(pin);
  const matches = pin.length > 0 && pin === confirmation;
  const canSubmit = strength.ok && matches && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { recoveryCode } = await setPin(pin);
      await audit('pin_configurado');
      onDone(recoveryCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el PIN.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Txt variant="title">Crea tu PIN</Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted}>
        Es lo que impide que el menor cambie sus propios límites. Elige uno que no pueda adivinar:
        nada de fechas de nacimiento ni secuencias.
      </Txt>

      <Gap size="xl" />

      <PinField label="PIN" value={pin} onChange={setPinValue} />
      <Gap size="md" />
      <PinField label="Repite el PIN" value={confirmation} onChange={setConfirmation} />

      <Gap size="md" />

      {/* El motivo del rechazo se muestra mientras se escribe, no al enviar:
          descubrir la regla después de rellenar dos campos es frustrante. */}
      {pin.length >= PIN_MIN_LENGTH && !strength.ok ? (
        <Txt variant="caption" color={palette.warning}>
          {strength.reason}
        </Txt>
      ) : null}

      {confirmation.length > 0 && !matches ? (
        <Txt variant="caption" color={palette.warning}>
          Los dos PIN no coinciden.
        </Txt>
      ) : null}

      {error ? (
        <Txt variant="caption" color={palette.danger}>
          {error}
        </Txt>
      ) : null}

      <Gap size="xl" />
      <Button label="Guardar PIN" onPress={submit} disabled={!canSubmit} loading={busy} />
    </View>
  );
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const palette = usePalette();
  const styles = useStyles();
  return (
    <View>
      <Txt variant="caption" color={palette.textMuted}>
        {label}
      </Txt>
      <Gap size="xs" />
      <TextInput
        value={value}
        // Se filtran los no dígitos en la entrada en vez de rechazarlos al
        // validar: el teclado numérico de algunos fabricantes incluye símbolos.
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, PIN_MAX_LENGTH))}
        keyboardType="number-pad"
        secureTextEntry
        style={styles.pinInput}
        accessibilityLabel={label}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

function RecoveryStep({ code, onNext }: { code: string; onNext: () => void }) {
  const palette = usePalette();
  const styles = useStyles();
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <View>
      <Txt variant="title">Guarda este código</Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted}>
        Es la única forma de recuperar el acceso si olvidas el PIN. No se puede volver a mostrar.
      </Txt>

      <Gap size="xl" />

      <Card raised>
        <Txt variant="mono" align="center" style={styles.recoveryCode}>
          {formatRecoveryCode(code)}
        </Txt>
      </Card>

      <Gap size="md" />
      <Button
        label={copied ? 'Copiado' : 'Copiar al portapapeles'}
        variant="secondary"
        icon="📋"
        onPress={async () => {
          await Clipboard.setStringAsync(formatRecoveryCode(code));
          setCopied(true);
        }}
      />

      <Gap size="xl" />
      <Notice tone="warning" title="Guárdalo fuera de este teléfono">
        Anótalo en papel o guárdalo en tu gestor de contraseñas. Si lo dejas en este mismo
        dispositivo, no sirve de nada: quien tenga el teléfono lo tendrá también.
      </Notice>

      <Gap size="xl" />
      <Button
        label={confirmed ? 'Continuar' : 'Ya lo guardé'}
        onPress={() => (confirmed ? onNext() : setConfirmed(true))}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

function ChildStep({ onDone }: { onDone: () => Promise<void> }) {
  const palette = usePalette();
  const styles = useStyles();
  const [alias, setAlias] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [band, setBand] = useState<AgeBand>('9-12');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const child = await createChild({ alias, avatar, band });
      await audit('menor_creado', AGE_BAND_LABEL[band], child.id);
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Txt variant="title">¿Quién va a usar este teléfono?</Txt>
      <Gap size="sm" />
      <Txt variant="body" color={palette.textMuted}>
        Con un apodo basta. NEUROpass no pide ni guarda fecha de nacimiento, correo ni ningún otro
        dato personal del menor.
      </Txt>

      <Gap size="xl" />

      <Txt variant="caption" color={palette.textMuted}>
        Apodo
      </Txt>
      <Gap size="xs" />
      <TextInput
        value={alias}
        onChangeText={setAlias}
        placeholder="Sofi"
        placeholderTextColor={palette.textFaint}
        maxLength={40}
        style={styles.textInput}
        accessibilityLabel="Apodo del menor"
      />

      <Gap size="lg" />
      <Txt variant="caption" color={palette.textMuted}>
        Avatar
      </Txt>
      <Gap size="sm" />
      <Row gap="sm" wrap>
        {AVATARS.map((option) => (
          <Button
            key={option}
            label={option}
            variant={avatar === option ? 'primary' : 'secondary'}
            fullWidth={false}
            onPress={() => setAvatar(option)}
            style={styles.avatarButton}
          />
        ))}
      </Row>

      <Gap size="lg" />
      <Txt variant="caption" color={palette.textMuted}>
        Rango de edad
      </Txt>
      <Gap size="sm" />
      {AGE_BANDS.map((option) => (
        <View key={option} style={styles.bandOption}>
          <Button
            label={AGE_BAND_LABEL[option]}
            variant={band === option ? 'primary' : 'secondary'}
            onPress={() => setBand(option)}
          />
        </View>
      ))}

      <Gap size="xl" />
      <Button
        label="Crear perfil"
        onPress={submit}
        disabled={alias.trim().length === 0 || busy}
        loading={busy}
      />
    </View>
  );
}

const useStyles = makeStyles((palette) => ({
  bullet: { marginBottom: space.md },
  bulletText: { flexShrink: 1 },
  pinInput: {
    ...(typography.title as object),
    color: palette.text,
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingVertical: space.lg,
  },
  textInput: {
    ...(typography.body as object),
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  recoveryCode: { fontSize: 20, letterSpacing: 2, color: palette.accentSoft },
  avatarButton: { paddingHorizontal: space.lg },
  bandOption: { marginBottom: space.sm },
}));
