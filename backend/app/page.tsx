export default function BackendHome() {
  return (
    <main
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          padding: 32,
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          background: "white",
          textAlign: "center",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 14 }}>
          Excel Converter API
        </p>
        <h1 style={{ margin: 0, color: "#15803d", fontSize: 28 }}>
          ● Backend กำลังทำงาน
        </h1>
      </section>
    </main>
  );
}
