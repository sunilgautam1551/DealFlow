import { shallowEqual } from 'react-redux';
import { useAppSelector } from '../../app/hooks';
import { formatNumber } from '../../domain/format';
import { selectJobProgress } from '../../features/sync/syncSelectors';
import type { BulkJob } from '../../features/sync/syncSlice';
import styles from './BulkProgress.module.css';

/** Progress bars for large moves still being saved ("Moving 3,000 deals to Lost"). */
export function BulkProgress() {
  const jobs = useAppSelector((state) => state.sync.jobs);
  if (jobs.length === 0) return null;

  return (
    <div className={styles.list}>
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </div>
  );
}

function JobRow({ job }: { job: BulkJob }) {
  // shallowEqual: the selector builds a new object each time, so compare its fields.
  const progress = useAppSelector((state) => selectJobProgress(state, job), shallowEqual);
  const resolved = progress.done + progress.needAttention;

  return (
    <div className={styles.job}>
      <span>{job.label}…</span>
      <progress max={progress.total} value={resolved} aria-label={job.label} />
      <span className={styles.numbers}>
        {formatNumber(progress.done)} of {formatNumber(progress.total)} saved
        {progress.needAttention > 0 && ` · ${formatNumber(progress.needAttention)} need attention`}
      </span>
    </div>
  );
}
