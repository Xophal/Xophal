/** Correct / incorrect / unanswered split as a proportional bar. */
export function OutcomeBar({
  correct,
  incorrect,
  skipped,
}: {
  correct: number;
  incorrect: number;
  skipped: number;
}) {
  const total = correct + incorrect + skipped;
  if (!total) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No answered questions recorded yet.
      </p>
    );
  }

  const segments = [
    { key: "correct", label: "Correct", value: correct, className: "bg-[hsl(var(--exam-state-correct))]" },
    { key: "incorrect", label: "Incorrect", value: incorrect, className: "bg-[hsl(var(--exam-state-incorrect))]" },
    { key: "skipped", label: "Unanswered", value: skipped, className: "bg-[hsl(var(--exam-state-skipped))]" },
  ];

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.key}
              className={segment.className}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
      </div>
      <ul className="mt-4 space-y-2">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className={"h-2.5 w-2.5 rounded-full " + segment.className} aria-hidden="true" />
              {segment.label}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {segment.value}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({Math.round((segment.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}