// Coalesce redraws into one per animation frame: a burst of wheel events or
// store updates costs a single paint.
export function frameScheduler() {
  const pending = new Set<() => void>();
  let raf = 0;
  const flush = () => {
    raf = 0;
    const jobs = [...pending];
    pending.clear();
    jobs.forEach((job) => job());
  };
  return {
    schedule(job: () => void) {
      pending.add(job);
      if (!raf) raf = requestAnimationFrame(flush);
    },
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      pending.clear();
    },
  };
}
