// Set up Supabase database and import hospitals using Supabase REST API
// This works even when direct PostgreSQL connection is blocked

const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://qrfikgmsydgashofhble.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function supabaseRequest(method, table, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'qrfikgmsydgashofhble.supabase.co',
      path: `/rest/v1/${table}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': method === 'POST' ? 'return=minimal,resolution=merge-duplicates' : 'return=minimal',
      },
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true, status: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function main() {
  if (!SUPABASE_KEY) {
    console.log('ERROR: SUPABASE_SERVICE_KEY not set');
    console.log('Get it from: Supabase Dashboard → Settings → API → service_role key');
    process.exit(1);
  }

  // Test connection
  try {
    await supabaseRequest('GET', 'hospital?select=id&limit=1');
    console.log('✅ Connected to Supabase REST API!');
  } catch(e) {
    if (e.message.includes('404') || e.message.includes('relation')) {
      console.log('Table does not exist yet. Creating...');
    } else {
      console.log('Connection test:', e.message);
    }
  }

  // Load hospital data
  const dataPath = path.join(__dirname, '..', 'download', 'hospitals_cleaned.json');
  const hospitals = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  console.log(`Loaded ${hospitals.length} hospitals`);

  // Import in batches
  const BATCH_SIZE = 100;
  let imported = 0;

  for (let i = 0; i < hospitals.length; i += BATCH_SIZE) {
    const batch = hospitals.slice(i, i + BATCH_SIZE).map(h => ({
      id: h.id,
      name: h.name || '',
      address: h.address || '',
      city: h.city || '',
      state: h.state || '',
      district: h.district || '',
      pincode: h.pincode || '',
      lat: h.lat || null,
      lng: h.lng || null,
      category: typeof h.category === 'object' ? JSON.stringify(h.category) : (h.category || '["general"]'),
      caretype: h.careType || '',
      discipline: h.discipline || '',
      ownership: h.ownership || 'Unknown',
      beds: String(h.beds || 0),
      emergency: h.emergency || false,
      phones: typeof h.phones === 'object' ? JSON.stringify(h.phones) : (h.phones || '[]'),
      specialties: h.specialties || '',
      facilities: h.facilities || '',
    }));

    try {
      await supabaseRequest('POST', 'hospital', batch);
      imported += batch.length;
      const pct = ((imported / hospitals.length) * 100).toFixed(1);
      process.stdout.write(`\r  Progress: ${imported}/${hospitals.length} (${pct}%)`);
    } catch(e) {
      console.log(`\n❌ Batch failed at ${i}: ${e.message.slice(0, 100)}`);
    }
  }

  console.log(`\n✅ Imported ${imported} hospitals!`);
}

main().catch(console.error);
