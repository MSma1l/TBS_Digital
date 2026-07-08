import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained build at .next/standalone (server.js + only the
  // node_modules actually traced as needed). Lets the Docker runtime image
  // ship without node_modules or a full `next start`.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/output.md
  output: "standalone",
};

export default nextConfig;
