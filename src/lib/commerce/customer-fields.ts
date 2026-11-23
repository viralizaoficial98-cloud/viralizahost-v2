// Campos dos dados do cliente: validação partilhada pelo navegador e pelo servidor.

export interface CustomerData {
  full_name: string
  phone: string
  country: string
  address: string
  city: string
  state: string
  company_name: string
  tax_id: string
}
export type CustomerField = keyof CustomerData

export const REQUIRED_FIELDS: CustomerField[] = ['full_name', 'phone', 'country', 'address', 'city']
export const FIELD_LABEL: Record<CustomerField, string> = {
  full_name: 'Nome completo', phone: 'Telefone', country: 'País', address: 'Morada', city: 'Cidade',
  state: 'Província', company_name: 'Empresa', tax_id: 'NIF',
}
export const COUNTRIES: Record<string, string> = { AO: 'Angola', PT: 'Portugal', BR: 'Brasil', MZ: 'Moçambique', CV: 'Cabo Verde', ST: 'São Tomé e Príncipe', GW: 'Guiné-Bissau', OTHER: 'Outro' }

/** Erro de validação por campo (vazio = válido). Também usado para os campos opcionais preenchidos. */
export function fieldError(field: CustomerField, value: string): string {
  const v = value.trim()
  const required = REQUIRED_FIELDS.includes(field)
  if (!v) return required ? `${FIELD_LABEL[field]} é obrigatório.` : ''
  switch (field) {
    case 'full_name': return v.length >= 3 && /\p{L}/u.test(v) ? '' : 'Indique o nome completo.'
    case 'phone': { const d = v.replace(/\D/g, ''); return /^[+\d\s().-]+$/.test(v) && d.length >= 9 && d.length <= 15 ? '' : 'Telefone inválido (ex.: +244 923 000 000).' }
    case 'country': return COUNTRIES[v] ? '' : 'País inválido.'
    case 'address': return v.length >= 5 ? '' : 'Indique a morada completa.'
    case 'city': return v.length >= 2 ? '' : 'Indique a cidade.'
    case 'tax_id': return /^[A-Za-z0-9./-]{5,20}$/.test(v) ? '' : 'NIF inválido.'
    default: return ''
  }
}

export function missingFields(d: CustomerData): CustomerField[] {
  return REQUIRED_FIELDS.filter(f => fieldError(f, d[f] ?? '') !== '')
}
