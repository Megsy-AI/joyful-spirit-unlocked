import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Premium toast — floating glass card, theme-aware, with crisp colored icons.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
      offset={"max(16px, env(safe-area-inset-bottom))" as unknown as number}
      duration={1800}
      visibleToasts={1}
      gap={8}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: [
            "group toast pointer-events-auto",
            "flex items-center gap-2.5 w-auto mx-auto",
            "px-3.5 py-2",
            "rounded-full",
            "bg-popover/95 backdrop-blur-xl",
            "border border-border/60",
            "shadow-[0_8px_28px_-12px_hsl(var(--foreground)/0.18)]",
            "text-popover-foreground",
            "antialiased",
          ].join(" "),
          title: "text-[13px] font-medium leading-snug tracking-[-0.01em]",
          description:
            "text-[12px] font-normal leading-snug text-muted-foreground",
          icon: "shrink-0 [&_svg]:w-4 [&_svg]:h-4",
          actionButton:
            "!bg-primary !text-primary-foreground rounded-full px-2.5 py-1 text-[12px] font-semibold hover:!bg-primary/90 transition",
          cancelButton:
            "!bg-muted !text-muted-foreground rounded-full px-2.5 py-1 text-[12px] font-medium hover:!bg-muted/70 transition",
          closeButton:
            "!bg-muted/60 hover:!bg-muted !text-foreground !border-transparent",
          success: "[&>[data-icon]]:text-emerald-500",
          error: "[&>[data-icon]]:text-rose-500",
          info: "[&>[data-icon]]:text-sky-500",
          warning: "[&>[data-icon]]:text-amber-500",
          loading: "[&>[data-icon]]:text-muted-foreground",
        },
      }}
      style={
        {
          "--width": "auto",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster, toast };
