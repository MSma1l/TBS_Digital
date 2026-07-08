import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained build at .next/standalone (server.js + only the
  // node_modules actually traced as needed). Lets the Docker runtime image
  // ship without node_modules or a full `next start`.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/output.md
  output: "standalone",

  // Security headers applied to every route (clickjacking / MIME-sniffing /
  // referrer-leak hardening — the admin page in particular must never be
  // frameable). HSTS is intentionally omitted here: the reverse proxy /
  // backend owns TLS headers.
  // Ref: node_modules/next/dist/docs/.../05-config/01-next-config-js/headers.md
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
