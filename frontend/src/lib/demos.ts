// Demo programs. The files live in frontend/public/demo/ so they load with no network.
export interface Demo {
  id: string;
  label: string;
  folder: string;
  target: string;
}

export const DEMOS: Demo[] = [
  { id: "seal-in", label: "Seal-in · flipped Stop", folder: "seal_in", target: "target_bug_flipped_stop.txt" },
  { id: "ai-unscaled", label: "AI conversion · hand-edited preset", folder: "ai_conversion", target: "target_ai_unscaled_example.txt" },
  { id: "ai-as-produced", label: "AI conversion · as produced", folder: "ai_conversion", target: "target_ai.txt" },
  { id: "needs-review", label: "Needs review · unsupported instruction", folder: "needs_review", target: "target.txt" },
];

async function fetchText(path: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo/${path}`);
  if (!response.ok) throw new Error(`Couldn’t load demo file ${path} (${response.status}).`);
  return response.text();
}

export async function loadDemo(demo: Demo) {
  const [legacy, target, map] = await Promise.all([
    fetchText(`${demo.folder}/legacy.txt`),
    fetchText(`${demo.folder}/${demo.target}`),
    fetchText(`${demo.folder}/tag_map.json`),
  ]);
  return {
    legacy: { name: "legacy.txt", text: legacy },
    target: { name: demo.target, text: target },
    mapName: "tag_map.json",
    mapText: map,
  };
}
