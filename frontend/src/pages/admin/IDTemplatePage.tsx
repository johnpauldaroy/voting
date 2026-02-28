import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT,
  buildVoterQrCardCanvas,
  getStoredVoterCardTemplateLayout,
  resetVoterCardTemplateLayout,
  sanitizeVoterCardTemplateLayout,
  saveVoterCardTemplateLayout,
  type VoterCardTemplateLayout,
} from "@/lib/voterCardTemplate";

type PositionFieldKey =
  | "headerTextX"
  | "headerTextY"
  | "cardX"
  | "cardY"
  | "qrX"
  | "qrY"
  | "textX"
  | "nameY"
  | "branchY"
  | "footerY";

type SizeFieldKey = "cardWidth" | "cardHeight" | "cardRadius" | "qrSize";
type NumberFieldKey = PositionFieldKey | SizeFieldKey;
type TextFieldKey = "headerText" | "footerText";
type DragHandleId = "header" | "card" | "qr" | "name" | "branch" | "footer";

const NUMBER_LIMITS: Record<NumberFieldKey, { min: number; max: number }> = {
  headerTextX: { min: 20, max: 1500 },
  headerTextY: { min: 30, max: 500 },
  cardX: { min: 20, max: 1700 },
  cardY: { min: 20, max: 1300 },
  qrX: { min: 20, max: 1800 },
  qrY: { min: 20, max: 1300 },
  textX: { min: 20, max: 1800 },
  nameY: { min: 20, max: 1300 },
  branchY: { min: 20, max: 1300 },
  footerY: { min: 20, max: 1300 },
  cardWidth: { min: 300, max: 1700 },
  cardHeight: { min: 220, max: 1200 },
  cardRadius: { min: 0, max: 200 },
  qrSize: { min: 120, max: 900 },
};

const SIZE_FIELDS: Array<{ key: SizeFieldKey; label: string; step: number }> = [
  { key: "cardWidth", label: "Card Width", step: 1 },
  { key: "cardHeight", label: "Card Height", step: 1 },
  { key: "cardRadius", label: "Card Radius", step: 1 },
  { key: "qrSize", label: "QR Size", step: 1 },
];

const TEXT_FIELDS: Array<{ key: TextFieldKey; label: string }> = [
  { key: "headerText", label: "Header Text" },
  { key: "footerText", label: "Footer Text" },
];

interface DragHandle {
  id: DragHandleId;
  label: string;
  xKey: PositionFieldKey;
  yKey: PositionFieldKey;
  widthKey?: SizeFieldKey;
  heightKey?: SizeFieldKey;
}

const DRAG_HANDLES: DragHandle[] = [
  { id: "header", label: "Header", xKey: "headerTextX", yKey: "headerTextY" },
  { id: "card", label: "Card", xKey: "cardX", yKey: "cardY", widthKey: "cardWidth", heightKey: "cardHeight" },
  { id: "qr", label: "QR", xKey: "qrX", yKey: "qrY", widthKey: "qrSize", heightKey: "qrSize" },
  { id: "name", label: "Name", xKey: "textX", yKey: "nameY" },
  { id: "branch", label: "Branch", xKey: "textX", yKey: "branchY" },
  { id: "footer", label: "Footer", xKey: "textX", yKey: "footerY" },
];

const HANDLE_STYLES: Record<
  DragHandleId,
  {
    outline: string;
    badge: string;
    point: string;
    active: string;
  }
> = {
  header: {
    outline: "border-indigo-500/80 bg-indigo-500/10",
    badge: "bg-indigo-600 text-white",
    point: "border-indigo-500 bg-indigo-50 text-indigo-700",
    active: "ring-indigo-300",
  },
  card: {
    outline: "border-emerald-500/80 bg-emerald-500/10",
    badge: "bg-emerald-600 text-white",
    point: "border-emerald-500 bg-emerald-50 text-emerald-700",
    active: "ring-emerald-300",
  },
  qr: {
    outline: "border-sky-500/80 bg-sky-500/10",
    badge: "bg-sky-600 text-white",
    point: "border-sky-500 bg-sky-50 text-sky-700",
    active: "ring-sky-300",
  },
  name: {
    outline: "border-amber-500/80 bg-amber-500/10",
    badge: "bg-amber-600 text-white",
    point: "border-amber-500 bg-amber-50 text-amber-700",
    active: "ring-amber-300",
  },
  branch: {
    outline: "border-violet-500/80 bg-violet-500/10",
    badge: "bg-violet-600 text-white",
    point: "border-violet-500 bg-violet-50 text-violet-700",
    active: "ring-violet-300",
  },
  footer: {
    outline: "border-rose-500/80 bg-rose-500/10",
    badge: "bg-rose-600 text-white",
    point: "border-rose-500 bg-rose-50 text-rose-700",
    active: "ring-rose-300",
  },
};

interface DragSession {
  pointerId: number;
  xKey: PositionFieldKey;
  yKey: PositionFieldKey;
  startX: number;
  startY: number;
  startClientX: number;
  startClientY: number;
  canvasRect: DOMRect;
  canvasWidth: number;
  canvasHeight: number;
}

function clampNumberField(key: NumberFieldKey, value: number) {
  const limits = NUMBER_LIMITS[key];
  return Math.max(limits.min, Math.min(limits.max, value));
}

function toPercent(value: number, total: number) {
  return `${(value / Math.max(1, total)) * 100}%`;
}

export function IDTemplatePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const [savedTemplate, setSavedTemplate] = useState<VoterCardTemplateLayout>(() => getStoredVoterCardTemplateLayout());
  const [draftTemplate, setDraftTemplate] = useState<VoterCardTemplateLayout>(() => getStoredVoterCardTemplateLayout());
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeHandleId, setActiveHandleId] = useState<DragHandleId | null>(null);

  const templateForPreview = editing ? draftTemplate : savedTemplate;

  useEffect(() => {
    let cancelled = false;

    const drawPreview = async () => {
      const targetCanvas = canvasRef.current;
      if (!targetCanvas) {
        return;
      }

      const previewCanvas = await buildVoterQrCardCanvas({
        layout: templateForPreview,
        showData: false,
      });

      if (cancelled || !canvasRef.current) {
        return;
      }

      canvasRef.current.width = previewCanvas.width;
      canvasRef.current.height = previewCanvas.height;
      const context = canvasRef.current.getContext("2d");
      if (!context) {
        return;
      }

      context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      context.drawImage(previewCanvas, 0, 0);
    };

    void drawPreview();

    return () => {
      cancelled = true;
    };
  }, [templateForPreview]);

  const updateNumberField = (key: NumberFieldKey, value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }

    setDraftTemplate((current) => ({
      ...current,
      [key]: clampNumberField(key, parsed),
    }));
  };

  const updateTextField = (key: TextFieldKey, value: string) => {
    setDraftTemplate((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const startEditing = () => {
    setDraftTemplate(savedTemplate);
    setEditing(true);
    setNotice(null);
  };

  const cancelEditing = () => {
    dragSessionRef.current = null;
    setActiveHandleId(null);
    setDraftTemplate(savedTemplate);
    setEditing(false);
  };

  const saveTemplate = () => {
    const sanitized = sanitizeVoterCardTemplateLayout(draftTemplate);
    saveVoterCardTemplateLayout(sanitized);
    setSavedTemplate(sanitized);
    setDraftTemplate(sanitized);
    dragSessionRef.current = null;
    setActiveHandleId(null);
    setEditing(false);
    setNotice("Template updated. New voter QR cards will use this layout.");
  };

  const restoreDefaults = () => {
    resetVoterCardTemplateLayout();
    setSavedTemplate(DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT);
    setDraftTemplate(DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT);
    dragSessionRef.current = null;
    setActiveHandleId(null);
    setEditing(false);
    setNotice("Template reset to the default layout.");
  };

  const startDrag = (handle: DragHandle, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editing) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) {
      return;
    }

    event.preventDefault();

    dragSessionRef.current = {
      pointerId: event.pointerId,
      xKey: handle.xKey,
      yKey: handle.yKey,
      startX: draftTemplate[handle.xKey],
      startY: draftTemplate[handle.yKey],
      startClientX: event.clientX,
      startClientY: event.clientY,
      canvasRect,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };

    setActiveHandleId(handle.id);
    setNotice(null);
  };

  useEffect(() => {
    if (!activeHandleId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragSession = dragSessionRef.current;
      if (!dragSession || event.pointerId !== dragSession.pointerId) {
        return;
      }

      event.preventDefault();

      const deltaX = ((event.clientX - dragSession.startClientX) / dragSession.canvasRect.width) * dragSession.canvasWidth;
      const deltaY = ((event.clientY - dragSession.startClientY) / dragSession.canvasRect.height) * dragSession.canvasHeight;
      const nextX = clampNumberField(dragSession.xKey, Math.round(dragSession.startX + deltaX));
      const nextY = clampNumberField(dragSession.yKey, Math.round(dragSession.startY + deltaY));

      setDraftTemplate((current) => {
        if (current[dragSession.xKey] === nextX && current[dragSession.yKey] === nextY) {
          return current;
        }

        return {
          ...current,
          [dragSession.xKey]: nextX,
          [dragSession.yKey]: nextY,
        };
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const dragSession = dragSessionRef.current;
      if (!dragSession || event.pointerId !== dragSession.pointerId) {
        return;
      }

      dragSessionRef.current = null;
      setActiveHandleId(null);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [activeHandleId]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="gap-3 md:flex md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <CardTitle>ID Template</CardTitle>
            <CardDescription>
              Edit and preview the voter QR card layout. Saved changes are used when generating voter QR cards.
            </CardDescription>
          </div>
          {!editing ? (
            <Button type="button" className="inline-flex items-center gap-2" onClick={startEditing}>
              <Pencil className="h-4 w-4" />
              Edit Layout
            </Button>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4">
          {notice ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </div>
          ) : null}

          {editing ? (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">Canvas Editor</h3>
              <p className="text-sm text-muted-foreground">
                Drag the overlays on the preview canvas to move each element, similar to a Canva-style editor.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {TEXT_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`template-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`template-${field.key}`}
                      value={draftTemplate[field.key]}
                      onChange={(event) => updateTextField(field.key, event.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {SIZE_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`template-${field.key}`}>{field.label}</Label>
                    <Input
                      id={`template-${field.key}`}
                      type="number"
                      min={NUMBER_LIMITS[field.key].min}
                      max={NUMBER_LIMITS[field.key].max}
                      step={field.step}
                      value={draftTemplate[field.key]}
                      onChange={(event) => updateNumberField(field.key, event.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={saveTemplate}>
                  Save Template
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button type="button" variant="ghost" onClick={restoreDefaults}>
                  Reset to Default
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="ghost" onClick={restoreDefaults}>
                Reset to Default
              </Button>
            </div>
          )}

          <div className="flex justify-center overflow-auto rounded-xl border bg-slate-50 p-4">
            <div className="relative w-full max-w-5xl">
              <canvas ref={canvasRef} className="block w-full rounded-xl border bg-white shadow-sm" />
              {editing ? (
                <div className="pointer-events-none absolute inset-0">
                  {DRAG_HANDLES.map((handle) => {
                    const style = HANDLE_STYLES[handle.id];
                    const isActive = activeHandleId === handle.id;
                    const left = toPercent(draftTemplate[handle.xKey], draftTemplate.canvasWidth);
                    const top = toPercent(draftTemplate[handle.yKey], draftTemplate.canvasHeight);
                    const ringClass = isActive ? `ring-2 ${style.active}` : "";

                    if (handle.widthKey && handle.heightKey) {
                      const width = toPercent(draftTemplate[handle.widthKey], draftTemplate.canvasWidth);
                      const height = toPercent(draftTemplate[handle.heightKey], draftTemplate.canvasHeight);

                      return (
                        <button
                          key={handle.id}
                          type="button"
                          className={`pointer-events-auto absolute cursor-grab rounded-md border-2 border-dashed transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:cursor-grabbing ${style.outline} ${ringClass}`}
                          style={{ left, top, width, height }}
                          onPointerDown={(event) => startDrag(handle, event)}
                        >
                          <span
                            className={`absolute -top-8 left-0 rounded px-2 py-1 text-[11px] font-semibold tracking-wide ${style.badge}`}
                          >
                            {handle.label}
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={handle.id}
                        type="button"
                        className={`pointer-events-auto absolute min-w-16 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 active:cursor-grabbing ${style.point} ${ringClass}`}
                        style={{ left, top }}
                        onPointerDown={(event) => startDrag(handle, event)}
                      >
                        {handle.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
