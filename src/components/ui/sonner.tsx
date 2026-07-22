import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="bottom-right"
      expand={false}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-xl group-[.toaster]:shadow-lg group-[.toaster]:border-2 group-[.toaster]:px-4 group-[.toaster]:py-3",
          title: "group-[.toast]:font-bold group-[.toast]:text-sm",
          description: "group-[.toast]:text-xs group-[.toast]:opacity-80",
          actionButton:
            "group-[.toast]:bg-[#58061C] group-[.toast]:text-white group-[.toast]:rounded-lg group-[.toast]:font-semibold group-[.toast]:text-xs group-[.toast]:px-3 group-[.toast]:py-1.5",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-700 group-[.toast]:rounded-lg group-[.toast]:font-medium group-[.toast]:text-xs",
          success:
            "group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-900 group-[.toaster]:border-emerald-200",
          error:
            "group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 group-[.toaster]:border-red-200",
          info:
            "group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-900 group-[.toaster]:border-blue-200",
          warning:
            "group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-900 group-[.toaster]:border-amber-200",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
