import app from "./src/app.js";
import { PORT } from "./src/config/serverConfig.js";
import { execSync } from 'child_process';
import fs from 'fs';

// Install Chrome before server starts
const chromePath = '/opt/render/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome';
if (!fs.existsSync(chromePath)) {
  console.log('Chrome not found, installing...');
  execSync('npx puppeteer browsers install chrome', {
    env: { ...process.env, PUPPETEER_CACHE_DIR: '/opt/render/.cache/puppeteer' },
    stdio: 'inherit'
  });
  console.log('Chrome installed ');
} else {
  console.log('Chrome already installed ');
}

app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT}`)
);