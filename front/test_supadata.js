const { Supadata } = require('@supadata/js');
require('dotenv').config();

async function test() {
  const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY });
  try {
    const info = await supadata.youtube.info({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    console.log("INFO:", info);
  } catch (e) {
    console.log("NO INFO METHOD:", e.message);
  }
}
test();
