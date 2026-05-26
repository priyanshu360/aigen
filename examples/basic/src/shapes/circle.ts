import { aigen } from "@pynhu/aigen-runtime"

export function circleArea(radius: number): number {
  return aigen.computeArea("circle", radius)
}
