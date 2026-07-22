import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Non autorisé' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Ordre important: respect des clés étrangères
    await supabase.from('tableaux_fusion').delete().neq('id', 0);
    await supabase.from('tableaux_liaisons').delete().neq('id', 0);
    await supabase.from('tableaux_ruptures').delete().neq('id', 0);
    await supabase.from('tableaux_data').delete().neq('id', 0);
    await supabase.from('tableaux_indices').delete().neq('id', 0);
    await supabase.from('tableaux').delete().neq('id', 0);
    await supabase.from('thematiques').delete().neq('id', 0);
    await supabase.from('annuaires').delete().neq('id', 0);

    return new Response(
      JSON.stringify({ success: true, message: 'Toutes les tables ont été vidées' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Clear error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});