# Gmail OTP Auto-Copy Chrome Extension

A Chrome extension that automatically detects and copies OTP (One-Time Password) codes from your Gmail inbox in real-time. When a new email containing an OTP arrives, the extension instantly notifies you and provides one-click copying functionality.

## Features

- 🔐 Secure Gmail OAuth2 authentication
- 📧 Real-time OTP detection from Gmail
- 🔔 Instant desktop notifications for new OTPs
- 📋 Automatic OTP copying to clipboard
- 📱 Smart OTP pattern recognition
- 🕒 Recent OTP email history
- 🔄 Manual refresh capability
- 🔒 Secure token handling


## How It Works

1. **Authentication**:
   - User signs in with Gmail using OAuth2
   - Extension stores access token securely
   - Handles token refresh automatically

2. **Email Monitoring**:
   - Sets up Gmail push notifications
   - Cloud Function receives email notifications
   - Extension polls for updates every 5 seconds

3. **OTP Detection**:
   - Scans email content for OTP patterns
   - Supports various OTP formats (4-8 digits)
   - Uses keyword matching for accuracy

4. **Notification System**:
   - Shows desktop popup for new OTPs
   - Automatically copies OTP to clipboard
   - Displays in extension popup

## Usage

1. Click the extension icon in Chrome
2. Sign in with your Gmail account
3. Grant required permissions
4. Extension will now:
   - Monitor your inbox for OTPs
   - Show notifications for new OTPs
   - Maintain recent OTP history
   - Allow one-click copying

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm
- Google Cloud Console project
- Chrome browser

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-repo/gmail-otp-auto-copy.git
cd gmail-otp-auto-copy
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables - Look at .env.example

4. Run the development server for the cloud function:
```bash
cd cloud-function
npm run start
```


### Google Cloud Setup

1. Create a new project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Gmail API
3. Create OAuth 2.0 credentials:
   - Application type: Chrome Extension
   - Add your extension's ID to authorized origins
4. Create a Pub/Sub topic named "email-autofill"
5. Set up a push subscription for the topic
6. Configure OAuth consent screen:
   - Add test users for development
   - Add required scopes

### Local Development

1. Start the Cloud Function:
```bash
cd cloud-function
npm run start
```

2. Start ngrok in a new terminal:
```bash
ngrok http http://localhost:8080
```

3. Update your Pub/Sub subscription with the ngrok URL

4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory
