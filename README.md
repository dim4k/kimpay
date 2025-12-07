# ✈️ Kimpay

**Kimpay** est une application web moderne de partage de dépenses (type Tricount) conçue pour être simple, rapide et agréable à utiliser.

![Kimpay Home](https://via.placeholder.com/800x400?text=Kimpay+Screenshot)

## ✨ Fonctionnalités

- **Création Express** : Créez un groupe en quelques secondes avec un emoji et un nom.
- **Partage Facile** : Invitez des amis via un code court (6 caractères) ou un lien direct.
- **Gestion des Dépenses** : Ajoutez des dépenses en précisant qui a payé et pour qui.
- **Équilibrage Automatique** : Algorithme intelligent pour minimiser les remboursements (“Qui doit à qui”).
- **International** : Disponible en Français 🇫🇷 et Anglais 🇬🇧.
- **Mode Sombre** : Interface élégante supportant le mode clair et sombre.
- **Fun & Réactif** : Animations fluides, emojis et design soigné.

## 🛠️ Stack Technique

- **Frontend** : [SvelteKit](https://kit.svelte.dev/) (SSR/CSR) + [TailwindCSS](https://tailwindcss.com/)
- **Backend** : [PocketBase](https://pocketbase.io/) (Base de données SQLite temps réel + Auth)
- **Déploiement** : [Docker Compose](https://docs.docker.com/compose/)

## 🚀 Installation & Démarrage

Le projet est entièrement conteneurisé. Vous avez juste besoin de Docker.

1. **Cloner le projet**
   ```bash
   git clone <votre-repo>
   cd kimpay
   ```

2. **Lancer l'application**
   ```bash
   docker compose up -d --build
   ```

3. **Accéder à l'application**
   - Frontend : [http://localhost:3000](http://localhost:3000)
   - Backend (PocketBase) : [http://localhost:8090/_/](http://localhost:8090/_/)


## 🛡️ Accessibilité & Qualité

- **A11y** : Conforme aux standards d'accessibilité (navigation clavier, rôles ARIA).
- **Responsive** : Fonctionne parfaitement sur mobile, tablette et desktop.

---

*Fait avec ❤️ pour simplifier vos vacances.*
