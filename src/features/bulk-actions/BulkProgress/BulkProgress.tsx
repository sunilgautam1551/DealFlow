import { shallowEqual } from 'react-redux';
import { useAppSelector } from '../../../store';
import { selectJobProgress, selectJobs, type BulkJob } from '../../../store/syncSlice';
import { formatNumber } from '../../../utils/dealUtils';
import './BulkProgress.css';

/**
 * BulkProgress
 *
 * One progress bar per big move that is still saving, e.g. "Moving 3,000
 * deals to Lost… 1,500 of 3,000 saved · 12 need attention". A bar disappears
 * when all its deals are saved or waiting for the user; a toast sums it up.
 * Moves of fewer than 10 deals don't get a bar.
 */
export function BulkProgress() {
  const jobs = useAppSelector(selectJobs);
  if (jobs.length === 0) return null;

  return (
    <div className="bulk-progress">
      {jobs.map((job) => (
        <JobProgress key={job.id} job={job} />
      ))}
    </div>
  );
}

/** One bar. */
function JobProgress({ job }: { job: BulkJob }) {
  // shallowEqual: the selector returns a new object each time, so compare its fields.
  const progress = useAppSelector((state) => selectJobProgress(state, job), shallowEqual);

  return (
    <div className="bulk-job">
      <span>{job.label}…</span>
      <progress max={progress.total} value={progress.done + progress.needAttention} aria-label={job.label} />
      <span className="muted">
        {formatNumber(progress.done)} of {formatNumber(progress.total)} saved
        {progress.needAttention > 0 && ` · ${formatNumber(progress.needAttention)} need attention`}
      </span>
    </div>
  );
}
