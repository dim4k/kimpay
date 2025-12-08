migrate((app) => {
    // 1. Update French Template & English Template to use PNG
    const locales = ['fr', 'en'];
    
    locales.forEach(locale => {
        try {
            const records = app.findRecordsByFilter("email_templates", "slug='share_kimpay' && locale='" + locale + "'");
            if (records && records.length > 0) {
                const record = records[0];
                let body = record.get("body");
                
                // Replace .svg with .png
                body = body.replace("https://kimpay.io/logo.svg", "https://kimpay.io/logo.png");
                
                record.set("body", body);
                app.save(record);
            }
        } catch (e) {
            console.log("Could not update template for locale " + locale, e);
        }
    });

}, (app) => {
    // Revert logic
})
