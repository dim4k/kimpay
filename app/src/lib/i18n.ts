import { derived, writable } from "svelte/store";

export const locales = {
    en: {
        "app.name": "Kimpay",
        "app.slogan": "The easiest way to split expenses.",
        "home.create.title": "Create a Kimpay",
        "home.create.name_label": "Group Name",
        "home.create.name_placeholder": "e.g. Trip to Paris",
        "home.create.my_name_label": "My Name",
        "home.create.my_name_placeholder": "e.g. Antoine",
        "home.create.email_label": "Email (Optional)",
        "home.create.email_placeholder": "your@email.com",
        "home.create.email_help":
            "Leave your email to receive the Kimpay link (useful if you lose access).",
        "home.create.participants_label": "Participants (Optional)",
        "home.create.participants_placeholder": "Add another person",
        "home.create.button": "Create",
        "home.create.loading": "Creating...",
        "home.join.title": "OR JOIN EXISTING",
        "home.join.placeholder": "Enter invite code",
        "home.join.button": "Join",
        "home.join.error_not_found": "Kimpay not found",
        "home.history.title": "Recent Kimpays",
        "home.history.leave_tooltip": "Leave group",

        "modal.leave.title": "Leave Group?",
        "modal.leave.desc":
            "Are you sure you want to remove this group from your recent list? This will also remove you as a participant.",
        "modal.leave.confirm": "Leave",

        "modal.delete_expense.title": "Delete Expense?",
        "modal.delete_expense.desc":
            "This will permanently remove this expense from the group.",
        "modal.delete_expense.confirm": "Delete",

        "common.cancel": "Cancel",
        "common.save": "Save",
        "common.loading": "Loading...",
        "common.delete": "Delete",
        "common.edit": "Edit",
        "common.you": "You",
        "common.unknown": "Unknown",

        "nav.expenses": "Expenses",
        "nav.share": "Share",
        "nav.balance": "Balance",
        "nav.settings": "Settings",
        "nav.new": "New",

        "expense.list.title": "Expenses",
        "expense.list.items": "items",
        "expense.list.paid_by": "Paid by",
        "expense.list.for": "For",
        "expense.list.reimbursement": "From {from} to {to}",
        "expense.list.empty.title": "No expenses yet.",
        "expense.list.empty.desc": "Tap + to add one.",

        "expense.form.subtitle": "Enter details below",
        "expense.form.desc_label": "Description",
        "expense.form.desc_placeholder": "What was it for?",
        "expense.form.amount_label": "Amount",
        "expense.form.amount_placeholder": "0.00",
        "expense.form.paid_by_label": "Paid By",
        "expense.form.paid_by_select": "Select Payer",
        "expense.form.for_whom_label": "For Whom?",
        "expense.form.select_all": "Select All",
        "expense.form.select_none": "Select None",
        "expense.form.date_label": "Date",
        "expense.form.photos_label": "Photos",
        "expense.form.add_photos": "Add Photos",
        "expense.form.paid_by_new": "+ New Participant",
        "expense.form.save_button": "Save Expense",
        "expense.form.update_button": "Update Expense",
        "expense.form.error_select_one": "Select at least one person.",
        "expense.add.title": "Add Expense",
        "expense.edit.title": "Edit Expense",
        "modal.add_participant.title": "Add Participant",
        "modal.add_participant.placeholder": "Name",
        "modal.add_participant.confirm": "Add",
        "modal.delete_participant.confirm":
            "Are you sure you want to delete this participant?",
        "error.participant.used":
            "Cannot delete: This participant is part of existing expenses.",

        "settings.title": "Settings",
        "settings.subtitle": "Manage group preferences",
        "settings.share_link": "Share Link",
        "settings.share_desc": "Copy the link to invite friends",
        "settings.share_button": "Copy Link",
        "settings.copied": "Copied!",
        "settings.edit_group": "Edit Group",
        "settings.participants": "Participants",
        "settings.participants.add": "Add",
        "settings.participants.placeholder": "New name",
        "settings.participants.added": "Added!",
        "settings.switch_identity": "Switch identity",
        "settings.switch_modal.desc":
            "Are you sure you want to switch to this identity?",
        "settings.switched": "You are now {name}",
        "settings.danger_zone": "Danger Zone",
        "settings.leave_group": "Leave Group",
        "settings.delete_group": "Delete Group",
        "settings.actions.title": "Actions",
        "settings.actions.remove_desc":
            "Remove this group from your recent list on this device.",
        "settings.actions.delete_desc":
            "Permanently delete this group and all its data for everyone.",
        "settings.actions.delete_warning":
            "WARNING: This will permanently delete the group, all expenses, and all data for EVERYONE. This action cannot be undone.",

        "balance.title": "Balance",
        "balance.subtitle": "Who owes who?",
        "balance.total_spent": "Total Spent",
        "balance.my_balance": "My Balance",
        "balance.settle_up": "How to settle up",
        "balance.owes": "owes",
        "balance.no_debts": "All settled up! 🎉",
        "balance.empty.title": "No expenses yet.",
        "balance.empty.desc": "Start adding expenses to see how to split them.",
        "balance.settled.title": "All settled up!",
        "balance.settled.desc": "Perfectly balanced, as all things should be.",
        "balance.suggested.title": "Suggested Payments",
        "balance.payer": "Payer",
        "balance.receiver": "Receiver",
        "balance.pays": "pays",
        "balance.your_summary": "Summary",
        "balance.total_group": "TOTAL EXPENSES",
        "balance.you_owe": "YOU OWE",
        "balance.owed_to_you": "YOU ARE OWED",

        "balance.settle.modal.title": "Settle Debt?",
        "balance.settle.modal.desc":
            "Mark {amount} as paid from {from} to {to}?",
        "balance.settle.confirm": "Confirm Payment",
        "balance.reimbursement": "Reimbursement",
        "balance.status": "STATUS",
        "balance.all_good": "All good 😎",
        "balance.reimbursement.offline_unavailable": "Reimbursements are not available offline.",
        "common.offline": "Offline",

        "share.title": "Join Group",
        "share.desc": "Scan to join",
        "share.invite_button": "Share Invite Link",
        "share.invite_friends": "Invite friends to split expenses",
        "share.copy_link": "Copy Invite Link",
        "share.copy_success": "Copied!",
        "share.copy_button": "Copy Link",

        "offline.modal.title": "You are Offline",
        "offline.modal.desc": "You can continue using Kimpay with limitations.",
        "offline.modal.can_do": "You can:",
        "offline.modal.can_view": "View recent groups",
        "offline.modal.can_create": "Add expenses & participants",
        "offline.modal.cannot_do": "Not available:",
        "offline.modal.no_reimburse": "Reimbursements & Photos",
        "offline.modal.no_sync": "Syncing with others",
        "offline.modal.sync_info": "Data validates locally and syncs automatically when online.",
        "common.got_it": "Got it",

        "error.404.title": "Oops! 🛸",
        "error.404.desc":
            "Looks like you've drifted into deep space. This page doesn't exist.",
        "error.404.button": "Back to Earth",

        "identity.title": "Who are you?",
        "identity.subtitle":
            "Select your name or add a new participant to join this group.",
        "identity.new_name_placeholder": "Your name",
        "identity.create_button": "Join as new",
        "identity.join_as": "Join as {name}",

        "identity.change": "Switch",
        "settings.install.title": "Installation",
        "settings.install.desc":
            "Install Kimpay on your device for faster access and a better offline experience.",
        "settings.install.button": "Install Kimpay",

        "settings.export.title": "Export Data",
        "settings.export.desc":
            "Download a summary of this Kimpay including all expenses and participants.",
        "settings.bug_report.title": "Report a Bug",
        "settings.bug_report.desc":
            "Encountered an issue? Let us know on GitHub.",
        "settings.bug_report.button": "Open GitHub Issue",
        "settings.export.csv": "CSV",
        "settings.export.md": "Markdown",
        "export.col.date": "Date",
        "export.col.desc": "Description",
        "export.col.amount": "Amount",
        "export.col.payer": "Payer",
        "export.col.for": "For",
        "export.meta.date": "Export Date",
        "export.meta.participants": "Participants",
        "export.meta.expenses": "Expenses",
        "export.footer": "Generated by Kimpay",
        "install.prompt.title": "Install Kimpay",
        "install.prompt.desc": "Quick access without browser",
        "install.prompt.button": "Install",
    },
    fr: {
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
        "balance.reimbursement.offline_unavailable": "Les remboursements ne sont pas disponibles hors ligne.",
        "common.offline": "Hors ligne",

        "share.title": "Rejoindre",
        "share.desc": "Scannez pour rejoindre",
        "share.invite_button": "Partager le lien",
        "share.invite_friends": "Invitez vos amis pour partager les frais",
        "share.copy_link": "Copier le lien d'invitation",
        "share.copy_success": "Copié !",
        "share.copy_button": "Copier le lien",

        "offline.modal.title": "Mode Hors Ligne",
        "offline.modal.desc": "Vous pouvez continuer à utiliser Kimpay avec des limitations.",
        "offline.modal.can_do": "Vous pouvez :",
        "offline.modal.can_view": "Voir vos groupes récents",
        "offline.modal.can_create": "Ajouter dépenses & participants",
        "offline.modal.cannot_do": "Indisponible :",
        "offline.modal.no_reimburse": "Remboursements & Photos",
        "offline.modal.no_sync": "Synchronisation avec les autres",
        "offline.modal.sync_info": "Vos données sont sauvegardées et se synchroniseront une fois en ligne.",
        "common.got_it": "Compris",

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
    },
};

function getInitialLocale() {
    if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("locale");
        if (saved) return saved;
    }
    if (typeof navigator !== "undefined") {
        const lang = navigator.language?.split("-")[0];
        return lang && lang in locales ? lang : "en";
    }
    return "en";
}

export const locale = writable(getInitialLocale());

locale.subscribe((value) => {
    if (typeof localStorage !== "undefined") {
        localStorage.setItem("locale", value);
    }
});

export const t = derived(
    locale,
    ($locale) =>
        (key: string, vars: Record<string, string> = {}) => {
            const dictionary = locales as Record<
                string,
                Record<string, string>
            >;
            let text =
                dictionary[$locale]?.[key] || dictionary["en"]?.[key] || key;

            // Simple variable replacement {var}
            Object.keys(vars).forEach((k) => {
                const regex = new RegExp(`{${k}}`, "g");
                text = text.replace(regex, vars[k] || "");
            });

            return text;
        }
);
