const leaves = [
  { className: "autumn-leaf--one", color: "#c65d24" },
  { className: "autumn-leaf--two", color: "#e0a12d" },
  { className: "autumn-leaf--three", color: "#9e3d2d" },
  { className: "autumn-leaf--four", color: "#d47b27" },
  { className: "autumn-leaf--five", color: "#b84a2a" },
] as const;

export function AutumnDecor() {
  return (
    <div aria-hidden="true" className="autumn-leaf-layer">
      {leaves.map((leaf) => (
        <span className={`autumn-leaf ${leaf.className}`} key={leaf.className}>
          <svg fill="none" viewBox="0 0 36 36">
            <path
              d="M30.6 4.7C18.8 5.8 7.1 11.1 5.1 23.2c-.8 5 2.4 8.2 7.3 7.5 12-1.7 17.4-13.9 18.2-26Z"
              fill={leaf.color}
            />
            <path d="M8.3 28.6c5.8-5.8 10.9-10.2 18.5-18" stroke="#71341f" strokeLinecap="round" strokeWidth="1.4" />
          </svg>
        </span>
      ))}
    </div>
  );
}
