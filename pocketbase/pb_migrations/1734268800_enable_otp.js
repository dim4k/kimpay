migrate((app) => {
    const collection = app.findCollectionByNameOrId("users");

    // Enable OTP
    collection.otp = {
        enabled: true,
        duration: 180, // 3 minutes
        length: 6,
        emailTemplate: {
            subject: "Login code for {APP_NAME}",
            body: "<p>Your login code is: <strong>{OTP}</strong></p>"
        }
    };

    // Ensure Email Auth is enabled (required for email-based OTP mostly, or just good practice)
    if (!collection.emailAuth) {
        collection.emailAuth = {
            enabled: true,
            minPasswordLength: 8
        };
    } else {
        collection.emailAuth.enabled = true;
    }

    app.save(collection);

}, (app) => {
    // Revert logic
    const collection = app.findCollectionByNameOrId("users");
    collection.otp = { enabled: false };
    app.save(collection);
})
