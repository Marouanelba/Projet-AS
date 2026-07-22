export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      annuaires: {
        Row: {
          annee: string
          created_at: string | null
          id: number
          titre_ar: string | null
          titre_fr: string | null
          updated_at: string | null
        }
        Insert: {
          annee: string
          created_at?: string | null
          id?: number
          titre_ar?: string | null
          titre_fr?: string | null
          updated_at?: string | null
        }
        Update: {
          annee?: string
          created_at?: string | null
          id?: number
          titre_ar?: string | null
          titre_fr?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tableaux: {
        Row: {
          annee_reference: string | null
          code: string
          created_at: string | null
          id: number
          id_thematique: number
          ligne_debut: number | null
          ligne_fin: number | null
          notes_ar: string | null
          notes_fr: string | null
          source_ar: string | null
          source_feuille: string | null
          source_fr: string | null
          titre_ar: string | null
          titre_fr: string
          unite_ar: string | null
          unite_fr: string | null
          updated_at: string | null
        }
        Insert: {
          annee_reference?: string | null
          code: string
          created_at?: string | null
          id?: number
          id_thematique: number
          ligne_debut?: number | null
          ligne_fin?: number | null
          notes_ar?: string | null
          notes_fr?: string | null
          source_ar?: string | null
          source_feuille?: string | null
          source_fr?: string | null
          titre_ar?: string | null
          titre_fr: string
          unite_ar?: string | null
          unite_fr?: string | null
          updated_at?: string | null
        }
        Update: {
          annee_reference?: string | null
          code?: string
          created_at?: string | null
          id?: number
          id_thematique?: number
          ligne_debut?: number | null
          ligne_fin?: number | null
          notes_ar?: string | null
          notes_fr?: string | null
          source_ar?: string | null
          source_feuille?: string | null
          source_fr?: string | null
          titre_ar?: string | null
          titre_fr?: string
          unite_ar?: string | null
          unite_fr?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_id_thematique_fkey"
            columns: ["id_thematique"]
            isOneToOne: false
            referencedRelation: "thematiques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_id_thematique_fkey"
            columns: ["id_thematique"]
            isOneToOne: false
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["thematique_id"]
          },
        ]
      }
      tableaux_data: {
        Row: {
          created_at: string | null
          donnees: Json
          entetes: Json
          id: number
          id_tableau: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          donnees: Json
          entetes: Json
          id?: number
          id_tableau: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          donnees?: Json
          entetes?: Json
          id?: number
          id_tableau?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_data_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: true
            referencedRelation: "tableaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_data_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: true
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["cible_id"]
          },
          {
            foreignKeyName: "indicateurs_data_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: true
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "indicateurs_data_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: true
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_data_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: true
            referencedRelation: "v_tableaux_sans_liaison"
            referencedColumns: ["id"]
          },
        ]
      }
      tableaux_fusion: {
        Row: {
          colonne_selectionnee: string | null
          created_at: string | null
          donnees_fusionnees: Json
          entetes_fusionnees: Json
          id: number
          id_liaison: number
          strategie: string
          updated_at: string | null
        }
        Insert: {
          colonne_selectionnee?: string | null
          created_at?: string | null
          donnees_fusionnees: Json
          entetes_fusionnees: Json
          id?: number
          id_liaison: number
          strategie: string
          updated_at?: string | null
        }
        Update: {
          colonne_selectionnee?: string | null
          created_at?: string | null
          donnees_fusionnees?: Json
          entetes_fusionnees?: Json
          id?: number
          id_liaison?: number
          strategie?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_fusion_id_liaison_fkey"
            columns: ["id_liaison"]
            isOneToOne: true
            referencedRelation: "tableaux_liaisons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_fusion_id_liaison_fkey"
            columns: ["id_liaison"]
            isOneToOne: true
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["liaison_id"]
          },
        ]
      }
      tableaux_indices: {
        Row: {
          code_indice: string
          created_at: string | null
          id: number
          id_tableau: number
          rattache_type: string | null
          rattache_valeurs: Json | null
          signification_ar: string | null
          signification_fr: string | null
        }
        Insert: {
          code_indice: string
          created_at?: string | null
          id?: number
          id_tableau: number
          rattache_type?: string | null
          rattache_valeurs?: Json | null
          signification_ar?: string | null
          signification_fr?: string | null
        }
        Update: {
          code_indice?: string
          created_at?: string | null
          id?: number
          id_tableau?: number
          rattache_type?: string | null
          rattache_valeurs?: Json | null
          signification_ar?: string | null
          signification_fr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_indices_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "tableaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_indices_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["cible_id"]
          },
          {
            foreignKeyName: "indicateurs_indices_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "indicateurs_indices_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_indices_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_tableaux_sans_liaison"
            referencedColumns: ["id"]
          },
        ]
      }
      tableaux_liaisons: {
        Row: {
          confiance: number | null
          created_at: string | null
          created_by: string | null
          id: number
          id_tableau_cible: number
          id_tableau_source: number
          methode_liaison: string | null
          notes: string | null
          type_liaison: string
        }
        Insert: {
          confiance?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          id_tableau_cible: number
          id_tableau_source: number
          methode_liaison?: string | null
          notes?: string | null
          type_liaison?: string
        }
        Update: {
          confiance?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: number
          id_tableau_cible?: number
          id_tableau_source?: number
          methode_liaison?: string | null
          notes?: string | null
          type_liaison?: string
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_cible_fkey"
            columns: ["id_tableau_cible"]
            isOneToOne: false
            referencedRelation: "tableaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_cible_fkey"
            columns: ["id_tableau_cible"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["cible_id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_cible_fkey"
            columns: ["id_tableau_cible"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_cible_fkey"
            columns: ["id_tableau_cible"]
            isOneToOne: false
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_cible_fkey"
            columns: ["id_tableau_cible"]
            isOneToOne: false
            referencedRelation: "v_tableaux_sans_liaison"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_source_fkey"
            columns: ["id_tableau_source"]
            isOneToOne: false
            referencedRelation: "tableaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_source_fkey"
            columns: ["id_tableau_source"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["cible_id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_source_fkey"
            columns: ["id_tableau_source"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_source_fkey"
            columns: ["id_tableau_source"]
            isOneToOne: false
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_liaisons_id_indicateur_source_fkey"
            columns: ["id_tableau_source"]
            isOneToOne: false
            referencedRelation: "v_tableaux_sans_liaison"
            referencedColumns: ["id"]
          },
        ]
      }
      tableaux_ruptures: {
        Row: {
          annee_rupture: string
          created_at: string | null
          created_by: string | null
          direction: string
          id: number
          id_tableau: number
          notes: string | null
        }
        Insert: {
          annee_rupture: string
          created_at?: string | null
          created_by?: string | null
          direction: string
          id?: number
          id_tableau: number
          notes?: string | null
        }
        Update: {
          annee_rupture?: string
          created_at?: string | null
          created_by?: string | null
          direction?: string
          id?: number
          id_tableau?: number
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "indicateurs_ruptures_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "tableaux"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_ruptures_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["cible_id"]
          },
          {
            foreignKeyName: "indicateurs_ruptures_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_series_temporelles"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "indicateurs_ruptures_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicateurs_ruptures_id_indicateur_fkey"
            columns: ["id_tableau"]
            isOneToOne: false
            referencedRelation: "v_tableaux_sans_liaison"
            referencedColumns: ["id"]
          },
        ]
      }
      thematiques: {
        Row: {
          code: string
          created_at: string | null
          fichier_source: string | null
          id: number
          id_annuaire: number
          nb_indicateurs: number | null
          nom_ar: string | null
          nom_fr: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          fichier_source?: string | null
          id?: number
          id_annuaire: number
          nb_indicateurs?: number | null
          nom_ar?: string | null
          nom_fr: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          fichier_source?: string | null
          id?: number
          id_annuaire?: number
          nb_indicateurs?: number | null
          nom_ar?: string | null
          nom_fr?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "thematiques_id_annuaire_fkey"
            columns: ["id_annuaire"]
            isOneToOne: false
            referencedRelation: "annuaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thematiques_id_annuaire_fkey"
            columns: ["id_annuaire"]
            isOneToOne: false
            referencedRelation: "v_tableaux_complets"
            referencedColumns: ["annuaire_id"]
          },
        ]
      }
    }
    Views: {
      v_series_temporelles: {
        Row: {
          cible_annee: string | null
          cible_code: string | null
          cible_id: number | null
          cible_titre: string | null
          confiance: number | null
          liaison_id: number | null
          methode_liaison: string | null
          source_annee: string | null
          source_code: string | null
          source_id: number | null
          source_titre: string | null
          type_liaison: string | null
        }
        Relationships: []
      }
      v_tableaux_complets: {
        Row: {
          annuaire_annee: string | null
          annuaire_id: number | null
          code: string | null
          id: number | null
          notes_ar: string | null
          notes_fr: string | null
          source_ar: string | null
          source_fr: string | null
          thematique_code: string | null
          thematique_id: number | null
          thematique_nom: string | null
          titre_ar: string | null
          titre_fr: string | null
          unite_ar: string | null
          unite_fr: string | null
        }
        Relationships: []
      }
      v_tableaux_sans_liaison: {
        Row: {
          annee: string | null
          code: string | null
          id: number | null
          thematique: string | null
          titre_fr: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      find_similar_tableaux: {
        Args: { p_seuil?: number; p_tableau_id: number }
        Returns: {
          annee: string
          code: string
          id: number
          similarite: number
          thematique: string
          titre_fr: string
        }[]
      }
      get_serie_temporelle: {
        Args: { p_tableau_id: number }
        Returns: {
          annee: string
          code: string
          donnees: Json
          id: number
          titre_fr: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
