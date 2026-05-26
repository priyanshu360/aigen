import { aigen } from "@aigen/runtime"

export function rectArea(width: number, height: number): number {
  return aigen.computeArea("rect", width, height)
}
