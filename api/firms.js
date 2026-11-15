export default async function handler(req, res) {
  // Extract path parameters from query or URL
  let path = req.query.path;
  if (Array.isArray(path)) {
    path = path.join('/');
  }
  if (!path) {
    const match = req.url.match(/\/firms\/(.+)$/);
    path = match ? match[1] : '';
  }

  const mapKey = (process.env.FIRMS_MAP_KEY || '').trim().replace(/^["']|["']$/g, '');

  if (!mapKey) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(500).send('FIRMS_MAP_KEY environment variable is not configured on Vercel.');
  }

  const cleanPath = String(path).replace(/^\//, '');
  const targetUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${cleanPath}`;

  try {
    const upstream = await fetch(targetUrl);
    const data = await upstream.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    // Cache for 2 minutes on Vercel edge to avoid burning NASA rate limits
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return res.status(upstream.status).send(data);
  } catch (err) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(502).send(`Error proxying to NASA FIRMS: ${err.message}`);
  }
}
