// Check authentication state when popup opens
chrome.storage.local.get(['isSignedIn', 'userEmail', 'recentMails'], (result) => {
    if (result.isSignedIn) {
        document.querySelector("#userInfo").style.display = "block";
        document.querySelector("#userEmail").textContent = result.userEmail;
        document.querySelector("#login").style.display = "none";
        recentMails = result.recentMails || [];
        
        // Find the first email with OTP
        const lastOtpMail = recentMails.find(mail => mail.is_otp);
        const lastOTP = lastOtpMail ? lastOtpMail.otp[0] : 'None';
        const lastOTPElement = document.querySelector("#lastOTP");
        lastOTPElement.textContent = lastOTP;
        if (lastOTP !== 'None') {
            lastOTPElement.dataset.otp = lastOTP;
        }
    }
});

// Add click handler for lastOTP
document.querySelector("#lastOTP").addEventListener("click", function() {
    const otp = this.dataset.otp;
    if (otp) {
        navigator.clipboard.writeText(otp).then(() => {
            const originalText = this.textContent;
            this.textContent = 'Copied!';
            setTimeout(() => {
                this.textContent = originalText;
            }, 1000);
        });
    }
});

document.querySelector("#signInButton").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "signIn" }, (response) => {
        console.log(response);
        if (response.status === "success") {
            recentMails = response.otpEmails;
            document.querySelector("#userInfo").style.display = "block";
            document.querySelector("#userEmail").textContent = response.email;
            document.querySelector("#login").style.display = "none";

            // Update last OTP display
            const lastOtpMail = recentMails.find(mail => mail.is_otp);
            const lastOTP = lastOtpMail ? lastOtpMail.otp[0] : 'None';
            const lastOTPElement = document.querySelector("#lastOTP");
            lastOTPElement.textContent = lastOTP;
            if (lastOTP !== 'None') {
                lastOTPElement.dataset.otp = lastOTP;
            }

            // Store authentication state and data
            chrome.storage.local.set({
                isSignedIn: true,
                userEmail: response.email,
                recentMails: response.otpEmails
            });
        } else if (response.status === "error") {
            console.error("Sign in failed");
            // Optionally show an error message to the user
        }
    });
});

document.querySelector("#refreshOTP").addEventListener("click", () => {
    // Add loading state
    const refreshButton = document.querySelector("#refreshOTP");
    refreshButton.classList.add("spinning");
    
    chrome.runtime.sendMessage({ action: "refreshOTP" }, (response) => {
        console.log('Refresh response:', response);
        if (response && response.status === "success") {
            recentMails = response.otpEmails;
            
            // Update last OTP display
            const lastOtpMail = recentMails.find(mail => mail.is_otp);
            const lastOTP = lastOtpMail ? lastOtpMail.otp[0] : 'None';
            const lastOTPElement = document.querySelector("#lastOTP");
            lastOTPElement.textContent = lastOTP;
            if (lastOTP !== 'None') {
                lastOTPElement.dataset.otp = lastOTP;
            }

            // Update stored emails
            chrome.storage.local.set({ recentMails: response.otpEmails });

            // Update email list if it's visible
            const emailsList = document.querySelector("#recentEmailsList");
            if (emailsList.style.display === "block") {
                const emailsContainer = emailsList.querySelector(".emails-container");
                emailsContainer.innerHTML = "";
                recentMails.forEach(mail => {
                    emailsContainer.innerHTML += `
                        <div class="email-item">
                            <div class="email-subject">${mail.subject}</div>
                            <div class="email-sender">From: ${mail.sender}</div>
                            <div class="email-snippet">${mail.body}</div>
                            ${mail.is_otp ? `
                                <div class="email-buttons">
                                    <a class="copy-text copy-otp" data-otp="${mail.otp[0]}">OTP: ${mail.otp[0]}</a>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });

                // Re-add click handlers for copying OTPs
                document.querySelectorAll('.copy-otp').forEach(element => {
                    element.addEventListener('click', function() {
                        const otp = this.dataset.otp;
                        navigator.clipboard.writeText(otp).then(() => {
                            const originalText = this.textContent;
                            this.textContent = 'Copied!';
                            setTimeout(() => {
                                this.textContent = originalText;
                            }, 1000);
                        });
                    });
                });
            }
        }
        // Remove loading state
        refreshButton.classList.remove("spinning");
    });
});


document.querySelector("#signOutButton").addEventListener("click", () => {
    // Clear stored data
    chrome.storage.local.clear(() => {
        // Reset UI
        document.querySelector("#userInfo").style.display = "none";
        document.querySelector("#login").style.display = "block";
        document.querySelector("#userEmail").textContent = "";
        document.querySelector("#recentEmailsList").style.display = "none";
        recentMails = [];

        // Notify background script
        chrome.runtime.sendMessage({ action: "signOut" });
    });
});

document.querySelector("#showRecentEmails").addEventListener("click", () => {
    const emailsList = document.querySelector("#recentEmailsList");
    const showButton = document.querySelector("#showRecentEmails");
    
    if (emailsList.style.display === "block") {
        // Hide the list
        emailsList.style.display = "none";
        showButton.textContent = "Show Recent Emails";
        return;
    }

    // Show the list
    emailsList.style.display = "block";
    showButton.textContent = "Hide Recent Emails";
    const emailsContainer = emailsList.querySelector(".emails-container");
    emailsContainer.innerHTML = "";

    recentMails.forEach(mail => {
        emailsContainer.innerHTML += `
            <div class="email-item">
                <div class="email-subject">${mail.subject}</div>
                <div class="email-sender">From: ${mail.sender}</div>
                <div class="email-snippet">${mail.body}</div>
                ${mail.is_otp ? `
                    <div class="email-buttons">
                        <a class="copy-text copy-otp" data-otp="${mail.otp[0]}">OTP: ${mail.otp[0]}</a>
                    </div>
                ` : ''}
            </div>
        `;
    });

    // Add click handlers for copying OTPs
    document.querySelectorAll('.copy-otp').forEach(element => {
        element.addEventListener('click', function() {
            const otp = this.dataset.otp;
            navigator.clipboard.writeText(otp).then(() => {
                const originalText = this.textContent;
                this.textContent = 'Copied!';
                setTimeout(() => {
                    this.textContent = originalText;
                }, 1000);
            });
        });
    });
});

// Add message listener for real-time updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "newEmails") {
        recentMails = message.otpEmails;
        console.log("New emails received:", recentMails);
        // Update last OTP if available
        const lastOtpMail = recentMails.find(mail => mail.is_otp);
        const lastOTP = lastOtpMail ? lastOtpMail.otp[0] : 'None';
        const lastOTPElement = document.querySelector("#lastOTP");
        lastOTPElement.textContent = lastOTP;
        if (lastOTP !== 'None') {
            lastOTPElement.dataset.otp = lastOTP;
        }

        // Update email list if it's open
        const emailsList = document.querySelector("#recentEmailsList");
        if (emailsList.style.display === "block") {
            const emailsContainer = emailsList.querySelector(".emails-container");
            emailsContainer.innerHTML = "";

            recentMails.forEach(mail => {
                emailsContainer.innerHTML += `
                    <div class="email-item">
                        <div class="email-subject">${mail.subject}</div>
                        <div class="email-sender">From: ${mail.sender}</div>
                        <div class="email-snippet">${mail.body}</div>
                        ${mail.is_otp ? `
                            <div class="email-buttons">
                                <a class="copy-text copy-otp" data-otp="${mail.otp[0]}">OTP: ${mail.otp[0]}</a>
                            </div>
                        ` : ''}
                    </div>
                `;
            });

            // Re-add click handlers for copying OTPs
            document.querySelectorAll('.copy-otp').forEach(element => {
                element.addEventListener('click', function() {
                    const otp = this.dataset.otp;
                    navigator.clipboard.writeText(otp).then(() => {
                        const originalText = this.textContent;
                        this.textContent = 'Copied!';
                        setTimeout(() => {
                            this.textContent = originalText;
                        }, 1000);
                    });
                });
            });
        }
    }
    if (message.action === "forceSignOut") {
        // Reset UI
        document.querySelector("#userInfo").style.display = "none";
        document.querySelector("#login").style.display = "block";
        document.querySelector("#userEmail").textContent = "";
        document.querySelector("#recentEmailsList").style.display = "none";
        recentMails = [];
    }
});