import { error, isValidSlug, json, readJson, requireAdmin, slugify } from "@/lib/server/http";
import { saveGeneratedModel } from "@/lib/server/model-store";

export const dynamic = "force-dynamic";

type CreateModelPayload = {
  name?: string;
  gltf?: string;
};

function modelIdFromName(name: string) {
  const base = slugify(name || "model").slice(0, 40) || "model";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await readJson<CreateModelPayload>(request);
    const gltf = typeof body.gltf === "string" ? body.gltf : "";
    const sourceName = (body.name || "generated-model.gltf").trim();
    const id = modelIdFromName(sourceName);

    if (!isValidSlug(id)) {
      return error("Generated model ID is invalid.");
    }

    const saved = await saveGeneratedModel(id, gltf, sourceName);

    return json(
      {
        id: saved.id,
        bytes: saved.bytes,
        modelUrl: `/api/models/${saved.id}`
      },
      201
    );
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to save model.", 500);
  }
}
