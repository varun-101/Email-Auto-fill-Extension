const functions = require('@google-cloud/functions-framework');

let is_new_email = false;

// Register HTTP endpoint for both notifications and checks
functions.http('handleGmailNotification', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Handle check_new_email requests
  if (req.method === 'GET' && req.path === '/check_new_email') {
    res.json({ new_email: is_new_email });
    is_new_email = false;
    return;
  }

  // Handle Gmail notifications (POST requests)
  if (req.method === 'POST') {
    console.log('Received Gmail notification');
    is_new_email = true;
    res.status(200).send();
    return;
  }

  // Handle unknown requests
  res.status(404).send('Not Found');
});

