import { CharacterDirection, calcDirection } from '@yogiya/shared'

export { calcDirection }

/**
 * GPS heading(0=북, 시계방향 증가)을 8방향으로 변환합니다.
 * heading이 -1(유효하지 않음)이면 null을 반환합니다.
 */
export function headingToDirection(heading: number): CharacterDirection | null {
  if (heading < 0) return null

  // GPS heading: 0=북, 90=동, 180=남, 270=서
  // atan2 기준으로 변환: dy = cos(heading), dx = sin(heading)
  const rad = heading * (Math.PI / 180)
  const dx = Math.sin(rad)
  const dy = Math.cos(rad)
  return calcDirection(dx, dy)
}
