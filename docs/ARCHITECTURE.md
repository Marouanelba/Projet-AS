# Architecture de l'Application - Annuaire Statistique du Maroc

## 📌 Vue d'ensemble

Cette application est une plateforme de consultation et de gestion des données statistiques du Maroc. Elle permet :
- La **consultation publique** des indicateurs statistiques organisés par thématique
- L'**administration** des données : import, gestion des liaisons temporelles, configuration des fusions

---

## 🛠 Stack technique

| Technologie | Usage |
|-------------|-------|
| **React 18** | Framework frontend |
| **TypeScript** | Typage statique |
| **Vite** | Build tool et dev server |
| **Tailwind CSS** | Styling utilitaire |
| **shadcn/ui** | Composants UI pré-stylés |
| **React Router v6** | Routing SPA |
| **TanStack Query** | Gestion du cache et des requêtes |
| **Supabase** | Backend (BDD PostgreSQL, Auth, Edge Functions) |
| **Sonner** | Notifications toast |

---

## 📁 Structure des fichiers

```
src/
├── App.tsx                 # Routes principales
├── main.tsx                # Point d'entrée
├── index.css               # Styles globaux + tokens CSS
│
├── components/
│   ├── ui/                 # Composants shadcn/ui (Button, Card, etc.)
│   ├── AdminLayout.tsx     # Layout admin avec navigation
│   ├── DataTableWithExport.tsx  # Tableau avec export CSV/Excel
│   ├── FusionStrategyModal.tsx  # Modal de configuration fusion
│   ├── ColumnSelectionModal.tsx # Sélection de colonnes
│   ├── HorizontalExtensionModal.tsx # Extension horizontale
│   ├── StructureComparison.tsx # Comparaison de structures
│   └── SuggestionCard.tsx  # Carte de suggestion IA
│
├── pages/
│   ├── Index.tsx           # Page d'accueil (thématiques)
│   ├── Indicateurs.tsx     # Liste des indicateurs (front)
│   ├── IndicateurPublicDetail.tsx  # Détail indicateur (front)
│   ├── IndicateurGroupDetail.tsx   # Vue groupée multi-années
│   ├── Auth.tsx            # Authentification admin
│   ├── NotFound.tsx        # Page 404
│   └── admin/
│       ├── IndicateursList.tsx    # Liste admin
│       ├── IndicateurDetail.tsx   # Détail admin
│       ├── Liaisons.tsx           # Gestion des liaisons
│       └── ImportData.tsx         # Import de données
│
├── hooks/
│   ├── useAuth.tsx         # Contexte d'authentification
│   ├── useStructureComparison.ts  # Comparaison de structures
│   └── use-toast.ts        # Hook pour les toasts
│
├── lib/
│   ├── utils.ts            # Utilitaires généraux (cn, etc.)
│   └── thematique-utils.ts # Normalisation des noms de thématiques
│
├── integrations/
│   └── supabase/
│       ├── client.ts       # Client Supabase configuré
│       └── types.ts        # Types générés depuis la BDD
│
supabase/
└── functions/
    └── import-data/        # Edge function d'import
        └── index.ts

docs/
├── ARCHITECTURE.md         # Ce fichier
└── REGLES_LIAISONS.md      # Règles métier des liaisons
```

---

## 🗺 Routes de l'application

### Routes publiques (Front-office)

| Route | Composant | Description |
|-------|-----------|-------------|
| `/` | `Index` | Page d'accueil avec liste des thématiques |
| `/indicateurs` | `Indicateurs` | Liste des indicateurs avec filtres |
| `/indicateurs/:id` | `IndicateurPublicDetail` | Détail d'un indicateur |
| `/indicateurs/groupe` | `IndicateurGroupDetail` | Vue groupée multi-années |
| `/auth` | `Auth` | Page de connexion admin |

### Routes admin (Back-office)

| Route | Composant | Description |
|-------|-----------|-------------|
| `/admin/indicateurs` | `IndicateursList` | Liste admin des indicateurs |
| `/admin/indicateurs/:id` | `IndicateurDetail` | Détail admin d'un indicateur |
| `/admin/liaisons` | `Liaisons` | Gestion des liaisons temporelles |
| `/admin/import` | `ImportData` | Import de données JSON |

---

## 🗄 Modèle de données (Supabase)

### Tables principales

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  annuaires  │──1:N─│ thematiques │──1:N─│ indicateurs │
└─────────────┘      └─────────────┘      └─────────────┘
                                                 │
                     ┌───────────────────────────┼───────────────────────────┐
                     │                           │                           │
              ┌──────┴──────┐            ┌───────┴───────┐           ┌───────┴───────┐
              │indicateurs_ │            │indicateurs_   │           │indicateurs_   │
              │   data      │            │   indices     │           │   liaisons    │
              └─────────────┘            └───────────────┘           └───────┬───────┘
                                                                             │
                                                                     ┌───────┴───────┐
                                                                     │indicateurs_   │
                                                                     │   fusion      │
                                                                     └───────────────┘
                                                                     
                                                                     ┌───────────────┐
                                                                     │indicateurs_   │
                                                                     │   ruptures    │
                                                                     └───────────────┘
```

### Description des tables

| Table | Description |
|-------|-------------|
| `annuaires` | Publications annuelles (AS 2019, 2020, etc.) |
| `thematiques` | Catégories d'indicateurs (Agriculture, Population, etc.) |
| `indicateurs` | Métadonnées des indicateurs (titre, code, source, notes) |
| `indicateurs_data` | Données tabulaires (entetes + donnees en JSON) |
| `indicateurs_indices` | Légendes des indices (1), (2), etc. |
| `indicateurs_liaisons` | Liens entre indicateurs de différentes années |
| `indicateurs_fusion` | Données fusionnées pour les liaisons configurées |
| `indicateurs_ruptures` | Marques de discontinuité temporelle |

### Vues SQL

| Vue | Description |
|-----|-------------|
| `v_indicateurs_complets` | Indicateurs avec infos thématique et annuaire |
| `v_indicateurs_sans_liaison` | Indicateurs orphelins (non liés) |
| `v_series_temporelles` | Liaisons avec infos source et cible |

---

## 🔐 Authentification

### Système
- Authentification via **Supabase Auth**
- Email/Password uniquement
- Auto-confirmation des emails activée

### Contexte React
```typescript
// src/hooks/useAuth.tsx
const { user, signIn, signOut, loading } = useAuth();
```

### Règles RLS (Row Level Security)
- **Lecture** : Publique pour toutes les tables
- **Écriture** : Requiert `auth.uid() IS NOT NULL`

---

## 📊 Modules fonctionnels

### 1. Page d'accueil (`Index.tsx`)

**Fonctionnalités :**
- Affichage des thématiques groupées (noms normalisés)
- Comptage des indicateurs par thématique
- Navigation vers la liste filtrée

**Logique clé :**
- Regroupement par nom nettoyé (ignorer casse, accents)
- Tri par nombre d'indicateurs décroissant

---

### 2. Liste des indicateurs (`Indicateurs.tsx`)

**Fonctionnalités :**
- Recherche par titre ou code (tolérant aux espaces)
- Filtres interdépendants Annuaire ↔ Thématique
- Groupement par titre nettoyé (mode "tous les annuaires")
- Affichage des badges "Série liée"

**Logique clé :**
- `extractTitrePropre()` : Nettoie le préfixe code et les suffixes
- Groupement par `titreClean + significationIndice`
- Filtres se réinitialisent si combinaison invalide

---

### 3. Détail indicateur public (`IndicateurPublicDetail.tsx`)

**Fonctionnalités :**
- Affichage des métadonnées (unité, source, notes)
- Mise en évidence des indices (1), (2), etc.
- Navigation dans la série temporelle
- Affichage du tableau fusionné si configuré
- Export CSV/Excel

**Logique clé :**
- Détection automatique de la stratégie (fusion, remplace, série)
- `buildChain()` : Construit la chaîne d'indicateurs liés
- Affichage prioritaire : Fusion > Remplace (plus récent) > Données brutes

---

### 4. Vue groupée (`IndicateurGroupDetail.tsx`)

**Fonctionnalités :**
- Affichage de toutes les années d'un même indicateur
- Sélection d'une année spécifique
- Accès à la série fusionnée si disponible

**Logique clé :**
- Filtrage par titre nettoyé + signification d'indice
- URL params : `?titre=...&signification=...&year=...`

---

### 5. Import de données (`ImportData.tsx`)

**Fonctionnalités :**
- Import de `metadata.json` (annuaires + thématiques)
- Import d'indicateurs individuels ou en lot
- Téléchargement de templates JSON
- Suppression de toutes les données (reset)

**Format metadata.json :**
```json
{
  "annuaires": [
    {
      "annee": "2024",
      "thematiques": [
        {"code": "2", "nom": "Population", "nb_indicateurs": 31}
      ]
    }
  ]
}
```

**Format indicateur.json :**
```json
{
  "code": "2 - 1",
  "thematique_code": "2",
  "annuaire_annee": "2024",
  "titre_fr": "Population totale",
  "entetes": [["Région", "2022", "2023", "2024"]],
  "donnees": [["Casablanca", "7200", "7350", "7500"]]
}
```

---

### 6. Gestion des liaisons (`Liaisons.tsx`)

**Onglets :**
1. **Orphelins** : Indicateurs sans liaison
2. **Suggestions** : Liaisons suggérées par IA (similarité)
3. **Séries** : Liaisons existantes
4. **Créer une liaison** : Création manuelle

**Règles métier :**
→ Voir `docs/REGLES_LIAISONS.md` pour le détail complet

---

### 7. Liste admin (`IndicateursList.tsx`)

**Fonctionnalités :**
- Filtres Annuaire/Thématique interdépendants
- Recherche par code ou titre
- Groupement par titre nettoyé
- Affichage des occurrences par année

---

### 8. Détail admin (`IndicateurDetail.tsx`)

**Fonctionnalités :**
- Affichage complet des métadonnées
- Liste des indices avec significations
- Affichage de la série temporelle
- Tableau de données avec source affichée

---

## 🔧 Utilitaires et hooks

### `normalizeThematiqueName()` (`thematique-utils.ts`)

Normalise les noms de thématiques pour un affichage cohérent :
- Retire les espaces superflus
- Capitalise la première lettre
- Met le reste en minuscules
- Gère les tirets et underscores

```typescript
normalizeThematiqueName("AGRICULTURE") // → "Agriculture"
normalizeThematiqueName("emploi et salaire") // → "Emploi et salaire"
```

### `useStructureComparison()` (`useStructureComparison.ts`)

Compare la structure de deux indicateurs :
- Nombre de colonnes
- Nombre de lignes d'en-tête
- Similarité des textes d'en-tête

Retourne un score de compatibilité (0-100%).

---

## 🎨 Design System

### Tokens CSS (`index.css`)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 262.1 83.3% 57.8%;
  --secondary: 240 4.8% 95.9%;
  --muted: 240 4.8% 95.9%;
  --accent: 240 4.8% 95.9%;
  /* ... */
}
```

### Classes utilitaires
- `.highlight-index` : Mise en évidence des indices
- `.highlight-unit` : Style des unités
- `.highlight-source` : Style des sources
- `.highlight-notes` : Style des notes

---

## 📤 Export de données

Le composant `DataTableWithExport` permet l'export :
- **CSV** : Format texte séparé par virgules
- **Excel** : Format XLSX (via librairie)

Options configurables :
- Sélection des colonnes
- Nom du fichier

---

## 🔄 Edge Functions

### `import-data`

**Endpoint :** `POST /functions/v1/import-data`

**Payload :** JSON (metadata ou indicateur)

**Actions :**
1. Détecte le type de fichier
2. Insert/Update les enregistrements
3. Retourne un rapport d'import

---

## 📱 Responsive Design

L'application est responsive avec :
- Grid layout adaptatif
- Navigation collapsible sur mobile
- Tableaux avec scroll horizontal

---

## 🔒 Sécurité

### RLS Policies
- Toutes les tables ont RLS activé
- Lecture publique
- Écriture authentifiée uniquement

### Bonnes pratiques
- Pas de secrets dans le code
- Validation côté serveur (Edge Functions)
- Sanitization des inputs utilisateur

---

## 📈 Performance

### Optimisations
- Lazy loading des pages (React Router)
- Mise en cache avec TanStack Query
- Indexes sur les colonnes fréquemment filtrées

### Requêtes parallèles
```typescript
const [res1, res2, res3] = await Promise.all([
  supabase.from('table1').select('*'),
  supabase.from('table2').select('*'),
  supabase.from('table3').select('*'),
]);
```

---

## 🚀 Déploiement

- **Frontend** : Lovable (preview automatique)
- **Backend** : Supabase Cloud
- **Edge Functions** : Déploiement automatique

---

*Documentation générée le 19/01/2026*
