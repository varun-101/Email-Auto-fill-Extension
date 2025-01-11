document.addEventListener('DOMContentLoaded', () => {
    // Get the OTP from storage
    chrome.storage.local.get(['newOTP'], (result) => {
        if (result.newOTP) {
            document.getElementById('otp').textContent = result.newOTP;
            
            // Auto-copy to clipboard
            navigator.clipboard.writeText(result.newOTP);
            
            // Close popup after 5 seconds
            setTimeout(() => {
                window.close();
            }, 5000);
        }
    });

    // Add click handler for copy button
    document.getElementById('copyOTP').addEventListener('click', () => {
        const otp = document.getElementById('otp').textContent;
        navigator.clipboard.writeText(otp).then(() => {
            document.getElementById('copyOTP').textContent = 'Copied!';
            setTimeout(() => {
                document.getElementById('copyOTP').textContent = 'Copy';
            }, 1000);
        });
    });
}); 