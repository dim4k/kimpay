migrate((app) => {
    const collection = app.findCollectionByNameOrId("email_templates");

    // 1. Update French Template
    try {
        const frRecord = app.findFirstRecordByFilter("email_templates", "slug='share_kimpay' && locale='fr'");
        if (frRecord) {
            frRecord.set("subject", "{creator} vous invite à rejoindre \"{name}\" sur Kimpay");
            frRecord.set("body", `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
    
    <div style="text-align: center; margin-bottom: 30px;">
       <img src="https://kimpay.io/logo.svg" width="64" height="64" alt="Kimpay" style="border-radius: 12px;" />
    </div>

    <h2 style="color: #0f172a; font-size: 24px; font-weight: 800; margin-bottom: 16px; text-align: center; letter-spacing: -0.025em;">
       {creator} vous invite !
    </h2>
    
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px; text-align: center;">
       Rejoignez le groupe <strong style="color: #4f46e5;">{name}</strong> pour suivre et partager les dépenses simplement entre amis.
    </p>

    <div style="text-align: center; margin-bottom: 40px;">
       <a href="{url}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: transform 0.2s;">
         Rejoindre le Groupe
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
        }
    } catch (e) {
        console.log("Could not update FR template", e);
    }

    // 2. Update English Template
    try {
        const enRecord = app.findFirstRecordByFilter("email_templates", "slug='share_kimpay' && locale='en'");
        if (enRecord) {
            enRecord.set("subject", "{creator} invited you to join \"{name}\" on Kimpay");
            enRecord.set("body", `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);">
    
    <div style="text-align: center; margin-bottom: 30px;">
       <img src="https://kimpay.io/logo.svg" width="64" height="64" alt="Kimpay" style="border-radius: 12px;" />
    </div>

    <h2 style="color: #0f172a; font-size: 24px; font-weight: 800; margin-bottom: 16px; text-align: center; letter-spacing: -0.025em;">
       {creator} invited you!
    </h2>
    
    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px; text-align: center;">
       Join the group <strong style="color: #4f46e5;">{name}</strong> to easily track and split expenses with friends.
    </p>

    <div style="text-align: center; margin-bottom: 40px;">
       <a href="{url}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 16px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); transition: transform 0.2s;">
         Join the Group
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
        }
    } catch (e) {
        console.log("Could not update EN template", e);
    }

}, (app) => {
    // Revert logic (optional, keeping it simple for now as it's just content update)
})
