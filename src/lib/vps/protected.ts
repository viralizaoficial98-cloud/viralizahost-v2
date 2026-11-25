// Infraestrutura de produção da ViralizaHost — protegida PERMANENTEMENTE contra qualquer operação do módulo Cloud VPS.
// VPS 1564781: KVM 4, 16 GB RAM, 200 GB, AlmaLinux 9 + cPanel. Módulo sem dependências (usado pelo cliente da API,
// pelas regras do módulo e pelos testes).
export const PROTECTED_VM_IDS = ['1564781'] as const

/**
 * Segunda barreira, no próprio cliente da API Hostinger: um pedido que ALTERA (não-GET) uma VM protegida nunca sai do
 * servidor, mesmo que uma rota, tarefa ou alteração futura se esqueça da verificação no módulo. Devolve a VM visada.
 */
export function protectedVmInRequest(method: string, path: string): string | null {
  if (method.toUpperCase() === 'GET') return null
  const p = path.split('?')[0]
  for (const id of PROTECTED_VM_IDS) {
    if (new RegExp(`/virtual-machines/${id}(?:/|$)`).test(p) || new RegExp(`/firewall/[^/]+/(?:activate|deactivate|sync)/${id}$`).test(p)) return id
  }
  return null
}
