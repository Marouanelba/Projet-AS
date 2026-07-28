import { useRef, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// Chart builder component for data visualization
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon, AreaChart as AreaChartIcon, Download, ImageIcon, Settings2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ChartBuilderProps {
  entetes: any[][];
  donnees: any[][];
}

type ChartType = "bar" | "line" | "pie" | "area";

// Couleurs pour les graphiques
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c43",
  "#a05195",
];

const PIE_COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c43",
  "#a05195",
  "#d45087",
];

export default function ChartBuilder({ entetes, donnees }: ChartBuilderProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  
  // États
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedColumns, setSelectedColumns] = useState<number[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [labelColumn, setLabelColumn] = useState<number>(0);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Extraire les en-têtes de la dernière ligne (noms des colonnes)
  const columnHeaders = useMemo(() => {
    if (!entetes || entetes.length === 0) return [];
    const colCount = Math.max(...entetes.map(r => r?.length || 0));
    return Array.from({ length: colCount }, (_, i) => {
      // Fusionner les entêtes multi-lignes : prendre les valeurs non vides de chaque ligne
      const parts: string[] = [];
      for (const row of entetes) {
        const cell = row?.[i];
        const val = cell == null ? "" : String(cell).trim();
        if (val && !parts.includes(val)) parts.push(val);
      }
      return {
        index: i,
        label: parts.join(" - ") || `Col ${i + 1}`,
      };
    });
  }, [entetes]);

  // Extraire les labels des lignes (première colonne généralement)
  const rowLabels = useMemo(() => {
    if (!donnees || donnees.length === 0) return [];
    return donnees.map((row, i) => ({
      index: i,
      label: String(row[labelColumn] || `Ligne ${i + 1}`),
    }));
  }, [donnees, labelColumn]);

  // Colonnes disponibles pour le graphique (exclure la colonne label)
  const numericColumns = useMemo(() => {
    return columnHeaders.filter((col, i) => {
      if (i === labelColumn) return false;
      return true;
    });
  }, [columnHeaders, labelColumn]);

  // Initialiser les sélections par défaut — tout sélectionner
  useMemo(() => {
    if (selectedColumns.length === 0 && numericColumns.length > 0) {
      setSelectedColumns(numericColumns.map(c => c.index));
    }
    if (selectedRows.length === 0 && rowLabels.length > 0) {
      setSelectedRows(rowLabels.map(r => r.index));
    }
  }, [numericColumns, rowLabels]);

  // Préparer les données pour le graphique
  const chartData = useMemo(() => {
    if (selectedRows.length === 0 || selectedColumns.length === 0) return [];

    return selectedRows.map(rowIndex => {
      const row = donnees[rowIndex];
      const dataPoint: Record<string, string | number> = {
        name: String(row[labelColumn] || `Ligne ${rowIndex + 1}`),
      };

      selectedColumns.forEach(colIndex => {
        const header = columnHeaders.find(h => h.index === colIndex);
        const value = row[colIndex];
        const numValue = parseFloat(String(value).replace(/\s/g, "").replace(",", "."));
        dataPoint[header?.label || `col_${colIndex}`] = isNaN(numValue) ? 0 : numValue;
      });

      return dataPoint;
    });
  }, [selectedRows, selectedColumns, donnees, labelColumn, columnHeaders]);

  // Données pour le pie chart (une seule série)
  const pieData = useMemo(() => {
    if (selectedRows.length === 0 || selectedColumns.length === 0) return [];
    
    const colIndex = selectedColumns[0];
    const header = columnHeaders.find(h => h.index === colIndex);
    
    return selectedRows.map((rowIndex, i) => {
      const row = donnees[rowIndex];
      const value = row[colIndex];
      const numValue = parseFloat(String(value).replace(/\s/g, "").replace(",", "."));
      
      return {
        name: String(row[labelColumn] || `Ligne ${rowIndex + 1}`),
        value: isNaN(numValue) ? 0 : numValue,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      };
    });
  }, [selectedRows, selectedColumns, donnees, labelColumn, columnHeaders]);

  // Toggle colonne
  const toggleColumn = useCallback((colIndex: number) => {
    setSelectedColumns(prev => 
      prev.includes(colIndex) 
        ? prev.filter(c => c !== colIndex)
        : [...prev, colIndex]
    );
  }, []);

  // Toggle ligne
  const toggleRow = useCallback((rowIndex: number) => {
    setSelectedRows(prev => 
      prev.includes(rowIndex) 
        ? prev.filter(r => r !== rowIndex)
        : [...prev, rowIndex]
    );
  }, []);

  // Sélectionner/désélectionner toutes les colonnes
  const toggleAllColumns = useCallback(() => {
    if (selectedColumns.length === numericColumns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(numericColumns.map(c => c.index));
    }
  }, [selectedColumns, numericColumns]);

  // Sélectionner/désélectionner toutes les lignes
  const toggleAllRows = useCallback(() => {
    if (selectedRows.length === rowLabels.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(rowLabels.map(r => r.index));
    }
  }, [selectedRows, rowLabels]);

  // Export en image
  const exportAsImage = useCallback(async (format: "png" | "jpeg") => {
    if (!chartRef.current) return;

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const link = document.createElement("a");
      link.download = `graphique.${format}`;
      link.href = canvas.toDataURL(`image/${format}`, 0.9);
      link.click();

      toast({
        title: "Export réussi",
        description: `Le graphique a été téléchargé en ${format.toUpperCase()}.`,
      });
    } catch (error) {
      console.error("Erreur export:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'exporter le graphique.",
        variant: "destructive",
      });
    }
  }, []);

  // Séries pour le graphique
  const seriesKeys = useMemo(() => {
    return selectedColumns.map(colIndex => {
      const header = columnHeaders.find(h => h.index === colIndex);
      return header?.label || `col_${colIndex}`;
    });
  }, [selectedColumns, columnHeaders]);

  // Icône du type de graphique
  const ChartTypeIcon = {
    bar: BarChart3,
    line: LineChartIcon,
    pie: PieChartIcon,
    area: AreaChartIcon,
  }[chartType];

  if (numericColumns.length === 0) {
    return (
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-12 text-center">
        <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 font-medium">Aucune donnée numérique disponible pour créer un graphique.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EA580C] to-[#C2410C] flex items-center justify-center">
            <ChartTypeIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Visualisation graphique</h3>
            <p className="text-xs text-slate-500">Personnalisez le type, les colonnes et les lignes à afficher</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className={`gap-2 rounded-xl border-2 transition-all ${isConfigOpen ? 'border-[#EA580C]/30 bg-[#EA580C]/8 text-[#EA580C]' : 'border-slate-200'}`}
        >
          <Settings2 className="h-4 w-4" />
          {isConfigOpen ? "Masquer" : "Configurer"}
        </Button>
      </div>

      {/* Configuration panel */}
      {isConfigOpen && (
        <div className="bg-white border-2 border-[#EA580C]/15 rounded-2xl p-6 space-y-6">
          {/* Type de graphique */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Type de graphique</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { type: "bar" as ChartType, icon: BarChart3, label: "Barres", color: "rose" },
                { type: "line" as ChartType, icon: LineChartIcon, label: "Lignes", color: "amber" },
                { type: "area" as ChartType, icon: AreaChartIcon, label: "Aires", color: "emerald" },
                { type: "pie" as ChartType, icon: PieChartIcon, label: "Camembert", color: "amber" },
              ].map(({ type, icon: Icon, label, color }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    chartType === type
                      ? `border-${color}-400 bg-${color}-50 text-${color}-700 shadow-sm`
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Colonne des labels */}
          <div className="space-y-3">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Colonne des étiquettes (axe X)</Label>
            <Select value={String(labelColumn)} onValueChange={(val) => setLabelColumn(parseInt(val))}>
              <SelectTrigger className="w-full sm:w-[300px] rounded-xl border-2 border-slate-200 bg-white h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnHeaders.map((col) => (
                  <SelectItem key={col.index} value={String(col.index)}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sélection des colonnes (séries) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Colonnes à afficher
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EA580C]/15 text-[#EA580C]">{selectedColumns.length}</span>
              </Label>
              <button onClick={toggleAllColumns} className="text-xs font-semibold text-[#EA580C] hover:text-[#EA580C]">
                {selectedColumns.length === numericColumns.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-3 rounded-xl border-2 border-slate-200 bg-slate-50">
              {numericColumns.map((col, i) => (
                <label key={col.index}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium"
                  style={{
                    borderColor: selectedColumns.includes(col.index) ? CHART_COLORS[i % CHART_COLORS.length] : '#e2e8f0',
                    backgroundColor: selectedColumns.includes(col.index) ? `${CHART_COLORS[i % CHART_COLORS.length]}12` : 'white',
                    color: selectedColumns.includes(col.index) ? CHART_COLORS[i % CHART_COLORS.length] : '#475569',
                  }}>
                  <Checkbox checked={selectedColumns.includes(col.index)} onCheckedChange={() => toggleColumn(col.index)} />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Sélection des lignes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Lignes à afficher
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">{selectedRows.length}</span>
              </Label>
              <button onClick={toggleAllRows} className="text-xs font-semibold text-[#EA580C] hover:text-[#EA580C]">
                {selectedRows.length === rowLabels.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-3 rounded-xl border-2 border-slate-200 bg-slate-50">
              {rowLabels.map((row) => (
                <label key={row.index}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium ${
                    selectedRows.includes(row.index) ? 'border-[#EA580C]/50 bg-[#EA580C]/8 text-[#EA580C]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}>
                  <Checkbox checked={selectedRows.includes(row.index)} onCheckedChange={() => toggleRow(row.index)} />
                  <span className="truncate max-w-[180px]">{row.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

        {/* Graphique */}
        {chartData.length > 0 && selectedColumns.length > 0 ? (
          <div ref={chartRef} className="p-4 bg-white rounded-lg">
            <ResponsiveContainer width="100%" height={400}>
              {chartType === "bar" ? (
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    angle={-45} 
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  {seriesKeys.map((key, i) => (
                    <Bar 
                      key={key} 
                      dataKey={key} 
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              ) : chartType === "line" ? (
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    angle={-45} 
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  {seriesKeys.map((key, i) => (
                    <Line 
                      key={key} 
                      type="monotone" 
                      dataKey={key} 
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: CHART_COLORS[i % CHART_COLORS.length], strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              ) : chartType === "area" ? (
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11 }} 
                    angle={-45} 
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }} 
                  />
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  {seriesKeys.map((key, i) => (
                    <Area 
                      key={key} 
                      type="monotone" 
                      dataKey={key} 
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={`${CHART_COLORS[i % CHART_COLORS.length]}40`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              ) : (
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={120}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "white", 
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                    }}
                    formatter={(value: number) => value.toLocaleString("fr-FR")}
                  />
                  <Legend />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
            <ImageIcon className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 font-medium">Sélectionnez au moins une colonne et une ligne pour générer le graphique.</p>
          </div>
        )}

        {/* Boutons d'export */}
        {chartData.length > 0 && selectedColumns.length > 0 && (
          <div className="flex flex-wrap gap-3 justify-end">
            <Button variant="outline" size="sm" onClick={() => exportAsImage("png")} className="gap-2 rounded-xl border-2 border-slate-200 hover:border-[#EA580C]/30 hover:bg-[#EA580C]/8">
              <Download className="h-4 w-4" /> PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportAsImage("jpeg")} className="gap-2 rounded-xl border-2 border-slate-200 hover:border-[#EA580C]/30 hover:bg-[#EA580C]/8">
              <Download className="h-4 w-4" /> JPEG
            </Button>
          </div>
        )}
    </div>
  );
}
