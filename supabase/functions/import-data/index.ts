import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// TYPE 1: metadata.json structure
interface MetadataThematique {
  code: string;
  nom: string;
  nom_ar?: string;
  nb_indicateurs?: number;
  nb_tableaux?: number;  // Alias pour nb_indicateurs
  fichier_source?: string;
}

interface MetadataAnnuaire {
  annee: string;
  titre_fr?: string;
  titre_ar?: string;
  thematiques: MetadataThematique[];
}

interface MetadataImport {
  annuaires: MetadataAnnuaire[];
}

// TYPE 2: tableau file structure
interface TableauImport {
  code: string;
  thematique_code: string;
  thematique_nom?: string;  // Fallback: match by normalized name
  annuaire_annee: string;
  titre_fr: string;
  titre_ar?: string;
  unite?: { fr?: string; ar?: string };
  source?: { fr?: string; ar?: string };
  notes?: { fr?: string; ar?: string };
  indices?: Record<string, { signification_fr?: string; signification_ar?: string; rattache_type?: string; rattache_valeurs?: any }>;
  entetes?: any[];
  donnees?: any[];
}

// Normalize thematique name for fuzzy matching
function normalizeThematiqueName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove accents
    .replace(/^\d+[\s.\-_)]+/, '')  // Remove leading numbers like "1 - ", "2."
    .replace(/[_\-\.]+/g, ' ')
    .replace(/\s*(as\s*\d*|a\s*mis.*|annuaire.*)\s*$/i, '')  // Remove suffixes like "as2024"
    .replace(/\s+/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Import-data function called');
    
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No valid auth header');
      return new Response(
        JSON.stringify({ error: 'Non autorisé - Token manquant' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !data?.claims) {
      console.error('Auth error:', JSON.stringify(claimsError));
      return new Response(
        JSON.stringify({ error: `Erreur d'authentification: ${claimsError?.message || 'Token invalide'}` }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = data.claims.sub;
    const userEmail = data.claims.email;
    console.log('User authenticated:', userEmail);

    const importData = await req.json();
    
    // Detect file type
    const isMetadata = 'annuaires' in importData;
    const isTableau = 'code' in importData && 'thematique_code' in importData;

    if (!isMetadata && !isTableau) {
      return new Response(
        JSON.stringify({ error: 'Format JSON non reconnu. Attendu: metadata.json (clé "annuaires") ou tableau (clés "code" et "thematique_code")' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      type: isMetadata ? 'metadata' : 'tableau',
      annuaires: { inserted: 0, errors: [] as string[] },
      thematiques: { inserted: 0, errors: [] as string[] },
      indicateurs: { inserted: 0, errors: [] as string[] },
      indices: { inserted: 0, errors: [] as string[] },
      data: { inserted: 0, errors: [] as string[] }
    };

    if (isMetadata) {
      // TYPE 1: metadata.json
      const metadata = importData as MetadataImport;
      console.log(`Processing metadata: ${metadata.annuaires.length} annuaires`);

      for (const annuaire of metadata.annuaires) {
        // Insert annuaire - ONLY use data from JSON, no defaults
        const annuaireData: Record<string, any> = { annee: annuaire.annee };
        // Only add titre_fr/titre_ar if provided in JSON
        if (annuaire.titre_fr !== undefined) annuaireData.titre_fr = annuaire.titre_fr;
        if (annuaire.titre_ar !== undefined) annuaireData.titre_ar = annuaire.titre_ar;

        const { data: insertedAnnuaire, error: annuaireError } = await supabase
          .from('annuaires')
          .upsert(annuaireData, { onConflict: 'annee' })
          .select('id')
          .single();

        if (annuaireError) {
          console.error('Annuaire error:', annuaireError);
          results.annuaires.errors.push(`${annuaire.annee}: ${annuaireError.message}`);
          continue;
        }
        results.annuaires.inserted++;

        // Insert thematiques for this annuaire - ONLY use data from JSON
        for (const them of annuaire.thematiques) {
          const themData: Record<string, any> = {
            id_annuaire: insertedAnnuaire.id,
            code: them.code,
            nom_fr: them.nom
          };
          // Only add optional fields if provided
          if (them.nom_ar !== undefined) themData.nom_ar = them.nom_ar;
          // Accept both nb_tableaux and nb_indicateurs
          const nbCount = them.nb_tableaux ?? them.nb_indicateurs;
          if (nbCount !== undefined) themData.nb_indicateurs = nbCount;
          if (them.fichier_source !== undefined) themData.fichier_source = them.fichier_source;

          const { error: themError } = await supabase
            .from('thematiques')
            .upsert(themData, { onConflict: 'id_annuaire,code' });

          if (themError) {
            console.error('Thematique error:', themError);
            results.thematiques.errors.push(`${annuaire.annee}/${them.code}: ${themError.message}`);
          } else {
            results.thematiques.inserted++;
          }
        }
      }
    } else {
      // TYPE 2: tableau file
      const tab = importData as TableauImport;
      console.log(`Processing tableau: ${tab.code} (${tab.annuaire_annee}/${tab.thematique_code})`);

      // Find or create annuaire
      let annuaire: { id: number } | null = null;
      const { data: existingAnnuaire } = await supabase
        .from('annuaires')
        .select('id')
        .eq('annee', tab.annuaire_annee)
        .maybeSingle();

      if (existingAnnuaire) {
        annuaire = existingAnnuaire;
      } else {
        console.log(`Annuaire ${tab.annuaire_annee} not found, creating it automatically`);
        const { data: newAnnuaire, error: createError } = await supabase
          .from('annuaires')
          .upsert({ annee: tab.annuaire_annee }, { onConflict: 'annee' })
          .select('id')
          .single();
        if (createError) {
          return new Response(
            JSON.stringify({ error: `Impossible de créer l'annuaire ${tab.annuaire_annee}: ${createError.message}`, results }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        annuaire = newAnnuaire;
        results.annuaires.inserted++;
      }

      // Resolve thematique code - if "0", try to extract from tableau code (e.g. "11 - 1" → "11")
      let resolvedThemCode = tab.thematique_code;
      if (resolvedThemCode === '0' || resolvedThemCode === '00') {
        const codeMatch = tab.code.match(/^(\d+)\s*[-–]\s*\d+/);
        if (codeMatch) {
          resolvedThemCode = codeMatch[1];
          console.log(`thematique_code was "${tab.thematique_code}", extracted "${resolvedThemCode}" from tableau code "${tab.code}"`);
        }
      }

      // Find thematique - first by resolved code, then fallback by normalized name
      let thematique: { id: number } | null = null;
      const { data: existingThem } = await supabase
        .from('thematiques')
        .select('id')
        .eq('id_annuaire', annuaire.id)
        .eq('code', resolvedThemCode)
        .maybeSingle();

      if (existingThem) {
        thematique = existingThem;
      } else if (tab.thematique_nom) {
        // Fallback: match by normalized name
        const normalizedInput = normalizeThematiqueName(tab.thematique_nom);
        console.log(`Code "${tab.thematique_code}" not found, trying name match: "${tab.thematique_nom}" → normalized: "${normalizedInput}"`);
        
        const { data: allThems } = await supabase
          .from('thematiques')
          .select('id, nom_fr, code')
          .eq('id_annuaire', annuaire.id);

        if (allThems) {
          const match = allThems.find(t => normalizeThematiqueName(t.nom_fr) === normalizedInput);
          if (match) {
            console.log(`Name match found: "${match.nom_fr}" (code: ${match.code})`);
            thematique = { id: match.id };
          } else {
            // Try partial/includes match
            const partialMatch = allThems.find(t => {
              const norm = normalizeThematiqueName(t.nom_fr);
              return norm.includes(normalizedInput) || normalizedInput.includes(norm);
            });
            if (partialMatch) {
              console.log(`Partial name match found: "${partialMatch.nom_fr}" (code: ${partialMatch.code})`);
              thematique = { id: partialMatch.id };
            }
          }
        }
      }

      if (!thematique) {
        const searchInfo = tab.thematique_nom 
          ? `code "${resolvedThemCode}" (original: "${tab.thematique_code}") / nom "${tab.thematique_nom}"`
          : `code "${resolvedThemCode}" (original: "${tab.thematique_code}")`;
        console.warn(`Thématique ${searchInfo} not found for annuaire ${tab.annuaire_annee}, skipping tableau ${tab.code}`);
        results.indicateurs.errors.push(`${tab.code}: Thématique ${searchInfo} introuvable pour l'AS ${tab.annuaire_annee} — tableau ignoré`);
        return new Response(
          JSON.stringify({ success: true, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if tableau already exists — skip if so
      const { data: existingTab } = await supabase
        .from('tableaux')
        .select('id')
        .eq('id_thematique', thematique.id)
        .eq('code', tab.code)
        .maybeSingle();

      if (existingTab) {
        console.log(`Tableau ${tab.code} already exists (id: ${existingTab.id}), skipping`);
        results.indicateurs.errors.push(`${tab.code}: déjà existant — ignoré`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert tableau
      const { data: insertedTab, error: tabError } = await supabase
        .from('tableaux')
        .insert({
          id_thematique: thematique.id,
          code: tab.code,
          titre_fr: tab.titre_fr,
          titre_ar: tab.titre_ar,
          unite_fr: tab.unite?.fr,
          unite_ar: tab.unite?.ar,
          source_fr: tab.source?.fr,
          source_ar: tab.source?.ar,
          notes_fr: tab.notes?.fr,
          notes_ar: tab.notes?.ar
        })
        .select('id')
        .single();

      if (tabError) {
        console.error('Tableau error:', tabError);
        results.indicateurs.errors.push(`${tab.code}: ${tabError.message}`);
      } else {
        results.indicateurs.inserted++;

        // Insert indices if provided
        if (tab.indices && Object.keys(tab.indices).length > 0) {
          for (const [codeIndice, indiceData] of Object.entries(tab.indices)) {
            const { error: indiceError } = await supabase
              .from('tableaux_indices')
              .insert({
                id_tableau: insertedTab.id,
                code_indice: codeIndice,
                signification_fr: indiceData.signification_fr,
                signification_ar: indiceData.signification_ar,
                rattache_type: indiceData.rattache_type,
                rattache_valeurs: indiceData.rattache_valeurs
              });

            if (indiceError) {
              results.indices.errors.push(`${codeIndice}: ${indiceError.message}`);
            } else {
              results.indices.inserted++;
            }
          }
        }

        // Insert data if provided
        if (tab.entetes || tab.donnees) {
          const { error: dataError } = await supabase
            .from('tableaux_data')
            .insert({
              id_tableau: insertedTab.id,
              entetes: tab.entetes || [],
              donnees: tab.donnees || []
            });

          if (dataError) {
            results.data.errors.push(`${tab.code}: ${dataError.message}`);
          } else {
            results.data.inserted++;
          }
        }
      }
    }

    console.log('Import completed:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
