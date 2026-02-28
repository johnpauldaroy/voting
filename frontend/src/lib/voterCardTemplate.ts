export interface VoterCardTemplateLayout {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  headerColor: string;
  headerHeight: number;
  headerText: string;
  headerTextColor: string;
  headerTextX: number;
  headerTextY: number;
  logoDataUrl: string;
  logoX: number;
  logoY: number;
  logoWidth: number;
  logoHeight: number;
  cardTemplateImageDataUrl: string;
  cardX: number;
  cardY: number;
  cardWidth: number;
  cardHeight: number;
  cardRadius: number;
  cardFillColor: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  qrX: number;
  qrY: number;
  qrSize: number;
  qrBorderColor: string;
  qrBorderWidth: number;
  textX: number;
  nameY: number;
  nameFontSize: number;
  branchY: number;
  branchFontSize: number;
  footerY: number;
  nameColor: string;
  branchColor: string;
  footerColor: string;
  footerText: string;
}

const STORAGE_KEY = "coopvote.voter_qr_card_template.v1";

export const DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT: VoterCardTemplateLayout = {
  canvasWidth: 1200,
  canvasHeight: 760,
  backgroundColor: "#f3f4f6",
  headerColor: "#047857",
  headerHeight: 108,
  headerText: "ID Cards With QR Codes",
  headerTextColor: "#ffffff",
  headerTextX: 88,
  headerTextY: 72,
  logoDataUrl: "",
  logoX: 980,
  logoY: 18,
  logoWidth: 180,
  logoHeight: 72,
  cardTemplateImageDataUrl: "",
  cardX: 160,
  cardY: 170,
  cardWidth: 880,
  cardHeight: 470,
  cardRadius: 56,
  cardFillColor: "#ffffff",
  cardBorderColor: "#15803d",
  cardBorderWidth: 4,
  qrX: 230,
  qrY: 280,
  qrSize: 280,
  qrBorderColor: "#111827",
  qrBorderWidth: 2,
  textX: 580,
  nameY: 380,
  nameFontSize: 52,
  branchY: 465,
  branchFontSize: 42,
  footerY: 540,
  nameColor: "#111827",
  branchColor: "#334155",
  footerColor: "#6b7280",
  footerText: "Coop Vote",
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function toStringValue(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}

function toOptionalStringValue(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  return value.trim();
}

export function sanitizeVoterCardTemplateLayout(partial: Partial<VoterCardTemplateLayout>): VoterCardTemplateLayout {
  const fallback = DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT;

  return {
    canvasWidth: clampNumber(partial.canvasWidth, fallback.canvasWidth, 800, 2000),
    canvasHeight: clampNumber(partial.canvasHeight, fallback.canvasHeight, 500, 1500),
    backgroundColor: toStringValue(partial.backgroundColor, fallback.backgroundColor),
    headerColor: toStringValue(partial.headerColor, fallback.headerColor),
    headerHeight: clampNumber(partial.headerHeight, fallback.headerHeight, 70, 220),
    headerText: toStringValue(partial.headerText, fallback.headerText),
    headerTextColor: toStringValue(partial.headerTextColor, fallback.headerTextColor),
    headerTextX: clampNumber(partial.headerTextX, fallback.headerTextX, 20, 1500),
    headerTextY: clampNumber(partial.headerTextY, fallback.headerTextY, 30, 500),
    logoDataUrl: toOptionalStringValue(partial.logoDataUrl, fallback.logoDataUrl),
    logoX: clampNumber(partial.logoX, fallback.logoX, 20, 1800),
    logoY: clampNumber(partial.logoY, fallback.logoY, 10, 1300),
    logoWidth: clampNumber(partial.logoWidth, fallback.logoWidth, 60, 900),
    logoHeight: clampNumber(partial.logoHeight, fallback.logoHeight, 30, 600),
    cardTemplateImageDataUrl: toOptionalStringValue(partial.cardTemplateImageDataUrl, fallback.cardTemplateImageDataUrl),
    cardX: clampNumber(partial.cardX, fallback.cardX, 20, 1700),
    cardY: clampNumber(partial.cardY, fallback.cardY, 20, 1300),
    cardWidth: clampNumber(partial.cardWidth, fallback.cardWidth, 300, 1700),
    cardHeight: clampNumber(partial.cardHeight, fallback.cardHeight, 220, 1200),
    cardRadius: clampNumber(partial.cardRadius, fallback.cardRadius, 0, 200),
    cardFillColor: toStringValue(partial.cardFillColor, fallback.cardFillColor),
    cardBorderColor: toStringValue(partial.cardBorderColor, fallback.cardBorderColor),
    cardBorderWidth: clampNumber(partial.cardBorderWidth, fallback.cardBorderWidth, 0, 20),
    qrX: clampNumber(partial.qrX, fallback.qrX, 20, 1800),
    qrY: clampNumber(partial.qrY, fallback.qrY, 20, 1300),
    qrSize: clampNumber(partial.qrSize, fallback.qrSize, 120, 900),
    qrBorderColor: toStringValue(partial.qrBorderColor, fallback.qrBorderColor),
    qrBorderWidth: clampNumber(partial.qrBorderWidth, fallback.qrBorderWidth, 0, 12),
    textX: clampNumber(partial.textX, fallback.textX, 20, 1800),
    nameY: clampNumber(partial.nameY, fallback.nameY, 20, 1300),
    nameFontSize: clampNumber(partial.nameFontSize, fallback.nameFontSize, 16, 140),
    branchY: clampNumber(partial.branchY, fallback.branchY, 20, 1300),
    branchFontSize: clampNumber(partial.branchFontSize, fallback.branchFontSize, 14, 120),
    footerY: clampNumber(partial.footerY, fallback.footerY, 20, 1300),
    nameColor: toStringValue(partial.nameColor, fallback.nameColor),
    branchColor: toStringValue(partial.branchColor, fallback.branchColor),
    footerColor: toStringValue(partial.footerColor, fallback.footerColor),
    footerText: toStringValue(partial.footerText, fallback.footerText),
  };
}

export function getStoredVoterCardTemplateLayout() {
  if (typeof window === "undefined") {
    return DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT;
    }

    const parsed = JSON.parse(raw) as Partial<VoterCardTemplateLayout>;
    return sanitizeVoterCardTemplateLayout(parsed);
  } catch {
    return DEFAULT_VOTER_CARD_TEMPLATE_LAYOUT;
  }
}

export function saveVoterCardTemplateLayout(layout: Partial<VoterCardTemplateLayout>) {
  if (typeof window === "undefined") {
    return;
  }

  const sanitized = sanitizeVoterCardTemplateLayout(layout);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
}

export function resetVoterCardTemplateLayout() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

function loadImage(src: string, errorMessage: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = src;
  });
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawQrPlaceholder(context: CanvasRenderingContext2D, layout: VoterCardTemplateLayout) {
  context.fillStyle = "#ffffff";
  context.fillRect(layout.qrX, layout.qrY, layout.qrSize, layout.qrSize);

  if (layout.qrBorderWidth > 0) {
    context.lineWidth = layout.qrBorderWidth;
    context.strokeStyle = layout.qrBorderColor;
    context.strokeRect(layout.qrX, layout.qrY, layout.qrSize, layout.qrSize);
  }

  const corner = Math.max(24, Math.floor(layout.qrSize * 0.18));
  const offset = Math.max(10, Math.floor(layout.qrSize * 0.07));
  context.lineWidth = Math.max(6, Math.floor(layout.qrSize * 0.035));
  context.strokeStyle = "#111827";
  context.strokeRect(layout.qrX + offset, layout.qrY + offset, corner, corner);
  context.strokeRect(layout.qrX + layout.qrSize - offset - corner, layout.qrY + offset, corner, corner);
  context.strokeRect(layout.qrX + offset, layout.qrY + layout.qrSize - offset - corner, corner, corner);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to generate QR card image."));
        return;
      }

      resolve(blob);
    }, "image/png");
  });
}

function trimTextToWidth(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (context.measureText(value).width <= maxWidth) {
    return value;
  }

  let trimmed = value;
  while (trimmed.length > 1 && context.measureText(trimmed).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed;
}

function wrapTextToLines(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines: number
) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return ["-"];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;

    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }

      if (current) {
        if (lines.length === maxLines - 1) {
          lines.push(trimTextToWidth(context, current, maxWidth));
          return lines;
        }

      lines.push(current);
      current = "";
    }

    if (context.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }

    let rest = word;
      while (rest.length > 0) {
        let chunk = rest;
        while (chunk.length > 1 && context.measureText(chunk).width > maxWidth) {
          chunk = chunk.slice(0, -1);
        }

        if (lines.length === maxLines - 1) {
          lines.push(trimTextToWidth(context, rest, maxWidth));
          return lines;
        }

      lines.push(chunk);
      rest = rest.slice(chunk.length);
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

interface RenderVoterQrCardOptions {
  qrDataUrl?: string;
  voterName?: string;
  branch?: string;
  layout?: Partial<VoterCardTemplateLayout>;
  showData?: boolean;
}

export async function buildVoterQrCardCanvas(options: RenderVoterQrCardOptions) {
  const resolvedLayout = sanitizeVoterCardTemplateLayout({
    ...getStoredVoterCardTemplateLayout(),
    ...(options.layout ?? {}),
  });
  const showData = options.showData ?? true;

  const canvas = document.createElement("canvas");
  canvas.width = resolvedLayout.canvasWidth;
  canvas.height = resolvedLayout.canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare QR card canvas.");
  }

  if (resolvedLayout.cardTemplateImageDataUrl) {
    try {
      const cardTemplateImage = await loadImage(resolvedLayout.cardTemplateImageDataUrl, "Unable to render card template image.");
      context.save();
      roundedRectPath(
        context,
        resolvedLayout.cardX,
        resolvedLayout.cardY,
        resolvedLayout.cardWidth,
        resolvedLayout.cardHeight,
        resolvedLayout.cardRadius
      );
      context.clip();
      context.drawImage(
        cardTemplateImage,
        resolvedLayout.cardX,
        resolvedLayout.cardY,
        resolvedLayout.cardWidth,
        resolvedLayout.cardHeight
      );
      context.restore();

      if (resolvedLayout.cardBorderWidth > 0) {
        context.save();
        roundedRectPath(
          context,
          resolvedLayout.cardX,
          resolvedLayout.cardY,
          resolvedLayout.cardWidth,
          resolvedLayout.cardHeight,
          resolvedLayout.cardRadius
        );
        context.lineWidth = resolvedLayout.cardBorderWidth;
        context.strokeStyle = resolvedLayout.cardBorderColor;
        context.stroke();
        context.restore();
      }
    } catch {
      context.save();
      roundedRectPath(
        context,
        resolvedLayout.cardX,
        resolvedLayout.cardY,
        resolvedLayout.cardWidth,
        resolvedLayout.cardHeight,
        resolvedLayout.cardRadius
      );
      context.fillStyle = resolvedLayout.cardFillColor;
      context.fill();
      if (resolvedLayout.cardBorderWidth > 0) {
        context.lineWidth = resolvedLayout.cardBorderWidth;
        context.strokeStyle = resolvedLayout.cardBorderColor;
        context.stroke();
      }
      context.restore();
    }
  } else {
    context.save();
    roundedRectPath(
      context,
      resolvedLayout.cardX,
      resolvedLayout.cardY,
      resolvedLayout.cardWidth,
      resolvedLayout.cardHeight,
      resolvedLayout.cardRadius
    );
    context.fillStyle = resolvedLayout.cardFillColor;
    context.fill();
    if (resolvedLayout.cardBorderWidth > 0) {
      context.lineWidth = resolvedLayout.cardBorderWidth;
      context.strokeStyle = resolvedLayout.cardBorderColor;
      context.stroke();
    }
    context.restore();
  }

  if (resolvedLayout.logoDataUrl) {
    try {
      const logoImage = await loadImage(resolvedLayout.logoDataUrl, "Unable to render logo image.");
      context.drawImage(
        logoImage,
        resolvedLayout.logoX,
        resolvedLayout.logoY,
        resolvedLayout.logoWidth,
        resolvedLayout.logoHeight
      );
    } catch {
      // Ignore logo rendering failures to keep card generation resilient.
    }
  }

  if (options.qrDataUrl) {
    const qrImage = await loadImage(options.qrDataUrl, "Unable to render QR image.");
    context.imageSmoothingEnabled = false;
    context.drawImage(qrImage, resolvedLayout.qrX, resolvedLayout.qrY, resolvedLayout.qrSize, resolvedLayout.qrSize);
    if (resolvedLayout.qrBorderWidth > 0) {
      context.lineWidth = resolvedLayout.qrBorderWidth;
      context.strokeStyle = resolvedLayout.qrBorderColor;
      context.strokeRect(resolvedLayout.qrX, resolvedLayout.qrY, resolvedLayout.qrSize, resolvedLayout.qrSize);
    }
  } else {
    drawQrPlaceholder(context, resolvedLayout);
  }

  if (showData) {
    const textAreaRight = Math.min(resolvedLayout.canvasWidth - 20, resolvedLayout.cardX + resolvedLayout.cardWidth - 24);
    const textAreaWidth = Math.max(80, textAreaRight - resolvedLayout.textX);
    const cardBottomBaseline = resolvedLayout.cardY + resolvedLayout.cardHeight - 20;

    context.fillStyle = resolvedLayout.nameColor;
    context.font = `700 ${resolvedLayout.nameFontSize}px Segoe UI, Arial, sans-serif`;
    const nameLineHeight = Math.max(18, Math.round(resolvedLayout.nameFontSize * 1.08));
    const reservedBranchHeight = Math.max(18, Math.round(resolvedLayout.branchFontSize * 1.1));
    const maxNameBottomBaseline = cardBottomBaseline - reservedBranchHeight - 8;
    const maxNameLines = Math.max(1, Math.floor((maxNameBottomBaseline - resolvedLayout.nameY) / nameLineHeight) + 1);
    const nameLines = wrapTextToLines(context, options.voterName?.trim() || "-", textAreaWidth, maxNameLines);
    nameLines.forEach((line, index) => {
      context.fillText(line, resolvedLayout.textX, resolvedLayout.nameY + index * nameLineHeight);
    });
    const lastNameBaseline = resolvedLayout.nameY + (nameLines.length - 1) * nameLineHeight;

    context.fillStyle = resolvedLayout.branchColor;
    context.font = `500 ${resolvedLayout.branchFontSize}px Segoe UI, Arial, sans-serif`;
    const branchValue = trimTextToWidth(context, options.branch?.trim() || "-", textAreaWidth);
    const minBranchBaseline = lastNameBaseline + Math.max(16, Math.round(resolvedLayout.branchFontSize * 0.9));
    const maxBranchBaseline = cardBottomBaseline;
    const branchBaseline = Math.min(maxBranchBaseline, Math.max(resolvedLayout.branchY, minBranchBaseline));
    context.fillText(branchValue, resolvedLayout.textX, branchBaseline);
  } else {
    context.fillStyle = "#e5e7eb";
    const textAreaRight = Math.min(resolvedLayout.canvasWidth - 20, resolvedLayout.cardX + resolvedLayout.cardWidth - 24);
    const textAreaWidth = Math.max(80, textAreaRight - resolvedLayout.textX);
    const nameBlockHeight = Math.max(20, Math.round(resolvedLayout.nameFontSize * 0.84));
    const branchBlockHeight = Math.max(18, Math.round(resolvedLayout.branchFontSize * 0.84));
    context.fillRect(
      resolvedLayout.textX,
      resolvedLayout.nameY - nameBlockHeight,
      Math.min(textAreaWidth, Math.max(180, Math.round(resolvedLayout.nameFontSize * 6.35))),
      nameBlockHeight + 2
    );
    context.fillRect(
      resolvedLayout.textX,
      resolvedLayout.nameY + 8,
      Math.min(textAreaWidth, Math.max(140, Math.round(resolvedLayout.nameFontSize * 3.8))),
      nameBlockHeight + 2
    );
    context.fillRect(
      resolvedLayout.textX,
      resolvedLayout.branchY - branchBlockHeight,
      Math.min(textAreaWidth, Math.max(140, Math.round(resolvedLayout.branchFontSize * 6.2))),
      branchBlockHeight + 2
    );
  }

  return canvas;
}

interface BuildVoterQrCardOptions {
  qrDataUrl: string;
  voterName: string;
  branch: string;
  layout?: Partial<VoterCardTemplateLayout>;
}

export async function buildVoterQrCardPng(options: BuildVoterQrCardOptions) {
  const canvas = await buildVoterQrCardCanvas({
    qrDataUrl: options.qrDataUrl,
    voterName: options.voterName,
    branch: options.branch,
    layout: options.layout,
    showData: true,
  });
  return canvas.toDataURL("image/png");
}

export async function buildVoterQrCardBlob(options: BuildVoterQrCardOptions) {
  const canvas = await buildVoterQrCardCanvas({
    qrDataUrl: options.qrDataUrl,
    voterName: options.voterName,
    branch: options.branch,
    layout: options.layout,
    showData: true,
  });
  return canvasToPngBlob(canvas);
}
