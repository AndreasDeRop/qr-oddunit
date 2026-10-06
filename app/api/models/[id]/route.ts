import { error, isValidSlug } from "@/lib/server/http";
import { getGeneratedModel } from "@/lib/server/model-store";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const id = (await context.params).id;

  if (!isValidSlug(id)) {
    return error("Invalid model ID.");
  }

  try {
    const gltf = await getGeneratedModel(id);

    if (!gltf) {
      return error("Model not found.", 404);
    }

    return new Response(gltf, {
      headers: {
        "content-type": "model/gltf+json; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Unable to load model.", 500);
  }
}
