// Switch Prisma schema between SQLite (dev) and PostgreSQL (prod)
// Usage: node scripts/switch-db.js sqlite | postgresql

const fs = require('fs')
const path = require('path')

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const target = process.argv[2]

if (!target || !['sqlite', 'postgresql'].includes(target)) {
  console.log('Usage: node scripts/switch-db.js sqlite | postgresql')
  process.exit(1)
}

let schema = fs.readFileSync(schemaPath, 'utf-8')

if (target === 'sqlite') {
  // Switch to SQLite
  schema = schema.replace(
    /provider = "postgresql"/,
    'provider = "sqlite"'
  )
  // Change Double? back to Float? for SQLite
  schema = schema.replace(/Double\?/g, 'Float?')
  // Remove indexes (SQLite handles them differently)
  schema = schema.replace(/\n\s*@@index\(\[.*?\]\)/g, '')
  console.log('✅ Switched to SQLite')
} else {
  // Switch to PostgreSQL
  schema = schema.replace(
    /provider = "sqlite"/,
    'provider = "postgresql"'
  )
  // Change Float? to Double? for PostgreSQL
  schema = schema.replace(/Float\?/g, 'Double?')
  console.log('✅ Switched to PostgreSQL')
}

fs.writeFileSync(schemaPath, schema)
console.log('Run "npx prisma generate" to update the client.')
