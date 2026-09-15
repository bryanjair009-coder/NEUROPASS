import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { AGE_BANDS, AGE_BAND_LABEL, type AgeBand } from '@/domain/age';
import { createChild } from '@/data/repositories/children';
import { audit } from '@/data/repositories/policy';
import { useAppStore } from '@/state/appStore';
import { PIN_MAX_LENGTH, PIN_MIN_LENGTH, validatePinStrength } from '@/security/pin';
import { formatRecoveryCode, setPin } from '@/security/pinStore';
import { Axo } from '@/ui/components/Axo';
import {
  Button,
  Card,
  Gap,
  Notice,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { makeStyles } from '@/ui/makeStyles';
import { usePalette } from '@/ui/ThemeProvider';
import { marca, radius, shadow, space, typography } from '@/ui/theme';

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

const PASOS: readonly Step[] = ['bienvenida', 'pin', 'recuperacion', 'menor'];

const AVATARS = ['🦊', '🐼', '🦉', '🐙', '🦕', '🐧', '🦁', '🐢', '🦋', '🐳'] as const;

export default function Onboarding() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const unlockParent = useAppStore((state) => state.unlockParent);
  const pinConfigured = useAppStore((state) => state.pinConfigured);

  const [step, setStep] = useState<Step>(pinConfigured ? 'menor' : 'bienvenida');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  return (
    // Las formas de fondo solo acompañan a la bienvenida: en el PIN y el
    // código de recuperación quien lee es un adulto concentrado en no
    // equivocarse, y cualquier movimiento ahí estorba.
    <Screen formas={step === 'bienvenida'}>
      <IndicadorPasos actual={PASOS.indexOf(step)} />
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

/**
 * Píldoras de progreso. La activa se estira en vez de cambiar solo de color:
 * se distingue igual con cualquier tipo de daltonismo.
 */
function IndicadorPasos({ actual }: { actual: number }) {
  const palette = usePalette();
  const styles = useStyles();
  return (
    <View
      style={styles.pasos}
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${actual + 1} de ${PASOS.length}`}
    >
      {PASOS.map((paso, indice) => (
        <View
          key={paso}
          style={[
            styles.paso,
            indice === actual
              ? { width: 42, backgroundColor: palette.accent }
              : { width: 14, backgroundColor: palette.accentSoft },
          ]}
        />
      ))}
    </View>
  );
}

function Welcome({ onNext }: { onNext: () => void }) {
  const palette = usePalette();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.axoBienvenida}>
        <Axo ancho={176} expresion="cuerpo" tinte={marca.aqua} />
      </View>
      <Gap size="lg" />
      <Txt variant="display" align="center">
        ¡Hola! Soy AXO
      </Txt>
      <Gap size="sm" />
      <Txt variant="body" align="center" color={palette.textMuted} style={styles.subtitulo}>
        Tu erizo cibernético. Entreno contigo, y cada reto que resuelves carga minutos de juego de
        verdad.
      </Txt>

      <Gap size="xl" />
      <Beneficio emoji="🎯" fondo={palette.pastelAqua} texto="Tu familia elige qué apps se abren y cuándo" />
      <Beneficio emoji="🧠" fondo={palette.accentSoft} texto="Resuelves retos cortos y ganas minutos" />
      <Beneficio emoji="📈" fondo={palette.pastelLima} texto="Los retos se ajustan solos a tu nivel" />

      <Gap size="sm" />
      {/* Lo que un adulto necesita saber antes de seguir, sin ocupar una tarjeta
          entera: dónde se instala y que nada sale del teléfono. */}
      <Txt variant="caption" align="center" color={palette.textMuted}>
        Instala NEUROpass en el teléfono del menor. Todo se guarda solo en ese dispositivo.
      </Txt>

      <Gap size="xl" />
      <Button label="¡Vamos allá!" onPress={onNext} />
    </View>
  );
}

function Beneficio({ emoji, fondo, texto }: { emoji: string; fondo: string; texto: string }) {
  const styles = useStyles();
  return (
    <View style={styles.beneficio}>
      <View style={[styles.beneficioIcono, { backgroundColor: fondo }]}>
        <Text style={styles.beneficioEmoji}>{emoji}</Text>
      </View>
      <Txt variant="bodyStrong" style={styles.beneficioTexto}>
        {texto}
      </Txt>
    </View>
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
  pasos: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  paso: { height: 7, borderRadius: radius.pill },

  axoBienvenida: { alignItems: 'center' },
  subtitulo: { maxWidth: 302, alignSelf: 'center' },
  beneficio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md + 2,
    marginBottom: space.sm + 3,
    paddingVertical: space.md + 2,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    ...shadow('sm'),
  },
  beneficioIcono: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beneficioEmoji: { fontSize: 22, lineHeight: 28 },
  beneficioTexto: { flex: 1 },

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
  recoveryCode: { fontSize: 20, letterSpacing: 2, color: palette.accent },
  avatarButton: { paddingHorizontal: space.lg },
  bandOption: { marginBottom: space.sm },
}));
