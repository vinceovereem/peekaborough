// Line colours (approximate TfL palette) and live status from TfL's open API (no key needed at this volume).
export const LINE_COLOURS: Record<string, string> = {
  victoria: '#0098d4', piccadilly: '#003688', mildmay: '#437ec1', windrush: '#dc241f', suffragette: '#18a95d',
  'great-northern': '#5c2d91', thameslink: '#e9438d', northern: '#000000', circle: '#ffd329', 'hammersmith-city': '#f4a9be',
  metropolitan: '#9b0058', elizabeth: '#6950a1',
}
/** Lines whose colour is too pale for white text. */
export const PALE_LINES = new Set(['circle', 'hammersmith-city'])

/** line id -> "Good Service" / "Minor Delays" …; empty if TfL can't be reached. */
export async function lineStatus(ids: string[]): Promise<Record<string, string>> {
  try {
    const res = await fetch(`https://api.tfl.gov.uk/Line/${ids.join(',')}/Status`, { next: { revalidate: 120 } })
    if (!res.ok) return {}
    const lines = await res.json() as { id: string; lineStatuses: { statusSeverityDescription: string }[] }[]
    return Object.fromEntries(lines.map(l => [l.id, l.lineStatuses[0]?.statusSeverityDescription ?? '']))
  } catch { return {} }
}
