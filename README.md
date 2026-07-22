# Annuaire Statistique — Back-office

Application web de gestion et visualisation d'annuaires statistiques. Elle permet d'importer, organiser et consulter des données statistiques structurées par annuaire, thématique et tableau.

## Fonctionnalités

- Import de métadonnées (annuaires et thématiques) via fichier JSON
- Import de tableaux statistiques avec données détaillées
- Visualisation des tableaux avec support bilingue (français / arabe)
- Construction de graphiques à partir des données
- Gestion des liaisons entre séries statistiques
- Export des données
- Authentification et espace administration

## Technologies

- **Frontend** : React 18, TypeScript, Vite
- **UI** : Tailwind CSS, shadcn/ui, Radix UI
- **Graphiques** : Recharts
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions)
- **Animations** : Framer Motion

## Prérequis

- Node.js (v18+)
- npm ou bun

## Installation

```bash
# Cloner le dépôt
git clone <URL_DU_REPO>
cd AS

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Remplir les valeurs dans .env avec vos identifiants Supabase

# Lancer le serveur de développement
npm run dev
```

## Variables d'environnement

Créer un fichier `.env` à la racine avec :

```
VITE_SUPABASE_PROJECT_ID="votre_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="votre_anon_key"
VITE_SUPABASE_URL="https://votre_project_id.supabase.co"
```

Ces valeurs se trouvent dans le dashboard Supabase : **Settings > API**.

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualiser le build |
| `npm run lint` | Vérification ESLint |

## Structure du projet

```
src/
├── components/       # Composants React (UI, layouts, modals)
├── hooks/            # Hooks personnalisés (auth, comparaison...)
├── integrations/     # Configuration Supabase (client, types)
├── lib/              # Utilitaires (indicateurs, liaisons, motion)
├── pages/            # Pages de l'application (admin, public)
supabase/
├── functions/        # Edge Functions (import-data)
├── migrations/       # Migrations SQL
docs/                 # Documentation (architecture, règles)
```

## Import des données

L'import se fait en deux étapes :

1. **Metadata** : Charger un fichier `metadata.json` qui déclare les annuaires et thématiques
2. **Tableaux** : Charger les fichiers JSON de tableaux statistiques qui se rattachent aux thématiques existantes

## Déploiement Supabase

```bash
# Se connecter
npx supabase login

# Lier au projet
npx supabase link --project-ref VOTRE_PROJECT_ID

# Déployer les Edge Functions
npx supabase functions deploy import-data

# Appliquer les migrations
npx supabase db push
```
