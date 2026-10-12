migrate((app) => {
    // =========================================================================
    // Real client IP behind the reverse proxy.
    //
    // The rate limits (magic links, codes, uploads...) count per IP
    // (`e.realIP()`). Without a trusted proxy, PocketBase sees the proxy's IP
    // for every request: all users share one counter, and a few requests
    // block logging in for everyone.
    //
    // The proxy appends the client IP to X-Forwarded-For: the right-most value
    // is the one it added (the left-most ones can be forged by the client).
    // PocketBase must then only be reachable through the proxy (port 8090 not
    // public), or anyone could send that header themselves.
    //
    // Left as is when already configured (Dashboard > Settings > Application).
    // =========================================================================

    const settings = app.settings();
    if (settings.trustedProxy.headers.length > 0) return;
    settings.trustedProxy.headers = ["X-Forwarded-For"];
    settings.trustedProxy.useLeftmostIP = false;
    app.save(settings);
}, (app) => {
    const settings = app.settings();
    settings.trustedProxy.headers = [];
    app.save(settings);
});
