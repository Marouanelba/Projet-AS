/**
 * Client API local - Remplace le client Supabase
 * Toutes les requêtes passent par le backend Express local.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ============================================================
// Gestion du token JWT
// ============================================================

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Decode the JWT payload (no signature verification — client-side only).
 * Returns the user fields embedded in the token, or null if absent/invalid.
 */
export function getCurrentUser(): { id: number; email: string; display_name?: string; role?: string; points?: number } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded as { id: number; email: string; display_name?: string; role?: string; points?: number };
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('auth_token');
}

// ============================================================
// Fetch wrapper avec auth automatique
// ============================================================

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

async function request<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  // Construire l'URL avec query params
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) url += `?${queryString}`;
  }

  // Headers par défaut
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  // Ajouter le token si disponible
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // Gérer les erreurs
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorBody.error || `Erreur ${response.status}`);
  }

  // Retourner les données
  const text = await response.text();
  if (!text) return null as T;
  return JSON.parse(text);
}

// ============================================================
// API Auth
// ============================================================

export const auth = {
  async login(email: string, password: string) {
    const data = await request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data;
  },

  async register(email: string, password: string) {
    const data = await request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data;
  },

  async getMe() {
    return request<{ user: any }>('/auth/me');
  },

  async updateProfile(display_name: string) {
    const data = await request<{ user: any; token: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ display_name }),
    });
    setToken(data.token);
    return data;
  },

  async updatePassword(current_password: string, new_password: string) {
    return request<{ message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    });
  },

  signOut() {
    removeToken();
  },

  isAuthenticated(): boolean {
    return !!getToken();
  },
};

// ============================================================
// API Annuaires
// ============================================================

export const annuaires = {
  async getAll(order: 'asc' | 'desc' = 'desc') {
    return request<any[]>('/annuaires', { params: { order } });
  },

  async getById(id: number) {
    return request<any>(`/annuaires/${id}`);
  },
};

// ============================================================
// API Thématiques
// ============================================================

export const thematiques = {
  async getAll(options?: { include_count?: boolean; order?: string; id_annuaire?: number | string }) {
    return request<any[]>('/thematiques', {
      params: {
        include_count: options?.include_count ? 'true' : undefined,
        order: options?.order,
        id_annuaire: options?.id_annuaire ? String(options.id_annuaire) : undefined,
      },
    });
  },

  async getById(id: number) {
    return request<any>(`/thematiques/${id}`);
  },

  async getByAnnuaire(annuaireId: number | string) {
    return request<any[]>('/thematiques', { params: { id_annuaire: annuaireId } });
  },
};

// ============================================================
// API Tableaux
// ============================================================

export const tableaux = {
  async getAll(from = 0, to = 999) {
    return request<any[]>('/tableaux', { params: { from, to } });
  },

  async getById(id: number) {
    return request<any>(`/tableaux/${id}`);
  },

  async getByIdWithFields(id: number, fields?: string) {
    // Pour compatibilité : on récupère le tableau complet et on filtre côté client si nécessaire
    return request<any>(`/tableaux/${id}`);
  },

  async getByThematique(thematiqueId: number | string) {
    return request<any[]>('/tableaux', { params: { id_thematique: thematiqueId } });
  },
};

// ============================================================
// API Tableaux Data
// ============================================================

export const tableauxData = {
  async getByTableau(id_tableau: number) {
    return request<any | null>('/tableaux-data', { params: { id_tableau } });
  },

  async getByTableaux(ids: number[]) {
    return request<any[]>('/tableaux-data', { params: { ids: ids.join(',') } });
  },

  async upsert(id_tableau: number, entetes: any, donnees: any) {
    return request<any>('/tableaux-data', {
      method: 'POST',
      body: JSON.stringify({ id_tableau, entetes, donnees }),
    });
  },
};

// ============================================================
// API Tableaux Indices
// ============================================================

export const tableauxIndices = {
  async getByTableau(id_tableau: number) {
    return request<any[]>('/tableaux-indices', { params: { id_tableau } });
  },

  async getAll(from = 0, to = 999) {
    return request<any[]>('/tableaux-indices', { params: { from, to } });
  },
};

// ============================================================
// API Liaisons
// ============================================================

export const liaisons = {
  async getAll(from = 0, to = 999) {
    return request<any[]>('/liaisons', { params: { from, to } });
  },

  async getById(id: number) {
    return request<any>(`/liaisons/${id}`);
  },

  async create(data: { id_tableau_source: number; id_tableau_cible: number; type_liaison: string; confiance?: number; methode_liaison?: string; notes?: string }) {
    return request<any>('/liaisons', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: number, data: Partial<{ type_liaison: string; confiance: number; methode_liaison: string; notes: string }>) {
    return request<any>(`/liaisons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number) {
    return request<any>(`/liaisons/${id}`, { method: 'DELETE' });
  },
};

// ============================================================
// API Ruptures
// ============================================================

export const ruptures = {
  async getAll(from = 0, to = 999) {
    return request<any[]>('/ruptures', { params: { from, to } });
  },

  async getByTableau(id_tableau: number) {
    return request<any[]>('/ruptures', { params: { id_tableau } });
  },

  async create(data: { id_tableau: number; annee_rupture: string; direction: string; notes?: string }) {
    return request<any>('/ruptures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number) {
    return request<any>(`/ruptures/${id}`, { method: 'DELETE' });
  },
};

// ============================================================
// API Fusion
// ============================================================

export const fusion = {
  async getAll(from = 0, to = 999) {
    return request<any[]>('/fusion', { params: { from, to } });
  },

  async getByLiaison(id_liaison: number) {
    return request<any | null>('/fusion', { params: { id_liaison } });
  },

  async upsert(data: { id_liaison: number; strategie: string; colonne_selectionnee?: string; entetes_fusionnees: any; donnees_fusionnees: any }) {
    return request<any>('/fusion', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number) {
    return request<any>(`/fusion/${id}`, { method: 'DELETE' });
  },
};

// ============================================================
// API Vues
// ============================================================

export const views = {
  async seriesTemporelles(from = 0, to = 999) {
    return request<any[]>('/views/series-temporelles', { params: { from, to } });
  },

  async tableauxComplets(options?: { select?: string; order_by?: string; order_dir?: string; from?: number; to?: number }) {
    return request<any[]>('/views/tableaux-complets', {
      params: {
        select: options?.select,
        order_by: options?.order_by,
        order_dir: options?.order_dir,
        from: options?.from ?? 0,
        to: options?.to ?? 999,
      },
    });
  },

  async tableauxSansLiaison(from = 0, to = 999) {
    return request<any[]>('/views/tableaux-sans-liaison', { params: { from, to } });
  },
};

// ============================================================
// API RPC (fonctions PostgreSQL)
// ============================================================

export const rpc = {
  async findSimilarTableaux(p_tableau_id: number, p_seuil = 0.4) {
    return request<any[]>('/rpc/find-similar-tableaux', {
      method: 'POST',
      body: JSON.stringify({ p_tableau_id, p_seuil }),
    });
  },

  async getSerieTemporelle(p_tableau_id: number) {
    return request<any[]>('/rpc/get-serie-temporelle', {
      method: 'POST',
      body: JSON.stringify({ p_tableau_id }),
    });
  },
};

// ============================================================
// API Admin
// ============================================================

export const admin = {
  async clearTables() {
    return request<{ success: boolean; message: string }>('/admin/clear-tables', {
      method: 'POST',
    });
  },

  async importData(type: string, data: any) {
    return request<{ results: any }>('/admin/import', {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
  },

  async fixCorrectionNames() {
    return request<{ success: boolean; updated: number; message: string }>('/admin/fix-correction-names', {
      method: 'POST',
    });
  },
};

export const corrections = {
  async getTableauDetails(id: number | string, correctionId?: number | string) {
    const url = correctionId
      ? `/corrections/tableaux/${id}?correctionId=${correctionId}`
      : `/corrections/tableaux/${id}`;
    return request<{ tableau: any; history: any[] }>(url);
  },

  async saveCorrection(id: number | string, data: {
    type_element: string;
    row_index?: number;
    col_index?: number;
    valeur_corrigee: string;
    commentaire?: string;
    user_display_name?: string;
  }) {
    return request<{ tableau: any; correction: any }>(`/corrections/tableaux/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async saveStructuralCorrection(id: number | string, data: {
    type_operation:
      | 'entete_merge_cells'
      | 'entete_unmerge_cells'
      | 'entete_move_row'
      | 'entete_move_col'
      | 'entete_insert_row'
      | 'entete_delete_row'
      | 'entete_insert_col'
      | 'entete_delete_col'
      | 'donnees_insert_row'
      | 'donnees_delete_row';
    commentaire?: string;
    user_display_name?: string;
    // merge / unmerge cells
    start_row?: number;
    start_col?: number;
    end_row?: number;
    end_col?: number;
    // row operations
    row_index?: number;
    direction?: 'up' | 'down' | 'left' | 'right';
    // column operations
    col_index?: number;
  }) {
    return request<{ tableau: any; correction: any }>(`/corrections/tableaux/${id}/structure`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePdfUrl(annee: string, pdf_url: string, pdf_path?: string) {
    return request<any>(`/corrections/annuaires/${annee}/pdf-url`, {
      method: 'POST',
      body: JSON.stringify({ pdf_url, pdf_path }),
    });
  },

  async getPendingCorrections() {
    return request<any[]>('/corrections/pending');
  },

  async getHistoryCorrections() {
    return request<any[]>('/corrections/history');
  },

  async approveCorrection(id: number | string) {
    return request<{ success: boolean; message: string }>(`/corrections/${id}/approve`, {
      method: 'POST',
    });
  },

  async rejectCorrection(id: number | string) {
    return request<{ success: boolean; message: string }>(`/corrections/${id}/reject`, {
      method: 'POST',
    });
  },
};

// ============================================================
// Export par défaut (compatible avec l'usage existant)
// ============================================================

const api = {
  auth,
  annuaires,
  thematiques,
  tableaux,
  tableauxData,
  tableauxIndices,
  liaisons,
  ruptures,
  fusion,
  views,
  rpc,
  admin,
  corrections,
};

export default api;

// ============================================================
// UTILISATEURS (admin uniquement)
// ============================================================
export interface Utilisateur {
  id: number;
  email: string;
  display_name: string | null;
  role: 'admin' | 'correcteur' | 'validateur';
  points: number | null;
  created_at: string;
  nb_corrections?: string | number;
}

export const users = {
  async getAll() {
    return request<Utilisateur[]>('/users');
  },

  async create(data: { email: string; password: string; display_name?: string; role: 'correcteur' | 'validateur' }) {
    return request<Utilisateur>('/users', { method: 'POST', body: JSON.stringify(data) });
  },

  async update(id: number, data: { role?: 'correcteur' | 'validateur'; password?: string; display_name?: string }) {
    return request<Utilisateur>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  async remove(id: number) {
    return request<{ message: string }>(`/users/${id}`, { method: 'DELETE' });
  },
};
