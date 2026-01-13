/* apps/frontend/src/pages/onboarding/PublicSteps.tsx */

import { DragEvent } from "react";

/* ------------------ Types ------------------ */
export type Upload = { name?: string; key?: string; file?: File; docType?: string };

export type Slot = {
  key: string;
  label: string;
  accept?: string;
  required?: boolean;
  multiple?: boolean;
  hint?: string;
};

/* ------------------ Small UI helpers ------------------ */
export function Label({
  children,
  required = false,
  hint,
}: {
  children: any;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-[13px] font-medium text-zinc-700 tracking-wide">
        {children} {required && <span className="text-red-500">*</span>}
      </label>
      {hint ? <span className="text-[11px] text-zinc-400">{hint}</span> : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl bg-white/70 border border-zinc-200 px-3 py-2 text-sm outline-none " +
        "focus:ring-2 focus:ring-[#00477f]/40 focus:border-[#00477f]/40 transition " +
        "placeholder:text-zinc-400 " +
        (props.className || "")
      }
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-xl bg-white/70 border border-zinc-200 px-3 py-2 text-sm outline-none min-h-[96px] " +
        "focus:ring-2 focus:ring-[#00477f]/40 focus:border-[#00477f]/40 transition " +
        "placeholder:text-zinc-400 " +
        (props.className || "")
      }
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl bg-white/70 border border-zinc-200 px-3 py-2 text-sm outline-none " +
        "focus:ring-2 focus:ring-[#00477f]/40 focus:border-[#00477f]/40 transition " +
        (props.className || "")
      }
    />
  );
}

export function AIBadge({ text = "AI hint" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full
      bg-gradient-to-r from-[#b8b3ff] via-[#9ef0ff] to-[#4cffb0] text-[#0b1130] shadow-sm">
      ✨ {text}
    </span>
  );
}

export function AITip({ children }: { children: any }) {
  return (
    <div className="text-[11px] text-zinc-500 bg-white/60 border border-zinc-200 rounded-lg px-3 py-2">
      <span className="mr-1">🤖</span>
      {children}
    </div>
  );
}

/* ------------------ Structured Docs Uploader ------------------ */
export function StructuredDocsStep({
  files,
  setFiles,
  slots,
}: {
  files: Upload[];
  setFiles: (u: Upload[] | ((s: Upload[]) => Upload[])) => void;
  slots: Slot[];
}) {
  const byType: Record<string, Upload[]> = {};
  for (const f of files) {
    const t = f.docType || "others";
    (byType[t] ||= []).push(f);
  }

  function onAdd(typeKey: string, list: FileList | null) {
    if (!list) return;
    const incoming: Upload[] = Array.from(list).map((f) => ({
      name: f.name,
      key: f.name,
      file: f,
      docType: typeKey,
    }));
    setFiles((s) => [...s, ...incoming]);
  }

  function onDrop(typeKey: string, e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    onAdd(typeKey, e.dataTransfer.files);
  }

  function removeAt(typeKey: string, idx: number) {
    setFiles((s) => {
      const out: Upload[] = [];
      let seen = -1;
      for (const f of s) {
        if ((f.docType || "others") !== typeKey) {
          out.push(f);
          continue;
        }
        seen += 1;
        if (seen !== idx) out.push(f);
      }
      return out;
    });
  }

  return (
    <div className="grid gap-5">
      <AITip>
        Drag & drop files into each slot or click to browse. Prefer PDFs under 10&nbsp;MB.
      </AITip>

      {slots.map((slot) => {
        const list = byType[slot.key] || [];
        return (
          <div key={slot.key} className="rounded-2xl border bg-white/80 backdrop-blur">
            <div className="px-4 py-2 border-b bg-zinc-50/70 text-sm font-semibold text-zinc-700">
              {slot.label} {slot.required && <span className="text-red-600">(required)</span>}
            </div>
            <div className="p-4 grid gap-3">
              <div
                className="rounded-xl border-2 border-dashed border-zinc-200 p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(slot.key, e)}
              >
                <Input
                  type="file"
                  accept={slot.accept}
                  multiple={!!slot.multiple}
                  onChange={(e) => {
                    onAdd(slot.key, e.currentTarget.files);
                    e.currentTarget.value = "";
                  }}
                />
              </div>

              {list.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    className="text-red-600"
                    onClick={() => removeAt(slot.key, i)}
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------ Business Steps (EXPORTED) ------------------ */
export function BusinessSteps({
  stepKey,
  core,
  setC,
  files,
  setFiles,
}: {
  stepKey: string;
  core: Record<string, any>;
  setC: (path: string, v: any) => void;
  files: Upload[];
  setFiles: (u: Upload[] | ((s: Upload[]) => Upload[])) => void;
}) {
  if (stepKey === "entity-type") {
    return (
      <div className="grid gap-4">
        <Label required>Type of Entity</Label>
        <Select
          value={core.entityType || ""}
          onChange={(e) => setC("entityType", e.target.value)}
        >
          <option value="">Select</option>
          <option value="SOLE_PROP">Sole Proprietorship</option>
          <option value="PARTNERSHIP">Partnership</option>
          <option value="OPC">One Person Company (OPC)</option>
          <option value="LLP">Limited Liability Partnership</option>
          <option value="PRIVATE_LTD">Private Limited Company</option>
          <option value="PUBLIC_LTD">Public Limited Company</option>
          <option value="URP">URP – Unregistered Person</option>
        </Select>
      </div>
    );
  }

  if (stepKey === "docs") {
    return (
      <StructuredDocsStep
        files={files}
        setFiles={setFiles}
        slots={[]}
      />
    );
  }

  return (
    <div className="text-sm text-zinc-600">
      Business step loaded: <b>{stepKey}</b>
    </div>
  );
}
