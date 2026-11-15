export default async function handler(_req, res) {
  const mapKey = (process.env.FIRMS_MAP_KEY || '').trim().replace(/^["']|["']$/g, '');
  let message;

  if (!mapKey) {
    message = 'FIRMS_MAP_KEY is empty on Vercel. Add FIRMS_MAP_KEY in Vercel Project Settings > Environment Variables.';
  } else {
    try {
      const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${mapKey}`);
      const t = (await r.text()).slice(0, 200);
      message = `Key loaded (${mapKey.length} chars). NASA says: ${t}`;
    } catch (e) {
      message = `Could not reach NASA to check key: ${e.message}`;
    }
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ message });
}
