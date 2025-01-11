let is_user_signed_in = false;

const CLIENT_ID = encodeURIComponent(process.env.CLIENT_ID);
const RESPONSE_TYPE = encodeURIComponent('id_token token');
const REDIRECT_URI = encodeURIComponent(process.env.REDIRECT_URI);
const SCOPE = encodeURIComponent('openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/pubsub');
const STATE = encodeURIComponent('meet' + Math.random().toString(36).substring(2, 15));
const PROMPT = encodeURIComponent('consent');

// Helper function to decode base64Url
function base64UrlDecode(input) {
    // Replace non-url compatible chars with base64 standard chars
    input = input.replace(/-/g, '+').replace(/_/g, '/');
    
    // Pad out with standard base64 required padding characters
    const pad = input.length % 4;
    if(pad) {
        if(pad === 1) {
            throw new Error('InvalidLengthError: Input base64url string is the wrong length to determine padding');
        }
        input += new Array(5-pad).join('=');
    }

    return atob(input);
}

// Helper function to parse JWT token
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const jsonPayload = base64UrlDecode(base64Url);
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error parsing JWT:", error);
        return null;
    }
}

function create_auth_endpoint() {
    let nonce = encodeURIComponent(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

    let openId_endpoint_url =
        `https://accounts.google.com/o/oauth2/v2/auth
?client_id=${CLIENT_ID}
&response_type=${RESPONSE_TYPE}
&redirect_uri=${REDIRECT_URI}
&scope=${SCOPE}
&state=${STATE}
&nonce=${nonce}
&prompt=${PROMPT}`;

    console.log(openId_endpoint_url);
    return openId_endpoint_url;
}


async function fetchMessageIds(access_token, maxResults = 10) {
    const response = await fetch(`https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching messages: ${response.status}`);
    }

    const data = await response.json();
    if (data.messages && data.messages.length > 0) {
        return data.messages.map(message => message.id); // Return an array of message IDs
    } else {
        throw new Error('No messages found.');
    }
}


async function fetchMessagesContent(access_token, messageIds) {
    const fetchMessagePromises = messageIds.map(messageId => 
        fetch(`https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
            }
        }).then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching message ${messageId}: ${response.status}`);
            }
            return response.json();
        })
    );

    try {
        const messages = await Promise.all(fetchMessagePromises);
        return messages; // Return all fetched messages
    } catch (error) {
        console.error('Error fetching messages in bulk:', error);
        throw error;
    }
}

function parseEmailsContent(emails) {
    return emails.map(email => {
        const payload = email.payload;
        const headers = payload.headers;
        const body = payload.body?.data || 
            (payload.parts ? payload.parts[0].body.data : null);

        const subject = headers.find(header => header.name === 'Subject')?.value || 'No Subject';
        const sender = headers.find(header => header.name === 'From')?.value || 'Unknown Sender';
        const decodedBody = body ? base64UrlDecode(body) : 'No Content';

        return { subject, sender, body: decodedBody };
    });
}

async function getBulkEmails(access_token, maxResults = 10) {
    try {
        const messageIds = await fetchMessageIds(access_token, maxResults);
        const messagesContent = await fetchMessagesContent(access_token, messageIds);
        const parsedEmails = parseEmailsContent(messagesContent);
        
        console.log('Fetched Emails:', parsedEmails);
        return parsedEmails;
    } catch (error) {
        console.error('Error fetching bulk emails:', error);
        return []; // Return empty array instead of undefined
    }
}


// Read emails for OTP
function selectMailsWithOtp(emails) {
    // If emails is undefined or not an array, return empty array
    if (!Array.isArray(emails)) {
        console.warn('selectMailsWithOtp received invalid input:', emails);
        return [];
    }

    // Define a regex pattern for OTP numbers
    const otpRegex = /\b\d{4,8}\b/;

    // Define keywords commonly associated with OTPs
    const otpKeywords = ["otp", "verification code", "auth code", "one-time password", "one time password", "verification", "Security Code"];

    return emails.map(email => {
        // Check if the subject or body contains OTP-like patterns and keywords
        const containsOtpPattern = otpRegex.test(email.body) || otpRegex.test(email.subject);
        const containsOtpKeyword = otpKeywords.some(keyword => 
            email.subject.toLowerCase().includes(keyword) || email.body.toLowerCase().includes(keyword)
        );

        // Determine if the email is likely an OTP email
        const isOtp = containsOtpPattern && containsOtpKeyword;
        const otp = otpRegex.exec(email.body);

        // Add the is_otp field to each email object
        if(isOtp) {
            return {
                ...email,
                is_otp: isOtp,
                otp: otp
            };
        }
        else {
            return {
                ...email,
                is_otp: isOtp,
                otp: null
            };
        }
    });
}

async function startWatchingEmails(access_token) {
    try {
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/watch', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                labelIds: ['INBOX'],
                topicName: process.env.GMAIL_TOPIC_NAME,
                labelFilterAction: 'include'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Watch response error:', errorData);
            throw new Error(`Failed to start watching emails: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Watch response:', data);
        
        // Store the historyId to track changes
        chrome.storage.local.set({ historyId: data.historyId });
        return data;
    } catch (error) {
        console.error('Error starting email watch:', error);
        throw error;
    }
}

async function getEmailHistory(access_token, startHistoryId) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}`, {
            headers: {
                'Authorization': `Bearer ${access_token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get email history: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting email history:', error);
        throw error;
    }
}

// Add this function to handle token refresh
async function refreshAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ 
            url: create_auth_endpoint(), 
            interactive: false 
        }, (response) => {
            if(chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
            }
            
            try {
                const urlParams = new URLSearchParams(response.split('#')[1]);
                const access_token = urlParams.get('access_token');
                
                if (!access_token) {
                    reject(new Error('No access token in response'));
                    return;
                }

                // Store new access token
                chrome.storage.local.set({ access_token: access_token });
                resolve(access_token);
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Create an alarm that fires every 5 seconds
function startEmailCheckAlarm() {
    chrome.alarms.create('checkNewEmail', {
        periodInMinutes: 5/60  // 5 seconds in minutes
    });
    // Do an initial check right away
    checkForNewEmail();
}

// Clear the alarm when signing out
function stopEmailCheckAlarm() {
    chrome.alarms.clear('checkNewEmail');
}

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkNewEmail') {
        checkForNewEmail();
    }
});

// Update checkForNewEmail to use the new function
async function checkForNewEmail() {
    try {
        // Check token validity first
        if (!await isTokenValid()) {
            console.log('Token expired or about to expire, attempting refresh...');
            try {
                await refreshAccessToken();
            } catch (error) {
                console.error('Failed to refresh token:', error);
                // If refresh fails, sign out user
                chrome.runtime.sendMessage({ action: "forceSignOut" });
                return;
            }
        }

        const response = await fetch(`${process.env.LOCAL_SERVER_URL}/check_new_email`);
        const data = await response.json();
        
        if (data.new_email) {
            console.log('New email detected');
            const { access_token } = await chrome.storage.local.get(['access_token']);
            if (access_token) {
                await updateEmails(access_token);
            }
        }
    } catch (error) {
        console.error('Error checking for new emails:', error);
    }
}

// Add this new function to handle email updates
async function updateEmails(access_token) {
    try {
        // Fetch and process new emails
        const emails = await getBulkEmails(access_token);
        const otpEmails = selectMailsWithOtp(emails);
        
        // Get previously stored emails to compare
        const { recentMails } = await chrome.storage.local.get(['recentMails']);
        
        // Check if there's a new OTP email
        const newOtpEmail = otpEmails.find(mail => mail.is_otp && 
            (!recentMails || !recentMails.some(oldMail => 
                oldMail.is_otp && oldMail.otp[0] === mail.otp[0]
            ))
        );

        // If new OTP found, create popup
        if (newOtpEmail) {
            // Get the current window to calculate position
            chrome.windows.getCurrent(async (currentWindow) => {
                // Get all screens
                const screens = await chrome.system.display.getInfo();
                // Find the screen containing the current window
                const currentScreen = screens.find(screen => 
                    currentWindow.left >= screen.bounds.left && 
                    currentWindow.left < screen.bounds.left + screen.bounds.width
                ) || screens[0]; // Default to first screen if not found

                // Calculate position (right side of screen, near the top)
                const width = 300;
                const height = 200;
                const top = 100; // Distance from top of screen
                const left = currentScreen.bounds.left + currentScreen.bounds.width - width - 20; // 20px from right edge

                // Create popup with calculated position
                chrome.windows.create({
                    url: 'copied_otp.html',
                    type: 'popup',
                    width: width,
                    height: height,
                    top: top,
                    left: left,
                    focused: true
                });

                // Store the new OTP to be accessed by the popup
                chrome.storage.local.set({ newOTP: newOtpEmail.otp[0] });
            });
        }
        
        // Update stored emails
        chrome.storage.local.set({ recentMails: otpEmails });
        
        // Notify popup if it's open
        chrome.runtime.sendMessage({
            action: "newEmails",
            otpEmails: otpEmails
        }).catch(() => {
            // Ignore errors if popup is not open
            console.log('No active popup to receive update');
        });

        return otpEmails;
    } catch (error) {
        console.error('Error updating emails:', error);
        throw error;
    }
}

// Add a function to check token validity
async function isTokenValid() {
    const { access_token, tokenExpiration } = await chrome.storage.local.get(['access_token', 'tokenExpiration']);
    
    if (!access_token || !tokenExpiration) {
        return false;
    }

    // Check if token is expired or about to expire (within 5 minutes)
    return Date.now() < (tokenExpiration - (5 * 60 * 1000));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "signOut") {
        is_user_signed_in = false;
        // Stop the alarm instead of clearing interval
        stopEmailCheckAlarm();
        console.log("User signed out");
        return;
    }
    
    if (request.action === "signIn") {
        if(is_user_signed_in) {
            console.log("User already signed in");
            sendResponse({ status: "already_signed_in" });
            return;
        }
        
        // Return true to indicate we'll send a response asynchronously
        chrome.identity.launchWebAuthFlow({ 
            url: create_auth_endpoint(), 
            interactive: true 
        }, async (response) => {
            if(chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
                sendResponse({ status: "error" });
                return;
            }
            
            try {
                // Extract tokens from the response URL
                const urlParams = new URLSearchParams(response.split('#')[1]);
                const id_token = urlParams.get('id_token');
                const access_token = urlParams.get('access_token');
                
                if (!id_token || !access_token) {
                    throw new Error('Missing tokens in response');
                }

                const user_info = parseJwt(id_token);
                
                if (user_info && 
                    (user_info.iss === 'https://accounts.google.com' || user_info.iss === 'accounts.google.com') && 
                    user_info.aud === CLIENT_ID) {
                    console.log("User successfully signed in.");
                    is_user_signed_in = true;

                    // Calculate token expiration (default to 1 hour from now if not provided)
                    const expiresIn = urlParams.get('expires_in') || 3600;
                    const expirationTime = Date.now() + (expiresIn * 1000);

                    // Store access token, sign-in state, and expiration
                    chrome.storage.local.set({ 
                        access_token: access_token,
                        isSignedIn: true,
                        tokenExpiration: expirationTime
                    });

                    // Start watching emails
                    startWatchingEmails(access_token)
                        .then(async () => {
                            // Start the alarm instead of interval
                            startEmailCheckAlarm();
                            
                            // Fetch initial emails
                            const otpEmails = await updateEmails(access_token);

                            sendResponse({ 
                                status: "success",
                                email: user_info.email,
                                otpEmails: otpEmails
                            });
                        })
                        .catch(error => {
                            console.error('Error setting up email watch:', error);
                            return getBulkEmails(access_token);
                        });
                } else {
                    console.log("Invalid token.");
                    sendResponse({ status: "error" });
                }
            } catch (error) {
                console.error("Error processing token:", error);
                sendResponse({ status: "error", message: error.message });
            }
        });
        
        // Return true to indicate we'll send a response asynchronously
        return true;
    }

    if (request.action === "refreshOTP") {
        chrome.storage.local.get(['access_token'], async (result) => {
            try {
                if (!result.access_token) {
                    console.error('No access token found');
                    sendResponse({ status: "error", message: "Not signed in" });
                    return;
                }
                
                const otpEmails = await updateEmails(result.access_token);
                
                sendResponse({ 
                    status: "success", 
                    otpEmails: otpEmails 
                });
            } catch (error) {
                console.error('Error refreshing emails:', error);
                sendResponse({ 
                    status: "error", 
                    message: error.message 
                });
            }
        });
        return true; // Will respond asynchronously
    }

    if (request.action === "forceSignOut") {
        is_user_signed_in = false;
        stopEmailCheckAlarm();
        chrome.storage.local.clear();
        console.log("User force signed out due to token expiration");
        return;
    }
});

// Update startup and install handlers
chrome.runtime.onStartup.addListener(async () => {
    const { access_token, isSignedIn } = await chrome.storage.local.get(['access_token', 'isSignedIn']);
    if (access_token && isSignedIn) {
        console.log("Restarting email check alarm on browser startup");
        startEmailCheckAlarm();
    }
});

chrome.runtime.onInstalled.addListener(async () => {
    const { access_token, isSignedIn } = await chrome.storage.local.get(['access_token', 'isSignedIn']);
    if (access_token && isSignedIn) {
        console.log("Starting email check alarm on install/update");
        startEmailCheckAlarm();
    }
});
