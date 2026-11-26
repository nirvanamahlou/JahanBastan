const steps = ["اطلاعات مسافران", "بازبینی و تأیید", "پیگیری درخواست"];

export function FlightCheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol aria-label="مراحل خرید پرواز" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1.5 text-xs sm:gap-2 sm:p-2 sm:text-sm">
      {steps.map((label, index) => {
        const active = index === current;
        const complete = index < current;

        return (
          <li
            aria-current={active ? "step" : undefined}
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-center sm:flex-row sm:gap-2 ${active ? "bg-brand-soft font-bold text-brand" : complete ? "text-brand" : "text-muted"}`}
            key={label}
          >
            <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${active ? "bg-brand text-white" : "border border-border bg-surface"}`}>
              {complete ? "✓" : (index + 1).toLocaleString("fa-IR")}
            </span>
            {complete && <span className="sr-only">انجام شد، </span>}
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
