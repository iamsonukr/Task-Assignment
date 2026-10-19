/** All browser calls go to /api/* on the Next origin and are proxied to the Nest backend,
 *  so the auth cookie is first-party (SameSite=Lax, HttpOnly) and no CORS is needed for REST. */
const BACKEND = (process.env.BACKEND_URL?.trim() || 'http://localhost:4000').replace(/\/+$/, '');
export default {
  async rewrites() { return [{ source: '/api/:path*', destination: `${BACKEND}/api/:path*` }]; },
  async headers() {
    return [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] }];
  },
};
