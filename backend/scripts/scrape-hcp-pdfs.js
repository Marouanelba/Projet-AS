import { Pool } from 'pg';
import https from 'https';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/AS'
});

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (err) => reject(err));
  });
}

async function scrapeAndMapPdfs() {
  const allYearPdfs = {};

  for (let page = 1; page <= 10; page++) {
    try {
      const url = `https://www.hcp.ma/downloads/?tag=Annuaires+statistiques+du+Maroc+%28Format+PDF%29&page=${page}`;
      const html = await fetchHtml(url);
      
      const regex = /<a\s+[^>]*href=["'](\/file\/\d+\/?)["'][^>]*>(.*?)<\/a>/gis;
      let match;
      let foundInPage = 0;

      while ((match = regex.exec(html)) !== null) {
        foundInPage++;
        const href = match[1];
        const rawText = match[2];
        const cleanText = rawText.replace(/<[^>]+>/g, '').trim();
        
        if (!cleanText) continue;
        if (cleanText.toLowerCase().includes('version ar') || cleanText.toLowerCase().includes('(version ar)')) {
          continue;
        }

        const yearMatch = cleanText.match(/(\d{4}(?:\s*-\s*\d{4})?)/);
        if (yearMatch) {
          const yearStr = yearMatch[1].replace(/\s+/g, '');
          const fullUrl = 'https://www.hcp.ma' + href;
          if (!allYearPdfs[yearStr]) {
            allYearPdfs[yearStr] = { title: cleanText, url: fullUrl };
          }
        }
      }

      if (foundInPage === 0) break;
    } catch (err) {
      console.error(`Page ${page} error:`, err.message);
      break;
    }
  }

  console.log(`Scraped ${Object.keys(allYearPdfs).length} PDF mappings from HCP:`);
  let updatedCount = 0;

  for (const [annee, data] of Object.entries(allYearPdfs)) {
    console.log(`Year ${annee.padEnd(10)} => ${data.url} (${data.title})`);
    const res = await pool.query('UPDATE annuaires SET pdf_url = $1 WHERE annee = $2', [data.url, annee]);
    updatedCount += res.rowCount;
  }

  console.log(`Successfully updated ${updatedCount} annuaires in database with pdf_url.`);
  await pool.end();
}

scrapeAndMapPdfs().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
