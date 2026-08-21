import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { audit, listBlockedApps, setBlockedApps } from '@/data/repositories/policy';
import { screenTime, type InstalledApp } from '@/screentime';
import { useActiveChild, useAppStore } from '@/state/appStore';
import {
  Button,
  Card,
  EmptyState,
  Gap,
  Notice,
  Row,
  Screen,
  Txt,
} from '@/ui/components/primitives';
import { MIN_TOUCH_TARGET, palette, radius, space, typography } from '@/ui/theme';

import { useParentSession } from './_layout';

/**
 * Selección de apps a limitar.
 *
 * La pantalla se bifurca según `selectionMode`, que declara el adaptador
 * nativo. En Android se pinta la lista de paquetes instalados; en iOS se abre
 * el selector del sistema, porque la app no tiene —ni puede tener— acceso a
 * esa lista. Es la ramificación que justifica que el contrato del puente
 * exponga la diferencia en lugar de esconderla.
 */
export default function AppsScreen() {
  const session = useParentSession();
  const child = useActiveChild();
  const capabilities = useAppStore((state) => state.capabilities);
  const syncPolicy = useAppStore((state) => state.syncPolicy);

  if (!session.unlocked) return <Redirect href="/(parent)/unlock" />;
  if (!child || !capabilities) return null;

  return capabilities.selectionMode === 'system_picker' ? (
    <SystemPickerMode onSynced={syncPolicy} />
  ) : (
    <PackageListMode childId={child.id} onSynced={syncPolicy} />
  );
}

// ---------------------------------------------------------------------------
// Android: lista de paquetes
// ---------------------------------------------------------------------------

function PackageListMode({ childId, onSynced }: { childId: string; onSynced: () => Promise<void> }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [showSystem, setShowSystem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [installed, blocked] = await Promise.all([
        screenTime.listInstalledApps(),
        listBlockedApps(childId),
      ]);
      if (cancelled) return;
      setApps(installed);
      setSelected(new Set(blocked.map((app) => app.packageName)));
    })();

    return () => {
      cancelled = true;
    };
  }, [childId]);

  const visible = useMemo(() => {
    if (!apps) return [];
    const needle = query.trim().toLocaleLowerCase('es');

    return apps.filter((app) => {
      // Las apps de sistema se ocultan por omisión: bloquear el marcador o los
      // ajustes no es control parental, es dejar el teléfono inservible.
      if (app.isSystem && !showSystem && !selected.has(app.packageName)) return false;
      return needle.length === 0 || app.label.toLocaleLowerCase('es').includes(needle);
    });
  }, [apps, query, showSystem, selected]);

  const toggle = (packageName: string) => {
    setSaved(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(packageName)) next.delete(packageName);
      else next.add(packageName);
      return next;
    });
  };

  const save = async () => {
    if (!apps) return;
    setSaving(true);
    try {
      const chosen = apps.filter((app) => selected.has(app.packageName));
      await setBlockedApps(
        childId,
        chosen.map((app) => ({ packageName: app.packageName, appLabel: app.label })),
      );
      await audit('apps_actualizadas', `${chosen.length} apps`, childId);
      await onSynced();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!apps) {
    return (
      <Screen>
        <Txt variant="body" color={palette.textMuted}>
          Leyendo las apps instaladas…
        </Txt>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View>
          {saved ? (
            <>
              <Txt variant="caption" color={palette.success} align="center">
                Guardado. El bloqueo ya está aplicado.
              </Txt>
              <Gap size="sm" />
            </>
          ) : null}
          <Button
            label={`Guardar (${selected.size} app${selected.size === 1 ? '' : 's'})`}
            onPress={save}
            loading={saving}
          />
        </View>
      }
    >
      <Txt variant="body" color={palette.textMuted}>
        Marca las apps de ocio que quieres condicionar a resolver retos. El resto sigue disponible
        siempre.
      </Txt>

      <Gap size="lg" />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar app…"
        placeholderTextColor={palette.textFaint}
        style={styles.search}
        accessibilityLabel="Buscar app"
      />

      <Gap size="md" />
      <Row justify="space-between">
        <Txt variant="caption" color={palette.textMuted}>
          {visible.length} apps
        </Txt>
        <Pressable onPress={() => setShowSystem((value) => !value)} hitSlop={8}>
          <Txt variant="caption" color={palette.accentSoft}>
            {showSystem ? 'Ocultar apps del sistema' : 'Mostrar apps del sistema'}
          </Txt>
        </Pressable>
      </Row>

      <Gap size="md" />

      {showSystem ? (
        <>
          <Notice tone="warning" title="Cuidado con las apps del sistema">
            Bloquear el teléfono, los mensajes o los ajustes puede dejar el dispositivo inutilizable
            e impedir que el menor te contacte en una urgencia.
          </Notice>
          <Gap size="md" />
        </>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="Sin resultados"
          description="Prueba con otro nombre o muestra también las apps del sistema."
        />
      ) : (
        visible.map((app) => {
          const isSelected = selected.has(app.packageName);
          return (
            <Pressable
              key={app.packageName}
              onPress={() => toggle(app.packageName)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={app.label}
              style={[styles.appRow, isSelected && styles.appRowSelected]}
            >
              {app.iconBase64 ? (
                <Image
                  source={{ uri: `data:image/png;base64,${app.iconBase64}` }}
                  style={styles.icon}
                />
              ) : (
                <View style={[styles.icon, styles.iconFallback]}>
                  <Txt variant="bodyStrong">{app.label.charAt(0).toUpperCase()}</Txt>
                </View>
              )}

              <View style={styles.appText}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {app.label}
                </Txt>
                {app.isSystem ? (
                  <Txt variant="caption" color={palette.warning}>
                    app del sistema
                  </Txt>
                ) : null}
              </View>

              <Txt variant="title" color={isSelected ? palette.accent : palette.textFaint}>
                {isSelected ? '☑' : '☐'}
              </Txt>
            </Pressable>
          );
        })
      )}

      <Gap size="xxl" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// iOS: selector del sistema
// ---------------------------------------------------------------------------

function SystemPickerMode({ onSynced }: { onSynced: () => Promise<void> }) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void screenTime.getSelectionCount().then(setCount);
  }, []);

  const openPicker = async () => {
    setBusy(true);
    try {
      const selectedCount = await screenTime.presentAppPicker();
      setCount(selectedCount);
      await onSynced();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Notice tone="info" title="En iOS la selección la gestiona el sistema">
        Apple no permite que NEUROpass vea qué apps tienes instaladas. El selector es de iOS y la
        app solo recibe una referencia anónima de lo que elijas.
      </Notice>

      <Gap size="xl" />

      <Card raised>
        <Txt variant="caption" color={palette.textMuted}>
          Seleccionado actualmente
        </Txt>
        <Gap size="sm" />
        <Txt variant="display">{count ?? '—'}</Txt>
        <Txt variant="caption" color={palette.textMuted}>
          apps o categorías
        </Txt>
      </Card>

      <Gap size="xl" />
      <Button label="Elegir apps a limitar" onPress={openPicker} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    ...(typography.body as object),
    color: palette.text,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  appRow: {
    minHeight: MIN_TOUCH_TARGET + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  appRowSelected: { borderColor: palette.accent, backgroundColor: palette.surfaceRaised },
  icon: { width: 40, height: 40, borderRadius: radius.sm },
  iconFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceRaised,
  },
  appText: { flex: 1 },
});
