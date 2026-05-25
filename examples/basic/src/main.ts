import { aigen } from "@aigen/runtime"

// aigen will generate this function at build time.
// Try modifying the arguments or adding a hint string to steer generation.
const result = aigen.sayHello("world")
console.log(result)
