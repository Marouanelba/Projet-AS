import { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
}

// Simple passthrough - pages handle their own layout in this design
const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return <>{children}</>;
};

export default DashboardLayout;
