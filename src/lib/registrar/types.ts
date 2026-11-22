// Contrato comum dos fornecedores de registo de domínios.
// Regras: nenhuma função devolve ou regista segredos; um timeout nunca é tratado como
// sucesso nem como falha definitiva — fica «inconclusivo» e obriga a consultar o estado.

export type RegistrarOperation = 'register' | 'renew' | 'transfer'

export interface CheckResult {
  domain: string
  status: 'available' | 'unavailable' | 'unknown'
  message?: string
}

export interface OperationResult {
  /** succeeded: o fornecedor confirmou; pending: aceite mas ainda em curso no registo;
   *  failed: recusado (pode repetir-se depois de corrigir); unknown: sem resposta conclusiva */
  outcome: 'succeeded' | 'pending' | 'failed' | 'unknown'
  providerRef?: string | null
  providerStatus?: string | null
  message: string
}

export interface LookupResult extends OperationResult {
  /** false: o fornecedor não tem registo desta operação (seguro repetir) */
  found: boolean
}

export interface TestResult { ok: boolean; message: string; extensions?: string[] }

export interface RegistrarAdapter {
  testConnection(): Promise<TestResult>
  check(domain: string): Promise<CheckResult>
  register(input: { domain: string; years: number; clientRef: string; nameservers: string[] }): Promise<OperationResult>
  renew(input: { domain: string; years: number; clientRef: string }): Promise<OperationResult>
  transfer(input: { domain: string; authCode: string; clientRef: string }): Promise<OperationResult>
  /** Estado de uma operação já pedida, pela referência do nosso lado (idempotência). */
  lookup(input: { domain: string; clientRef: string; operation: RegistrarOperation }): Promise<LookupResult>
}

export class RegistrarTimeout extends Error {
  constructor(message = 'Sem resposta do registrador dentro do tempo limite.') { super(message) }
}
