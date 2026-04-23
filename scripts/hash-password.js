#!/usr/bin/env node
/**
 * One-time utility: hash an admin password for ADMIN_PASSWORD_HASH in .env
 * Usage: node scripts/hash-password.js "yourSuperSecretPassword"
 */
const bcrypt = require('bcryptjs')

const password = process.argv[2]
if (!password) {
  console.error('Usage: node scripts/hash-password.js "yourPassword"')
  process.exit(1)
}

bcrypt.hash(password, 12).then((hash) => {
  console.log('\nAdd this to your .env on Contabo:\n')
  console.log(`ADMIN_PASSWORD_HASH="${hash}"`)
  console.log('')
})
