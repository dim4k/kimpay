migrate((app) => {
    // Disable PocketBase's native email-OTP on `users`.
    //
    // The app authenticates exclusively through the custom magic-link flow
    // (see pb_hooks/auth.pb.js + the `auth_otps` collection). The native OTP
    // mechanism enabled in 1734268800_enable_otp.js is never exercised by any
    // client, so keeping it on only adds a second, confusing auth surface.
    // Email/password auth stays enabled (used to mint accounts server-side).
    const collection = app.findCollectionByNameOrId("users");
    collection.otp = { enabled: false };
    app.save(collection);
}, (app) => {
    // Revert: re-enable native OTP with the previous settings.
    const collection = app.findCollectionByNameOrId("users");
    collection.otp = {
        enabled: true,
        duration: 180,
        length: 6,
        emailTemplate: {
            subject: "Login code for {APP_NAME}",
            body: "<p>Your login code is: <strong>{OTP}</strong></p>",
        },
    };
    app.save(collection);
})
