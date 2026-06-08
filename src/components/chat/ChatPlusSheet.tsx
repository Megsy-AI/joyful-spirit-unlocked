import { motion, AnimatePresence } from "framer-motion";
import { Image as ImageIcon, Camera, FileUp, Globe, Atom, Wrench, Lightbulb, ChevronRight } from "lucide-react";
import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface ChatPlusSheetProps {
  open: boolean;
  onClose: () => void;
  onCamera: () => void;
  onPhotos: () => void;
  onFiles: () => void;
  onVoiceNote?: () => void;
  onCall?: () => void;
  onPresets?: () => void;
  searchEnabled: boolean;
  onToggleSearch: () => void;
}

const spring = { type: "spring" as const, stiffness: 360, damping: 32 };

interface ItemProps {
  icon: ReactNode;
  label: string;
  trailing?: ReactNode;
  onClick: () => void;
}

const Item = ({ icon, label, trailing, onClick }: ItemProps) => (
  <button
    onClick={onClick}
    className="group w-full flex items-center gap-3 px-3 h-11 rounded-lg hover:bg-accent/60 active:bg-accent transition-colors"
  >
    <span className="w-5 h-5 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
      {icon}
    </span>
    <span className="flex-1 text-left text-[14px] font-medium text-foreground/90">{label}</span>
    {trailing}
  </button>
);

const Kbd = ({ children }: { children: ReactNode }) => (
  <span className="text-[10px] font-mono text-muted-foreground bg-secondary/70 border border-border/60 px-1.5 py-0.5 rounded">
    {children}
  </span>
);

export default function ChatPlusSheet({
  open,
  onClose,
  onCamera,
  onPhotos,
  onFiles,
  searchEnabled,
  onToggleSearch,
}: ChatPlusSheetProps) {
  const navigate = useNavigate();
  const go = (path: string) => { navigate(path); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-foreground/5"
          />
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.98 }}
            transition={spring}
            style={{ transformOrigin: "bottom left" }}
            className="fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[56] mx-auto max-w-[360px] rounded-2xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Attachments group */}
            <div className="p-1.5">
              <Item
                icon={<FileUp className="w-4 h-4" strokeWidth={1.75} />}
                label="Add files"
                trailing={<Kbd>F</Kbd>}
                onClick={() => { onFiles(); onClose(); }}
              />
              <Item
                icon={<Camera className="w-4 h-4" strokeWidth={1.75} />}
                label="Take photo"
                trailing={<Kbd>C</Kbd>}
                onClick={() => { onCamera(); onClose(); }}
              />
              <Item
                icon={<ImageIcon className="w-4 h-4" strokeWidth={1.75} />}
                label="Upload image"
                trailing={<Kbd>U</Kbd>}
                onClick={() => { onPhotos(); onClose(); }}
              />
            </div>

            <div className="h-px bg-border/60 mx-3" />

            {/* Toggle */}
            <div className="p-1.5">
              <button
                onClick={onToggleSearch}
                className="w-full flex items-center gap-3 px-3 h-11 rounded-lg hover:bg-accent/60 transition-colors"
              >
                <span className="w-5 h-5 flex items-center justify-center text-muted-foreground">
                  <Globe className="w-4 h-4" strokeWidth={1.75} />
                </span>
                <span className="flex-1 text-left text-[14px] font-medium text-foreground/90">Web search</span>
                <span
                  className={`relative inline-flex h-[18px] w-8 items-center rounded-full transition-colors ${
                    searchEnabled ? "bg-primary" : "bg-foreground/15"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform ${
                      searchEnabled ? "translate-x-[15px]" : "translate-x-0.5"
                    }`}
                  />
                </span>
              </button>
            </div>

            <div className="h-px bg-border/60 mx-3" />

            {/* Navigation rows */}
            <div className="p-1.5">
              <Item
                icon={<Atom className="w-4 h-4" strokeWidth={1.75} />}
                label="Model"
                trailing={
                  <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    Lite
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                }
                onClick={() => go("/settings/model")}
              />
              <Item
                icon={<Lightbulb className="w-4 h-4" strokeWidth={1.75} />}
                label="Skills"
                trailing={
                  <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    13
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                }
                onClick={() => go("/settings/skills")}
              />
              <Item
                icon={<Wrench className="w-4 h-4" strokeWidth={1.75} />}
                label="Integrations"
                trailing={<ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                onClick={() => go("/settings/integrations")}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
