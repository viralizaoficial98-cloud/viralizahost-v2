// Validação de IBAN (ISO 13616), usada pelo servidor ao guardar e pelo painel para avisos.
// Regras: só remove espaços de formatação; mantém os zeros iniciais (texto, nunca número); maiúsculas.
// NUNCA acrescenta prefixos nem dígitos: um número de conta sem país/controlo é recusado com uma mensagem clara.

// Comprimento do IBAN por país (os mais prováveis para a ViralizaHost; outros países: 15–34 + controlo).
const LENGTH: Record<string, number> = {
  AO: 25, PT: 25, BR: 29, ES: 24, FR: 27, DE: 22, GB: 22, IT: 27, NL: 18, BE: 16, LU: 20, CH: 21, IE: 22,
  MZ: 25, CV: 25, ST: 25, GW: 25, TL: 23,
}

export type IbanCheck = { ok: true; iban: string } | { ok: false; code: 'empty' | 'chars' | 'account_number' | 'format' | 'length' | 'checksum'; error: string }

/** Remove espaços (incluindo não separáveis) e passa a maiúsculas. Não toca em mais nada. */
export const compactIban = (raw: unknown) => String(raw ?? '').replace(/[\s  ]+/g, '').toUpperCase()

/** Grupos de 4 para leitura (o valor guardado e copiado é o compacto). */
export const formatIban = (iban: string) => compactIban(iban).replace(/(.{4})(?=.)/g, '$1 ')

function mod97(s: string): number {
  // letras → números (A=10 … Z=35), processado em blocos para não perder precisão
  let rem = 0
  for (const ch of s) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of v) rem = (rem * 10 + Number(d)) % 97
  }
  return rem
}

export function checkIban(raw: unknown): IbanCheck {
  const s = compactIban(raw)
  if (!s) return { ok: false, code: 'empty', error: 'Indique o IBAN.' }
  if (!/^[A-Z0-9]+$/.test(s)) return { ok: false, code: 'chars', error: 'O IBAN só pode ter letras e números (os espaços de formatação são aceites).' }
  if (/^\d+$/.test(s)) {
    return { ok: false, code: 'account_number', error: `Isto parece um número de conta (${s.length} dígitos), não um IBAN completo. Introduza o IBAN com o código do país e os 2 dígitos de controlo, tal como aparece no extracto bancário (em Angola: «AO» + 2 dígitos + 21 dígitos). O número não é completado automaticamente.` }
  }
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return { ok: false, code: 'format', error: 'O IBAN começa pelo código do país (2 letras) seguido de 2 dígitos de controlo (ex.: AO06…).' }
  const cc = s.slice(0, 2), want = LENGTH[cc]
  if (want && s.length !== want) {
    return { ok: false, code: 'length', error: `Um IBAN de ${cc} tem ${want} caracteres; este tem ${s.length}. ${s.length < want ? 'Parece incompleto: introduza o IBAN completo.' : 'Verifique se há caracteres a mais.'}` }
  }
  if (!want && (s.length < 15 || s.length > 34)) return { ok: false, code: 'length', error: `Um IBAN tem entre 15 e 34 caracteres; este tem ${s.length}.` }
  if (mod97(s.slice(4) + s.slice(0, 4)) !== 1) return { ok: false, code: 'checksum', error: 'Os dígitos de controlo do IBAN não conferem. Verifique se há algum dígito trocado ou em falta.' }
  return { ok: true, iban: s }
}

/** Nome do titular: 3–120 caracteres, sem HTML nem caracteres de controlo. */
export function checkHolder(raw: unknown): { ok: true; holder: string } | { ok: false; error: string } {
  const s = String(raw ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim()
  if (s.length < 3 || s.length > 120) return { ok: false, error: 'Indique o nome do titular da conta (3 a 120 caracteres).' }
  return { ok: true, holder: s }
}
