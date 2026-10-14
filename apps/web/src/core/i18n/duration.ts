// Duraciones en el idioma de la interfaz: «2 h 15 min», «2 h y 15 min»,
// «2 h i 15 min». Con sus dos unidades mayores, que es lo que se lee de un
// vistazo: nadie necesita los segundos de un tiempo medio de respuesta de
// dos días.

type DurationUnit = 'days' | 'hours' | 'minutes' | 'seconds';
type DurationParts = Partial<Record<DurationUnit, number>>;

// `Intl.DurationFormat` existe en los navegadores actuales y en Node 24, pero
// el `lib` de TypeScript del proyecto (ES2023) aún no lo describe.
type DurationFormatConstructor = new (
  locale: string,
  options: { style: 'short' },
) => { format: (duration: DurationParts) => string };

const NUMBER_UNITS: Record<DurationUnit, string> = {
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
  seconds: 'second',
};

export function formatDuration(totalSeconds: number, language: string): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const all: Array<[DurationUnit, number]> = [
    ['days', Math.floor(seconds / 86_400)],
    ['hours', Math.floor((seconds % 86_400) / 3_600)],
    ['minutes', Math.floor((seconds % 3_600) / 60)],
    ['seconds', seconds % 60],
  ];
  const first = all.findIndex(([, value]) => value > 0);
  const parts: Array<[DurationUnit, number]> =
    first === -1
      ? [['seconds', 0]]
      : all.slice(first, first + 2).filter(([, value]) => value > 0);

  const DurationFormat = (
    Intl as unknown as { DurationFormat?: DurationFormatConstructor }
  ).DurationFormat;
  if (DurationFormat)
    return new DurationFormat(language, { style: 'short' }).format(
      Object.fromEntries(parts),
    );
  // Sin él, una unidad tras otra: menos natural («2 h 15 min» sin la «y»),
  // pero igual de correcto en cualquier idioma.
  return parts
    .map(([unit, value]) =>
      new Intl.NumberFormat(language, {
        style: 'unit',
        unit: NUMBER_UNITS[unit],
        unitDisplay: 'short',
      }).format(value),
    )
    .join(' ');
}
