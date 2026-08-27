export function MeshBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <span
        className="mesh-blob absolute top-0 left-0 h-[45vh] w-[45vh] rounded-full bg-primary/25 blur-[100px]"
        style={{ animation: "mesh-drift-a 30s ease-in-out infinite" }}
      />
      <span
        className="mesh-blob absolute top-1/3 right-0 h-[40vh] w-[40vh] rounded-full bg-positive/20 blur-[100px]"
        style={{ animation: "mesh-drift-b 34s ease-in-out infinite" }}
      />
      <span
        className="mesh-blob absolute bottom-0 left-1/4 h-[38vh] w-[38vh] rounded-full bg-primary/15 blur-[100px]"
        style={{ animation: "mesh-drift-c 38s ease-in-out infinite" }}
      />
    </div>
  );
}
