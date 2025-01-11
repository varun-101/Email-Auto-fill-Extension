const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Read manifest template
const manifestTemplate = fs.readFileSync('manifest.json', 'utf8');

// Replace environment variables
const manifest = manifestTemplate.replace(/%CLIENT_ID%/g, process.env.CLIENT_ID);

// Write the processed manifest
fs.writeFileSync('dist/manifest.json', manifest);

// Process background.js
const backgroundJs = fs.readFileSync('background.js', 'utf8');
const processedBackgroundJs = backgroundJs
    .replace(/process\.env\.CLIENT_ID/g, `'${process.env.CLIENT_ID}'`)
    .replace(/process\.env\.REDIRECT_URI/g, `'${process.env.REDIRECT_URI}'`)
    .replace(/process\.env\.GMAIL_TOPIC_NAME/g, `'${process.env.GMAIL_TOPIC_NAME}'`)
    .replace(/process\.env\.LOCAL_SERVER_URL/g, `'${process.env.LOCAL_SERVER_URL}'`);

fs.writeFileSync('dist/background.js', processedBackgroundJs); 