/**
 * Traduction des erreurs renvoyées par l'API FastAPI.
 *
 * Le backend (qui n'est pas localisé par requête) renvoie ses erreurs dans
 * `detail` (HTTPException) — historiquement en français. On les fait
 * correspondre à des clés de traduction, avec repli sur le message brut
 * lorsqu'il est inconnu (message tiers, erreur provider LLM…).
 */

type TranslateFn = (
  key: string,
  values?: Record<string, string | number>
) => string;

/** Messages connus du backend → clé dans le namespace `errors`. */
const KNOWN_ERRORS: Array<{
  pattern: RegExp;
  key: string;
  withParam?: boolean;
}> = [
  { pattern: /^URL YouTube invalide\.$/, key: "invalidUrl" },
  { pattern: /^Limite de \d+ vidéos atteinte/, key: "videoLimit" },
  {
    pattern: /^Aucun sous-titre trouvé pour cette vidéo \((.*)\)\.$/,
    key: "noSubtitles",
    withParam: true,
  },
  {
    pattern: /^La transcription est requise pour générer des notes\.$/,
    key: "transcriptRequired",
  },
  { pattern: /^Vidéo introuvable\.$/, key: "videoNotFound" },
  { pattern: /^Non autorisé\. Veuillez vous connecter\.$/, key: "unauthorized" },
];

function extractRawMessage(payload: unknown): string | null {
  if (typeof payload === "string") return payload.trim() || null;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const field of ["error", "detail", "message"]) {
      const value = record[field];
      if (typeof value === "string" && value.trim()) return value;
      // FastAPI peut renvoyer detail sous forme de liste (erreurs de validation)
      if (Array.isArray(value) && value.length > 0) {
        const first = value[0] as Record<string, unknown> | undefined;
        if (first && typeof first.msg === "string") return first.msg;
      }
    }
  }
  return null;
}

/**
 * @param payload Corps de la réponse parsée (ou message brut).
 * @param t       Traducteur du namespace `errors`.
 */
export function getApiErrorMessage(payload: unknown, t: TranslateFn): string {
  const raw = extractRawMessage(payload);
  if (!raw) return t("generic");

  for (const { pattern, key, withParam } of KNOWN_ERRORS) {
    const match = raw.match(pattern);
    if (match) {
      return withParam ? t(key, { error: match[1] ?? "" }) : t(key);
    }
  }

  // Message inconnu : on l'affiche tel quel plutôt que de masquer l'information.
  return raw;
}

/** Récupère le message d'erreur d'une réponse fetch non-OK (JSON ou texte). */
export async function readApiError(
  response: Response,
  t: TranslateFn
): Promise<string> {
  let payload: unknown = null;
  try {
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
  } catch {
    payload = null;
  }
  return getApiErrorMessage(payload, t);
}
