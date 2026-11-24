import type { NextConfig } from "next";
import { CONSOLIDATED_REDIRECTS } from "./src/lib/site/pages";

// Security headers sent with every response.
// HSTS deliberately omits includeSubDomains: other subdomains (cPanel,
// webmail, server.*) are not guaranteed to serve HTTPS.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Páginas consolidadas na reorganização do menu: o URL antigo encaminha (308) para a secção equivalente
  async redirects() {
    return CONSOLIDATED_REDIRECTS.map(r => ({ ...r, permanent: true }));
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
