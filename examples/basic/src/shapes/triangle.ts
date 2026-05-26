import { aigen } from "@aigen/runtime"

export function triangleArea(base: number, height: number): number {
  return aigen.computeArea("triangle", base, height, { hint: "return area in square units" })
}
