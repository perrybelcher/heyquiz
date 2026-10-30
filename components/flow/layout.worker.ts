/// <reference lib="webworker" />
import ELK from "elkjs/lib/elk.bundled.js";
const elk = new ELK();
self.onmessage = async (event: MessageEvent) => {
  const { requestId, nodes, edges } = event.data;
  try {
    const graph = await elk.layout({
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": "70",
        "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      },
      children: nodes.map(
        (n: { id: string; width: number; height: number }) => ({ ...n }),
      ),
      edges: edges.map((e: { id: string; source: string; target: string }) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    });
    self.postMessage({
      requestId,
      positions: Object.fromEntries(
        graph.children!.map((n) => [n.id, { x: n.x || 0, y: n.y || 0 }]),
      ),
    });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error instanceof Error ? error.message : "Could not arrange flow",
    });
  }
};
export {};
