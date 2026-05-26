import { defineConfig } from "vite"
import { aigenPlugin } from "@pynhu/aigen-vite"

export default defineConfig({
  plugins: [
    aigenPlugin({
      agentDir: "../../../aigen-agent",
      // model: "anthropic/claude-sonnet-4",
    }),
  ],
})
