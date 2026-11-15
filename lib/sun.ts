// Sunrise and sunset for a spot on a given day (the standard low-precision solar formulas, good to a
// couple of minutes — plenty for "is it worth sitting outside?").
const rad = Math.PI / 180, DAY = 86400000, J1970 = 2440588, J2000 = 2451545
const transit = (ds: number, M: number, L: number) => J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)

export function sunTimes(date: Date, lat: number, lng: number): { sunrise: Date; sunset: Date } {
  const lw = rad * -lng, phi = rad * lat
  const days = date.getTime() / DAY - 0.5 + J1970 - J2000
  const n = Math.round(days - 0.0009 - lw / (2 * Math.PI))
  const ds = 0.0009 + lw / (2 * Math.PI) + n
  const M = rad * (357.5291 + 0.98560028 * ds)
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI
  const dec = Math.asin(Math.sin(rad * 23.4397) * Math.sin(L))
  const noon = transit(ds, M, L)
  const w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)))
  const set = transit(0.0009 + (w + lw) / (2 * Math.PI) + n, M, L)
  const toDate = (j: number) => new Date((j + 0.5 - J1970) * DAY)
  return { sunrise: toDate(noon - (set - noon)), sunset: toDate(set) }
}
