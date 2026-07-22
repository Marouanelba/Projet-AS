# Règles et Logique des Liaisons entre Indicateurs

## 📌 Vue d'ensemble

Le système de liaisons permet de connecter des indicateurs statistiques entre différentes années (annuaires) pour créer des **séries temporelles**. Cela permet de suivre l'évolution d'un même indicateur dans le temps.

---

## 🎯 Objectif

Transformer des indicateurs "orphelins" (non liés) en séries temporelles cohérentes, permettant :
- Le suivi historique des données
- La fusion des données multi-années
- L'extension horizontale des tableaux

---

## 📊 Structure des données

### Entités principales

| Entité | Description |
|--------|-------------|
| **Annuaire** | Publication statistique annuelle (ex: AS 2024, AS 2025) |
| **Thématique** | Catégorie d'indicateurs (ex: Agriculture, Emploi et salaire) |
| **Indicateur** | Tableau de données statistiques appartenant à une thématique |
| **Liaison** | Connexion entre deux indicateurs de différentes années |
| **Fusion** | Configuration de merge des données pour une liaison |
| **Rupture** | Marque qu'un indicateur n'a pas de continuité vers une année |

### Relations

```
Annuaire (1) ──── (N) Thématique (1) ──── (N) Indicateur
                                              │
                                              ├── (N) Liaison (source ou cible)
                                              ├── (1) Data (entetes + donnees)
                                              └── (N) Rupture
```

---

## 🔗 Types de liaisons

| Type | Code | Description | Configuration requise |
|------|------|-------------|----------------------|
| **Série temporelle** | `serie_temporelle` | Continuité simple entre deux années | Non |
| **Fusion** | `fusionne` | Merge des colonnes de données | Oui (colonne de référence) |
| **Remplacement** | `remplace` | L'indicateur source remplace la cible | Non |
| **Identique** | `identique` | Les deux indicateurs sont strictement identiques | Non |
| **Extension horizontale** | `extension_horizontale` | Ajout de colonnes d'années manquantes | Oui (colonne de référence) |

---

## 📏 Règles de création de liaisons

### 1. Règle de thématique unique

> **Source et cible doivent appartenir à la MÊME thématique**

La thématique est normalisée (nettoyée) pour ignorer les différences de casse ou formatage :
- "agriculture" → "Agriculture"
- "EMPLOI ET SALAIRE" → "Emploi et salaire"

### 2. Règles sur les années disponibles

Le comportement dépend du **nombre d'années** disponibles pour une thématique :

#### Cas 1 : Une seule année
```
❌ IMPOSSIBLE de créer une liaison
→ Message : "Cette thématique n'a qu'une seule année"
```

#### Cas 2 : Deux années exactement
```
✅ Liaison directe possible entre les deux
→ Les deux années sont sélectionnables comme source
→ La cible est automatiquement l'autre année
→ Pas de notion de "première/dernière" grisée
```

**Exemple :** Agriculture avec 2024 et 2025
- Source : 2024 → Cible disponible : 2025
- Source : 2025 → Cible disponible : 2024

#### Cas 3 : Trois années ou plus
```
✅ Règle des années intermédiaires
→ Première et dernière année = CIBLE uniquement (grisées en source)
→ Années intermédiaires = SOURCE possible
→ Cible limitée aux années adjacentes (N-1 ou N+1)
```

**Exemple :** Thématique avec 2019, 2020, 2021, 2022, 2023
- 2019 (première) : ❌ Ne peut pas être source
- 2020, 2021, 2022 : ✅ Peuvent être source
- 2023 (dernière) : ❌ Ne peut pas être source

**Pourquoi cette règle ?**
- Une année intermédiaire a **deux voisins** (avant et après)
- La première année n'a qu'un voisin (après)
- La dernière année n'a qu'un voisin (avant)
- En forçant la source à être intermédiaire, on garantit une chaîne bidirectionnelle

### 3. Règle d'adjacence

> **La cible doit être adjacente à la source (N-1 ou N+1)**

Exception : avec seulement 2 années, on retourne l'autre année directement.

**Exemple :**
- Source : 2021 → Cibles possibles : 2020, 2022
- Source : 2022 → Cibles possibles : 2021, 2023

### 4. Règle d'unicité

> **Une liaison ne peut pas exister en double**

Vérification bidirectionnelle :
```javascript
liaisonExists(sourceId, cibleId) = 
  (source→cible existe) OU (cible→source existe)
```

### 5. Règle des ruptures

> **Un indicateur marqué comme rupture n'apparaît plus dans les suggestions**

Une rupture indique qu'il n'y a **pas de continuité** vers une année donnée :
- Rupture "précédente" : pas de continuité vers l'année N-1
- Rupture "suivante" : pas de continuité vers l'année N+1

---

## 🔄 Logique de fusion des données

### Fusion standard (`fusionne`)

Ajoute une colonne de l'année source après une colonne de référence dans la cible.

**Étapes :**
1. Sélectionner une colonne de référence (ex: "2023")
2. Le système insère la colonne "2024" juste après
3. Les données sont alignées par ligne

**Structure résultante :**
```
| Indicateur | 2022 | 2023 | 2024 (ajouté) |
|------------|------|------|---------------|
| PIB        | 100  | 105  | 110           |
```

### Extension horizontale (`extension_horizontale`)

Plus complexe : ajoute plusieurs colonnes d'années manquantes.

**Logique :**
1. Détecte les années présentes dans source et cible
2. Identifie les années manquantes dans la cible
3. Insère les colonnes au bon endroit chronologique
4. Gère les structures multi-niveaux (ex: Urbain/Rural/Ensemble par année)

**Détection des années :**
- Recherche dans les en-têtes (lignes 0, 1, 2...)
- Pattern : 4 chiffres consécutifs (ex: "2024")
- Gère les formats : "2024", "Année 2024", "2024-2025"

**Structure multi-niveaux :**
```
|           | 2023           | 2024 (ajouté)  |
|           | U | R | E      | U | R | E      |
|-----------|---|---|--------|---|---|--------|
| Pop.      | 10| 20| 30     | 11| 21| 32     |
```

---

## 🎨 Interface utilisateur

### Onglet "Orphelins"
- Liste les indicateurs sans liaison
- Filtrable par thématique
- Actions : Marquer comme rupture

### Onglet "Suggestions"
- Suggestions automatiques basées sur similarité des titres
- Seuil de similarité : 40%
- Filtres : Thématique + Année source + Année cible (adjacente)

### Onglet "Séries"
- Liste des liaisons existantes
- Actions : Configurer fusion, Supprimer

### Onglet "Créer une liaison"
- Sélection manuelle : Thématique → Année source → Indicateur source → Année cible → Indicateur cible
- Choix du type de liaison
- Comparaison de structure avant création

---

## 📐 Comparaison de structure

Avant de créer une liaison, le système compare les structures :

| Critère | Poids | Description |
|---------|-------|-------------|
| Nombre de colonnes | 40% | Les deux indicateurs ont-ils le même nombre de colonnes ? |
| Nombre de lignes d'en-tête | 30% | Même structure d'en-têtes multi-niveaux ? |
| Similarité des textes d'en-tête | 30% | Les libellés correspondent-ils ? |

**Score de compatibilité :**
- ≥ 80% : ✅ Compatible
- 50-79% : ⚠️ Partiellement compatible
- < 50% : ❌ Structures différentes

---

## 🔒 Sécurité et permissions

### Lecture
- Publique (tous peuvent voir les liaisons)

### Modification (INSERT, UPDATE, DELETE)
- Authentification requise (`auth.uid() IS NOT NULL`)
- Pas de restriction par rôle (tout utilisateur authentifié)

---

## 📝 Tables de la base de données

### `indicateurs_liaisons`
```sql
id                    -- Identifiant unique
id_indicateur_source  -- FK vers indicateurs
id_indicateur_cible   -- FK vers indicateurs
type_liaison          -- 'serie_temporelle', 'fusionne', etc.
confiance             -- Score de confiance (0-100)
methode_liaison       -- 'manuel', 'suggestion_ia'
notes                 -- Commentaires
created_by            -- Utilisateur créateur
created_at            -- Date de création
```

### `indicateurs_fusion`
```sql
id                    -- Identifiant unique
id_liaison            -- FK vers indicateurs_liaisons
strategie             -- 'par_colonne', 'extension_horizontale'
colonne_selectionnee  -- Colonne de référence
entetes_fusionnees    -- JSON des en-têtes résultants
donnees_fusionnees    -- JSON des données fusionnées
created_at, updated_at
```

### `indicateurs_ruptures`
```sql
id                    -- Identifiant unique
id_indicateur         -- FK vers indicateurs
annee_rupture         -- Année concernée par la rupture
direction             -- 'precedente' ou 'suivante'
notes                 -- Explication de la rupture
created_by, created_at
```

---

## 🔄 Flux de travail recommandé

```
1. Sélectionner une thématique
        ↓
2. Vérifier les orphelins
        ↓
3. Lancer les suggestions IA
        ↓
4. Accepter/Rejeter les suggestions
        ↓
5. Créer manuellement les liaisons restantes
        ↓
6. Configurer les fusions si nécessaire
        ↓
7. Marquer les ruptures pour les indicateurs sans continuité
```

---

## ⚠️ Cas particuliers

### Indicateur déjà lié
- Peut être relié à d'autres indicateurs
- Affiché avec badge "Déjà lié" dans l'interface

### Changement de code indicateur
- Le système ignore les préfixes de code (ex: "2-10" vs "2 - 10")
- Regroupement basé sur le titre nettoyé

### Thématiques avec noms variables
- Normalisation automatique des noms
- "agriculture" = "Agriculture" = "AGRICULTURE"

---

## 📚 Fonctions utilitaires

| Fonction | Description |
|----------|-------------|
| `normalizeThematiqueName(name)` | Nettoie et capitalise le nom de thématique |
| `liaisonExists(sourceId, cibleId)` | Vérifie si une liaison existe déjà |
| `getAnnuairesForThematique(thematique)` | Retourne les années disponibles |
| `getIntermediateAnnuairesForThematique(thematique)` | Retourne les années sélectionnables comme source |
| `getAvailableAnnuairesForCible()` | Retourne les années cibles possibles |
| `hasRupture(indicateurId, direction)` | Vérifie si une rupture existe |

---

*Documentation générée le 19/01/2026*
