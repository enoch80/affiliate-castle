/**
 * Credential encryption/decryption utilities.
 *
 * Algorithm: AES-256-GCM
 * Key: 32-byte hex string from CREDENTIAL_ENCRYPTION_KEY env var
 *
 * Encrypted format: base64( iv(12B) + authTag(16B) + ciphertext )
 */
import crypto from 'crypto'

function getKey(): Buffer {
  const hex = process.env.CREDENTIAL_ENCRYPTION_KEY ?? ''
  if (hex.length < 64) {
    // Fallback: derive a consistent key from the secret for dev environments
    return crypto.createHash('sha256').update(hex || 'dev-insecure-key').digest()
  }
  return Buffer.from(hex.slice(0, 64), 'hex')
}

export function encryptCredential(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptCredential(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
