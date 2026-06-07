import { useState } from "react";
import { Check, Copy, FileCode2 } from "lucide-react";

interface Props {
  code: string;
  lang?: string;
  className?: string;
  onPreview?: (code: string, lang: string) => void;
}

const LANG_LABEL: Record<string, string> = {
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  py: "Python",
  python: "Python",
  sh: "Shell",
  bash: "Bash",
  zsh: "Shell",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  md: "Markdown",
  sql: "SQL",
  rs: "Rust",
  go: "Go",
  java: "Java",
  c: "C",
  cpp: "C++",
  cs: "C#",
  php: "PHP",
  rb: "Ruby",
  yml: "YAML",
  yaml: "YAML",
  xml: "XML",
};

export default function CodeBlock({ code, lang, className, onPreview }: Props) {
  const [copied, setCopied] = useState(false);
  const label = (lang && (LANG_LABEL[lang.toLowerCase()] || lang.toUpperCase())) || "Code";
  const lines = code.split("\n");
  const tooLong = lines.length > 24;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div
      className="my-3 rounded-2xl overflow-hidden shadow-2xl"
      style={{
        backgroundColor: "hsl(var(--card) / 0.4)",
        boxShadow: "inset 0 0 0 1px hsl(var(--foreground) / 0.1), 0 20px 40px -20px hsl(0 0% 0% / 0.6)",
      }}
      dir="ltr"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-10 border-b"
        style={{
          backgroundColor: "hsl(var(--foreground) / 0.05)",
          borderColor: "hsl(var(--foreground) / 0.06)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-medium tracking-tight uppercase text-muted-foreground truncate">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onPreview && lang && (
            <button
              type="button"
              onClick={() => onPreview(code, lang)}
              className="text-[11px] px-2 h-6 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            >
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-[11px] px-2 h-6 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div
        className="overflow-x-auto"
        style={{ maxHeight: tooLong ? "440px" : undefined, overflowY: tooLong ? "auto" : undefined }}
      >
        <pre className="m-0 p-4 text-[13px] leading-6 font-mono text-indigo-300/90">
          <code className={className}>{code}</code>
        </pre>
      </div>
    </div>
  );
}

