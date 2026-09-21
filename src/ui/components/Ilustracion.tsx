import { Text, View } from 'react-native';

import type { Figura as DatosFigura, Ilustracion as DatosIlustracion } from '@/domain/ilustracion';
import { Escena } from '@/ui/components/Escena';
import { Figura } from '@/ui/components/Figura';
import { makeStyles } from '@/ui/makeStyles';
import { radius, space } from '@/ui/theme';

/** Dibujo que acompaña al enunciado de un reto: filas de figuras o una escena. */
export function Ilustracion({ ilustracion }: { ilustracion: DatosIlustracion }) {
  if (ilustracion.tipo === 'escena') return <Escena escena={ilustracion.escena} />;
  return <FilasDeFiguras filas={ilustracion.filas} />;
}

/**
 * El tamaño depende de la fila más larga: una serie de doce figuras tiene que
 * caber sin desplazarse, y una sola figura se ve mejor grande.
 */
function tamanoPara(mayor: number): number {
  if (mayor <= 3) return 64;
  if (mayor <= 5) return 50;
  if (mayor <= 7) return 38;
  return 24;
}

function FilasDeFiguras({ filas }: { filas: readonly (readonly (DatosFigura | null)[])[] }) {
  const styles = useStyles();
  const mayor = Math.max(...filas.map((fila) => fila.length));
  const tamano = tamanoPara(mayor);
  // Una serie partida en dos renglones ya no se lee como una serie: con filas
  // largas se aprieta el espacio para que quepan diez figuras en un teléfono.
  const espacio = mayor > 7 ? 3 : space.xs + 2;

  return (
    <View
      style={styles.marco}
      // El enunciado ya dice qué hay que hacer; las figuras se nombran en las
      // opciones, que es donde el lector de pantalla las necesita.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {filas.map((fila, i) => (
        <View key={i} style={[styles.fila, { gap: espacio }]}>
          {fila.map((figura, j) =>
            figura ? (
              <Figura key={j} figura={figura} tamano={tamano} />
            ) : (
              // El hueco es lo que el menor tiene que completar: se marca con el
              // color de acento para que la vista vaya directo a él.
              <View key={j} style={[styles.hueco, { width: tamano, height: tamano }]}>
                <Text style={[styles.huecoTexto, { fontSize: tamano * 0.5, lineHeight: tamano * 0.62 }]}>?</Text>
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((palette) => ({
  marco: {
    alignSelf: 'stretch',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceRaised,
  },
  fila: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' },
  hueco: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  huecoTexto: { fontFamily: 'Baloo2_800ExtraBold', color: palette.accent },
}));
