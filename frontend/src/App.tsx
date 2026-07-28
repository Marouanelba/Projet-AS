import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Indicateurs from "./pages/Indicateurs";
import IndicateurPublicDetail from "./pages/IndicateurPublicDetail";
import IndicateurGroupDetail from "./pages/IndicateurGroupDetail";
import ThematiqueExplorer from "./pages/ThematiqueExplorer";
import TableauThematiqueDetail from "./pages/TableauThematiqueDetail";
import Auth from "./pages/Auth";
import IndicateursList from "./pages/admin/IndicateursList";
import IndicateurDetail from "./pages/admin/IndicateurDetail";
import Liaisons from "./pages/admin/Liaisons";
import ImportData from "./pages/admin/ImportData";
import Parametres from "./pages/admin/Parametres";
import CorrecteurWorkspace from "./pages/admin/CorrecteurWorkspace";
import Validation from "./pages/admin/Validation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/indicateurs" element={<Indicateurs />} />
              <Route path="/indicateurs/groupe" element={<IndicateurGroupDetail />} />
              <Route path="/indicateurs/:id" element={<IndicateurPublicDetail />} />
              <Route path="/thematique" element={<ThematiqueExplorer />} />
              <Route path="/thematique/tableau/:id" element={<TableauThematiqueDetail />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<IndicateursList />} />
              <Route path="/admin/indicateurs" element={<IndicateursList />} />
              <Route path="/admin/indicateurs/:id" element={<IndicateurDetail />} />
              <Route path="/admin/liaisons" element={<Liaisons />} />
              <Route path="/admin/import" element={<ImportData />} />
              <Route path="/admin/correcteur" element={<CorrecteurWorkspace />} />
              <Route path="/admin/validation" element={<Validation />} />
              <Route path="/admin/parametres" element={<Parametres />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
