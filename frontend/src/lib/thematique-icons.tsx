import { 
  Users, 
  Briefcase, 
  GraduationCap, 
  Stethoscope, 
  Home, 
  Sprout, 
  Factory, 
  Car, 
  Wifi, 
  Scale, 
  Globe, 
  Building2, 
  TrendingUp, 
  Banknote, 
  Droplets, 
  Zap, 
  TreePine, 
  Mountain, 
  ShoppingCart, 
  Plane, 
  Ship, 
  Train, 
  Landmark, 
  Heart, 
  Baby, 
  MapPin, 
  Calendar, 
  Database,
  BarChart3,
  PieChart,
  Activity,
  Wallet,
  LucideIcon
} from "lucide-react";

interface ThemeIconConfig {
  keywords: string[];
  icon: LucideIcon;
  color: string; // Tailwind color class
}

const themeIconConfigs: ThemeIconConfig[] = [
  // Population & Démographie
  { 
    keywords: ["population", "demograph", "habitant", "recensement"], 
    icon: Users, 
    color: "bg-blue-500/10 text-blue-600" 
  },
  { 
    keywords: ["naissance", "fecondite", "natalite", "enfant"], 
    icon: Baby, 
    color: "bg-pink-500/10 text-pink-600" 
  },
  { 
    keywords: ["mortalite", "deces", "esperance"], 
    icon: Heart, 
    color: "bg-red-500/10 text-red-600" 
  },
  
  // Emploi & Économie
  { 
    keywords: ["emploi", "salaire", "travail", "chomage", "activite"], 
    icon: Briefcase, 
    color: "bg-orange-500/10 text-orange-600" 
  },
  { 
    keywords: ["economie", "pib", "croissance", "conjoncture"], 
    icon: TrendingUp, 
    color: "bg-emerald-500/10 text-emerald-600" 
  },
  { 
    keywords: ["finance", "banque", "credit", "monetaire", "budget"], 
    icon: Banknote, 
    color: "bg-green-500/10 text-green-600" 
  },
  { 
    keywords: ["prix", "inflation", "consommation", "indice"], 
    icon: ShoppingCart, 
    color: "bg-yellow-500/10 text-yellow-600" 
  },
  { 
    keywords: ["revenu", "menage", "pauvrete", "niveau de vie"], 
    icon: Wallet, 
    color: "bg-violet-500/10 text-violet-600" 
  },
  
  // Éducation & Formation
  { 
    keywords: ["education", "enseignement", "ecole", "scolaire", "etudiant", "formation"], 
    icon: GraduationCap, 
    color: "bg-indigo-500/10 text-indigo-600" 
  },
  
  // Santé
  { 
    keywords: ["sante", "hopital", "medecin", "maladie", "sanitaire"], 
    icon: Stethoscope, 
    color: "bg-teal-500/10 text-teal-600" 
  },
  
  // Logement & Construction
  { 
    keywords: ["logement", "habitat", "construction", "immobilier"], 
    icon: Home, 
    color: "bg-amber-500/10 text-amber-600" 
  },
  { 
    keywords: ["urbanisme", "ville", "urbain"], 
    icon: Building2, 
    color: "bg-slate-500/10 text-slate-600" 
  },
  
  // Agriculture & Environnement
  { 
    keywords: ["agricul", "agric", "culture", "cereale", "betail", "elevage"], 
    icon: Sprout, 
    color: "bg-lime-500/10 text-lime-600" 
  },
  { 
    keywords: ["eau", "hydraulique", "irrigation", "assainissement"], 
    icon: Droplets, 
    color: "bg-cyan-500/10 text-cyan-600" 
  },
  { 
    keywords: ["foret", "environnement", "ecologie", "vert"], 
    icon: TreePine, 
    color: "bg-green-600/10 text-green-700" 
  },
  { 
    keywords: ["climat", "meteo", "temperature", "precipitation"], 
    icon: Mountain, 
    color: "bg-sky-500/10 text-sky-600" 
  },
  
  // Industrie & Énergie
  { 
    keywords: ["industrie", "manufactur", "production", "mine"], 
    icon: Factory, 
    color: "bg-gray-500/10 text-gray-600" 
  },
  { 
    keywords: ["energie", "electricite", "petrole", "gaz"], 
    icon: Zap, 
    color: "bg-yellow-600/10 text-yellow-700" 
  },
  
  // Transport & Communication
  { 
    keywords: ["transport", "route", "automobile", "vehicule", "circulation"], 
    icon: Car, 
    color: "bg-rose-500/10 text-rose-600" 
  },
  { 
    keywords: ["aerien", "avion", "aeroport"], 
    icon: Plane, 
    color: "bg-blue-400/10 text-blue-500" 
  },
  { 
    keywords: ["maritime", "port", "naval", "peche"], 
    icon: Ship, 
    color: "bg-blue-600/10 text-blue-700" 
  },
  { 
    keywords: ["ferroviaire", "train", "rail"], 
    icon: Train, 
    color: "bg-zinc-500/10 text-zinc-600" 
  },
  { 
    keywords: ["communication", "telecom", "internet", "numerique"], 
    icon: Wifi, 
    color: "bg-purple-500/10 text-purple-600" 
  },
  
  // Commerce & Tourisme
  { 
    keywords: ["commerce", "echange", "export", "import", "exterieur"], 
    icon: Globe, 
    color: "bg-emerald-600/10 text-emerald-700" 
  },
  { 
    keywords: ["tourisme", "hotel", "visiteur"], 
    icon: MapPin, 
    color: "bg-fuchsia-500/10 text-fuchsia-600" 
  },
  
  // Justice & Administration
  { 
    keywords: ["justice", "tribunal", "juridique", "droit"], 
    icon: Scale, 
    color: "bg-stone-500/10 text-stone-600" 
  },
  { 
    keywords: ["administration", "public", "gouvernement", "etat"], 
    icon: Landmark, 
    color: "bg-neutral-500/10 text-neutral-600" 
  },
  
  // Temps & Périodes
  { 
    keywords: ["annuel", "mensuel", "periodique", "temporel"], 
    icon: Calendar, 
    color: "bg-slate-400/10 text-slate-500" 
  },
  
  // Statistiques générales
  { 
    keywords: ["statistique", "donnee", "chiffre"], 
    icon: BarChart3, 
    color: "bg-primary/10 text-primary" 
  },
  { 
    keywords: ["repartition", "structure", "composition"], 
    icon: PieChart, 
    color: "bg-indigo-400/10 text-indigo-500" 
  },
  { 
    keywords: ["evolution", "tendance", "dynamique"], 
    icon: Activity, 
    color: "bg-cyan-600/10 text-cyan-700" 
  },
];

export interface ThemeIconResult {
  Icon: LucideIcon;
  colorClass: string;
}

/**
 * Retourne l'icône et la couleur appropriées pour une thématique donnée
 */
export const getThematiqueIcon = (thematiqueName: string): ThemeIconResult => {
  const normalizedName = thematiqueName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const config of themeIconConfigs) {
    for (const keyword of config.keywords) {
      const normalizedKeyword = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedName.includes(normalizedKeyword)) {
        return { Icon: config.icon, colorClass: config.color };
      }
    }
  }
  
  // Default
  return { Icon: Database, colorClass: "bg-muted text-muted-foreground" };
};
