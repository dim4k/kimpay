import type { TranslationKey } from "./en";

export const fr: Record<TranslationKey, string> = {
    "app.name": "Kimpay",
    "app.slogan": "Partagez vos frais simplement.",
    "home.create.title": "Créer un Kimpay",
    "home.create.name_label": "Nom du groupe",
    "home.create.name_placeholder": "ex: Voyage à Paris",
    "home.create.my_name_label": "Mon prénom",
    "home.create.my_name_placeholder": "ex: Antoine",
    "home.create.email_label": "Email (Optionnel)",
    "home.create.email_placeholder": "votre@email.com",
    "home.create.email_help":
        "Laissez votre email pour recevoir le lien du Kimpay (utile si vous perdez l'accès).",
    "home.create.participants_label": "Participants (Optionnel)",
    "home.create.participants_placeholder": "Ajouter une personne",
    "home.create.button": "Créer",
    "home.create.loading": "Création...",
    "home.join.title": "OU REJOINDRE",
    "home.join.placeholder": "Code d'invitation",
    "home.join.button": "Rejoindre",
    "home.join.error_not_found": "Kimpay introuvable",
    "home.history.title": "Kimpays Récents",
    "home.history.leave_tooltip": "Quitter le groupe",

    "modal.leave.title": "Quitter le groupe ?",
    "modal.leave.desc":
        "Voulez-vous vraiment retirer ce groupe de votre liste ? Cela vous retirera également des participants.",
    "modal.leave.confirm": "Quitter",

    "modal.delete_expense.title": "Supprimer la dépense ?",
    "modal.delete_expense.desc":
        "Cela supprimera définitivement cette dépense du groupe.",
    "modal.delete_expense.confirm": "Supprimer",

    "common.cancel": "Annuler",
    "common.save": "Enregistrer",
    "common.loading": "Chargement...",
    "common.delete": "Supprimer",
    "common.edit": "Modifier",
    "common.you": "Vous",
    "common.unknown": "Inconnu",

    "nav.expenses": "Dépenses",
    "nav.share": "Partager",
    "nav.balance": "Équilibre",
    "nav.settings": "Réglages",
    "nav.new": "Nouveau",

    "expense.list.title": "Dépenses",
    "expense.list.items": "éléments",
    "expense.list.paid_by": "Payé par",
    "expense.list.for": "Pour",
    "expense.list.reimbursement": "De {from} à {to}",
    "expense.list.empty.title": "Aucune dépense.",
    "expense.list.empty.desc": "Appuyez sur + pour en ajouter.",

    "expense.form.subtitle": "Saisissez les détails ci-dessous",
    "expense.form.desc_label": "Description",
    "expense.form.desc_placeholder": "C'était pour quoi ?",
    "expense.form.amount_label": "Montant",
    "expense.form.amount_placeholder": "0.00",
    "expense.form.paid_by_label": "Payé par",
    "expense.form.paid_by_select": "Choisir le payeur",
    "expense.form.for_whom_label": "Pour qui ?",
    "expense.form.select_all": "Tous",
    "expense.form.select_none": "Aucun",
    "expense.form.date_label": "Date",
    "expense.form.photos_label": "Photos",
    "expense.form.add_photos": "Ajouter des photos",
    "expense.form.photos_disabled_offline": "Photos désactivées hors ligne",
    "expense.form.paid_by_new": "+ Nouveau Participant",
    "expense.form.save_button": "Enregistrer",
    "expense.form.update_button": "Mettre à jour",
    "expense.form.error_select_one": "Sélectionnez au moins une personne.",
    "expense.add.title": "Ajouter une dépense",
    "expense.edit.title": "Modifier la dépense",
    "modal.add_participant.title": "Ajouter un participant",
    "modal.add_participant.placeholder": "Nom",
    "modal.add_participant.confirm": "Ajouter",
    "modal.delete_participant.confirm":
        "Voulez-vous vraiment supprimer ce participant ?",
    "error.participant.used":
        "Impossible de supprimer : ce participant est lié à des dépenses existantes.",

    "settings.title": "Réglages",
    "settings.subtitle": "Gérer les préférences du groupe",
    "settings.share_link": "Lien de partage",
    "settings.share_desc": "Copier le lien pour inviter des amis",
    "settings.share_button": "Copier le lien",
    "settings.copied": "Copié !",
    "settings.edit_group": "Modifier le groupe",
    "settings.participants": "Participants",
    "settings.participants.add": "Add",
    "settings.participants.placeholder": "New name",
    "settings.participants.added": "Ajouté !",
    "settings.switch_identity": "Changer d'identité",
    "settings.switch_modal.desc":
        "Voulez-vous vraiment changer d'identité pour ce participant ?",
    "settings.switched": "Vous êtes maintenant {name}",
    "settings.danger_zone": "Zone de danger",
    "settings.leave_group": "Quitter le groupe",
    "settings.delete_group": "Supprimer le groupe",
    "settings.actions.title": "Actions",
    "settings.actions.remove_desc":
        "Retirer ce groupe de votre liste récente sur cet appareil.",
    "settings.actions.delete_desc":
        "Supprimer définitivement ce groupe et toutes ses données pour tout le monde.",
    "settings.actions.delete_warning":
        "ATTENTION : Cela supprimera définitivement le groupe, toutes les dépenses et toutes les données pour TOUT LE MONDE. Cette action est irréversible.",

    "balance.title": "Équilibre",
    "balance.subtitle": "Qui doit à qui ?",
    "balance.total_spent": "Total dépensé",
    "balance.my_balance": "Mon solde",
    "balance.settle_up": "Comment équilibrer",
    "balance.owes": "doit à",
    "balance.no_debts": "Tout est réglé ! 🎉",
    "balance.empty.title": "Aucune dépense.",
    "balance.empty.desc":
        "Ajoutez des dépenses pour voir comment les partager.",
    "balance.settled.title": "Tout est réglé !",
    "balance.settled.desc":
        "Parfaitement équilibré. Comme toutes choses devraient l'être.",
    "balance.suggested.title": "Paiements suggérés",
    "balance.payer": "Payeur",
    "balance.receiver": "Receveur",
    "balance.pays": "paie",
    "balance.your_summary": "Résumé",
    "balance.total_group": "DÉPENSES TOTALES",
    "balance.you_owe": "VOUS DEVEZ",
    "balance.owed_to_you": "ON VOUS DOIT",

    "balance.settle.modal.title": "Régler la dette ?",
    "balance.settle.modal.desc":
        "Marquer {amount} comme payé de {from} à {to} ?",
    "balance.settle.confirm": "Confirmer le paiement",
    "balance.reimbursement": "Remboursement",
    "balance.status": "STATUT",
    "balance.all_good": "Tout bon 😎",
    "balance.reimbursement.offline_unavailable":
        "Les remboursements ne sont pas disponibles hors ligne.",
    "balance.offline_warning":
        "Vous êtes hors ligne. Les soldes sont basés sur les données en cache et peuvent être obsolètes.",
    "expense.offline_warning":
        "Vous êtes hors ligne. Les dépenses ajoutées seront synchronisées au retour en ligne.",
    "common.offline": "Hors ligne",
    "common.offline_edit_error":
        "Impossible de modifier les dépenses hors ligne",

    "share.title": "Rejoindre",
    "share.desc": "Scannez pour rejoindre",
    "share.invite_button": "Partager le lien",
    "share.invite_friends": "Invitez vos amis pour partager les frais",
    "share.copy_link": "Copier le lien d'invitation",
    "share.copy_success": "Copié !",
    "share.copy_button": "Copier le lien",

    "offline.modal.title": "Mode Hors Ligne",
    "offline.modal.desc":
        "Vous pouvez continuer à utiliser Kimpay avec des limitations.",
    "offline.modal.can_do": "Vous pouvez :",
    "offline.modal.can_view": "Voir vos groupes récents",
    "offline.modal.can_create": "Ajouter dépenses & participants",
    "offline.modal.cannot_do": "Indisponible :",
    "offline.modal.no_reimburse": "Remboursements & Photos",
    "offline.modal.no_sync": "Synchronisation avec les autres",
    "offline.modal.sync_info":
        "Vos données sont sauvegardées et se synchroniseront une fois en ligne.",
    "common.got_it": "Compris",

    "error.offline.title": "Vous êtes hors ligne",
    "error.offline.desc":
        "Cette page n'est pas en cache sur votre appareil. Vérifiez votre connexion.",
    "error.offline.view_cached": "Voir les Kimpays en cache",
    "error.network": "Erreur de connexion. Veuillez réessayer.",
    "error.generic": "Une erreur s'est produite. Veuillez réessayer.",

    "error.404.title": "Oups ! 🛸",
    "error.404.desc":
        "On dirait que vous êtes perdu dans l'hyper-espace. Cette page n'existe pas.",
    "error.404.button": "Retour sur Terre",

    "identity.title": "Qui êtes-vous ?",
    "identity.subtitle":
        "Sélectionnez votre nom ou ajoutez un nouveau participant pour rejoindre ce groupe.",
    "identity.new_name_placeholder": "Votre prénom",
    "identity.create_button": "Rejoindre",
    "identity.join_as": "Rejoindre en tant que {name}",

    "identity.change": "Changer",
    "settings.install.title": "Installation",
    "settings.install.desc":
        "Installez l'application Kimpay sur votre appareil pour un accès plus rapide et une meilleure expérience hors-ligne.",
    "settings.install.desc_mobile":
        "Installez pour un accès rapide et le mode hors-ligne.",
    "settings.install.button": "Installer Kimpay",

    "settings.export.title": "Exporter les données",
    "settings.export.desc":
        "Téléchargez un résumé de ce Kimpay incluant toutes les dépenses et les participants.",
    "settings.bug_report.title": "Signaler un bug",
    "settings.bug_report.desc":
        "Vous avez rencontré un problème ? Signalez-le sur GitHub.",
    "settings.bug_report.button": "Ouvrir une issue GitHub",
    "settings.export.csv": "CSV",
    "settings.export.md": "Markdown",
    "export.col.date": "Date",
    "export.col.desc": "Description",
    "export.col.amount": "Montant",
    "export.col.payer": "Payeur",
    "export.col.for": "Pour",
    "export.meta.date": "Date d'export",
    "export.meta.participants": "Participants",
    "export.meta.expenses": "Dépenses",
    "export.footer": "Généré par Kimpay",
    "install.prompt.title": "Installer Kimpay",
    "install.prompt.desc": "Accès rapide sans navigateur",
    "install.prompt.button": "Installer",
    "error.email.invalid.title": "Email Invalide",
    "error.email.invalid.message": "Veuillez entrer une adresse email valide",
    "home.create.existing_user_modal.title": "Vérifiez vos emails",
    "home.create.existing_user_modal.message":
        "Il semble que cet email soit déjà enregistré. Nous vous avons envoyé un lien magique pour vous connecter. Vous devrez peut-être vous connecter pour accéder à toutes les fonctionnalités.",
    "auth.logout": "Se déconnecter",
    "auth.magic_link_error_title": "Lien invalide ou expiré",
    "auth.magic_link_error_desc":
        "Ce lien n'est plus valide. Veuillez en demander un nouveau.",
    "my_kimpays.title": "Mes Kimpays",
    "my_kimpays.empty": "Vous n'avez rejoint aucun Kimpay pour le moment.",

    "home.recover.title": "Récupérer mes kimpays",
    "home.recover.subtitle": "Entrez votre email pour recevoir un lien magique",
    "home.recover.email_placeholder": "votre@email.com",
    "home.recover.button": "Envoyer le lien magique",
    "home.recover.success": "Lien magique envoyé ! Vérifiez vos emails.",
    "home.recover.success_title": "Lien envoyé !",
    "home.recover.success_desc": "Vérifiez votre boîte de réception.",
    "home.recover.error": "Impossible d'envoyer le lien. Réessayez plus tard.",
    "home.recover.error_not_found": "Aucun compte trouvé avec cet email.",

    "register.title": "S'inscrire",
    "register.desc": "Créez un compte pour sauvegarder vos kimpays.",
    "register.name_placeholder": "Votre Prénom",
    "register.email_placeholder": "votre@email.com",
    "register.button": "S'inscrire",
    "register.success_title": "Compte créé !",
    "register.success_desc": "Vérifiez vos emails pour vous connecter.",
    "register.error_exists": "Ce compte existe déjà. Connectez-vous.",

    "email_help.modal.title": "Pourquoi l'email ?",
    "email_help.modal.desc":
        "Nous utilisons votre email pour sécuriser votre accès.",
    "email_help.modal.point1.title": "Connexion par lien magique",
    "email_help.modal.point1.desc":
        "Nous vous envoyons un lien sécurisé pour vous connecter. Pas de mot de passe à retenir.",
    "email_help.modal.point2.title": "Récupération de compte",
    "email_help.modal.point2.desc":
        "Si vous perdez l'accès à cet appareil, votre email est le seul moyen de récupérer vos kimpays.",

    "login_help.modal.title": "Connexion / Récupération",
    "login_help.modal.desc":
        "Sécurisez votre accès et retrouvez vos kimpays partout.",
    "login_help.button": "Se connecter",

    "common.hello": "Bonjour",
    "modal.logout.title": "Se déconnecter ?",
    "modal.logout.desc": "Êtes-vous sûr de vouloir vous déconnecter ?",
    "modal.logout.confirm": "Se déconnecter",
    "home.join.accordion_title": "Rejoindre un Kimpay",

    "home.offline.title": "Vous êtes hors ligne",
    "home.offline.desc":
        "Créez ou rejoignez un Kimpay une fois en ligne. Vos Kimpays en cache restent accessibles ci-dessous.",

    "join.offline.title": "Connexion requise",
    "join.offline.desc":
        "Rejoindre un Kimpay nécessite une connexion internet. Réessayez une fois en ligne.",
    "common.back_home": "Retour à l'accueil",
};
