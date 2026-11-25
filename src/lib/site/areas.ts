// Áreas da aplicação (sem dependências de servidor; usado no proxy e no navegador).
// Área do Cliente e painel de administração: tudo o resto é público.
export const CLIENT_AREA_PATHS = ['/dashboard', '/domains', '/hosting', '/tickets', '/billing', '/settings', '/orders', '/services', '/vps']
// '/email' é a página da Área do Cliente; '/email/*' são páginas públicas.
export const CLIENT_AREA_EXACT = ['/email']
export const ADMIN_PATHS = ['/admin']

const under = (path: string, p: string) => path === p || path.startsWith(`${p}/`)
export const isClientArea = (path: string) => CLIENT_AREA_PATHS.some(p => under(path, p)) || CLIENT_AREA_EXACT.includes(path)
export const isAdminArea = (path: string) => ADMIN_PATHS.some(p => under(path, p))
/** Página pública (site, compra, autenticação): fora da Área do Cliente e do painel. */
export const isPublicPage = (path: string) => !isClientArea(path) && !isAdminArea(path)
