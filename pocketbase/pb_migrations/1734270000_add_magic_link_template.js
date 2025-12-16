migrate((app) => {
    const collection = app.findCollectionByNameOrId("email_templates");

    // 1. French Template
    const frRecord = new Record(collection);
    frRecord.set("slug", "login_magic_link");
    frRecord.set("locale", "fr");
    frRecord.set("subject", "Connexion à Kimpay");
    frRecord.set("body", `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
    
    <div style="text-align: center; margin-bottom: 30px;">
       <img src="https://kimpay.io/logo.png" width="64" height="64" alt="Kimpay" style="border-radius: 12px;" />
    </div>

    <h2 style="color: #0f172a; font-size: 24px; font-weight: 800; margin-bottom: 16px; text-align: center; letter-spacing: -0.025em;">
       Connexion à Kimpay
    </h2>
    
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px; text-align: center;">
       Cliquez sur le bouton ci-dessous pour vous connecter instantanément.
    </p>

    <div style="text-align: center; margin-bottom: 40px;">
       <a href="{url}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: transform 0.2s;">
         Me Connecter
       </a>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; text-align: center;">
       <p style="color: #94a3b8; font-size: 12px; margin: 0;">
         Si le bouton ne fonctionne pas, copiez ce lien :<br>
         <a href="{url}" style="color: #64748b; text-decoration: none; word-break: break-all;">{url}</a>
       </p>
    </div>
    
  </div>
  <div style="text-align: center; margin-top: 24px;">
     <p style="color: #cbd5e1; font-size: 12px;">© Kimpay - Dépenses partagées simplifiées</p>
  </div>
</div>
    `);
    app.save(frRecord);

    // 2. English Template
    const enRecord = new Record(collection);
    enRecord.set("slug", "login_magic_link");
    enRecord.set("locale", "en");
    enRecord.set("subject", "Login to Kimpay");
    enRecord.set("body", `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
    
    <div style="text-align: center; margin-bottom: 30px;">
       <img src="https://kimpay.io/logo.png" width="64" height="64" alt="Kimpay" style="border-radius: 12px;" />
    </div>

    <h2 style="color: #0f172a; font-size: 24px; font-weight: 800; margin-bottom: 16px; text-align: center; letter-spacing: -0.025em;">
       Login to Kimpay
    </h2>
    
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px; text-align: center;">
       Click the button below to log in instantly.
    </p>

    <div style="text-align: center; margin-bottom: 40px;">
       <a href="{url}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: transform 0.2s;">
         Log In
       </a>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 24px; text-align: center;">
       <p style="color: #94a3b8; font-size: 12px; margin: 0;">
         If the button doesn't work, copy this link:<br>
         <a href="{url}" style="color: #64748b; text-decoration: none; word-break: break-all;">{url}</a>
       </p>
    </div>
    
  </div>
  <div style="text-align: center; margin-top: 24px;">
     <p style="color: #cbd5e1; font-size: 12px;">© Kimpay - Shared expenses made simple</p>
  </div>
</div>
    `);
    app.save(enRecord);

}, (app) => {
    // Revert logic
    try {
        const records = app.findRecordsByFilter("email_templates", "slug='login_magic_link'");
        records.forEach(r => app.delete(r));
    } catch(e) {}
})
