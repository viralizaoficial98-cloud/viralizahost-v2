import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer | null {
  const hex = process.env.WHM_ENCRYPTION_KEY
  if (!hex || hex.length < 64) return null
  return Buffer.from(hex.slice(0, 64), 'hex')
}

/**
 * Encrypts a secret using AES-256-GCM.
 * Returns `enc:<iv>:<tag>:<data>` (all hex) when key is available,
 * or the plaintext unchanged when WHM_ENCRYPTION_KEY is not configured.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext
  const key = getKey()
  if (!key) {
    // No encryption key — store plaintext (log warning, never expose in response)
    console.warn('[crypto] WHM_ENCRYPTION_KEY not configured — token stored unencrypted')
    return plaintext
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a value produced by encryptSecret().
 * If the value does not start with `enc:` it is returned as-is (plain text stored without key).
 */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return ''
  if (!ciphertext.startsWith('enc:')) return ciphertext // not encrypted
  const key = getKey()
  if (!key) {
    console.error('[crypto] Cannot decrypt — WHM_ENCRYPTION_KEY not configured')
    return ''
  }
  const parts = ciphertext.split(':')
  if (parts.length !== 4) return ''
  const [, ivHex, tagHex, dataHex] = parts
  try {
    const iv = Buffer.from(ivHex, 'hex')
    const tag = Buffer.from(tagHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(data), decipher.final()])
    return plain.toString('utf8')
  } catch {
    console.error('[crypto] Decryption failed — key mismatch or data corrupted')
    return ''
  }
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:')
}
