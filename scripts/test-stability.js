const http = require('http')
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
  let body = ''
  req.on('data', c => body += c)
  await new Promise(r => req.on('end', r))
  const { query } = JSON.parse(body)
  
  const hospitals = await db.hospital.findMany({
    where: { OR: [{ name: { contains: query }}, { city: { contains: query }}, { state: { contains: query }}] },
    take: 10,
  })
  
  res.writeHead(200)
  res.end(JSON.stringify({ 
    response: `Found ${hospitals.length} hospitals for "${query}".`,
    hospitals: hospitals.map(h => ({ ...h, category: JSON.parse(h.category || '["general"]'), phones: JSON.parse(h.phones || '[]'), beds: parseInt(h.beds) || 0 })),
    source: 'local'
  }))
})

server.listen(3001, () => console.log('Test server on :3001'))
