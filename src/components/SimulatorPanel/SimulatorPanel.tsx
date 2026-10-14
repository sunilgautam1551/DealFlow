import { useState } from 'react';
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from '../../api/types';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { formatNumber } from '../../domain/format';
import { selectDealCount, selectSimulationConfig } from '../../features/simulator/simulatorSlice';
import { regenerateDeals, updateSimulation } from '../../features/simulator/simulatorThunks';
import { selectSyncSummary } from '../../features/sync/syncSelectors';
import { simulatorToggled } from '../../features/ui/uiSlice';
import styles from './SimulatorPanel.module.css';

/** One-click scenarios for testing. */
const PRESETS: { label: string; config: SimulationConfig }[] = [
  { label: 'As in the brief', config: DEFAULT_SIMULATION_CONFIG },
  {
    label: 'Perfect network',
    config: { minLatencyMs: 50, maxLatencyMs: 150, failureRate: 0, teammateChangesPerMinute: 60, raceChance: 0 },
  },
  {
    label: 'Bad network',
    config: { minLatencyMs: 1000, maxLatencyMs: 4000, failureRate: 0.5, teammateChangesPerMinute: 60, raceChance: 0.01 },
  },
  {
    label: 'Offline',
    config: { minLatencyMs: 300, maxLatencyMs: 1500, failureRate: 1, teammateChangesPerMinute: 0, raceChance: 0 },
  },
  {
    label: 'Busy team',
    config: { minLatencyMs: 300, maxLatencyMs: 1500, failureRate: 0.1, teammateChangesPerMinute: 1200, raceChance: 0.2 },
  },
];

const DATASET_SIZES = [1_000, 10_000, 50_000, 100_000];

/**
 * Side panel for testers: adjust the fake backend while using the app.
 * Every change applies immediately.
 */
export function SimulatorPanel() {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.ui.simulatorOpen);
  const config = useAppSelector(selectSimulationConfig);
  const dealCount = useAppSelector(selectDealCount);
  const { saving, failed, conflicts } = useAppSelector(selectSyncSummary);
  const [nextDealCount, setNextDealCount] = useState(dealCount);

  if (!isOpen) return null;

  const update = (changes: Partial<SimulationConfig>) => dispatch(updateSimulation(changes));
  const hasUnsaved = saving + failed + conflicts > 0;

  return (
    <aside className={styles.panel} aria-label="Simulator">
      <header className={styles.header}>
        <h2>Simulator</h2>
        <button type="button" onClick={() => dispatch(simulatorToggled())}>
          Close
        </button>
      </header>
      <p className={styles.intro}>Controls the fake backend. Changes apply to the next request.</p>

      <section className={styles.section}>
        <h3>Presets</h3>
        <div className={styles.presets}>
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => update(preset.config)}>
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3>Network</h3>
        <Slider
          label="Fastest save"
          value={config.minLatencyMs}
          max={5000}
          step={50}
          format={formatMs}
          onChange={(minLatencyMs) => update({ minLatencyMs, maxLatencyMs: Math.max(minLatencyMs, config.maxLatencyMs) })}
        />
        <Slider
          label="Slowest save"
          value={config.maxLatencyMs}
          max={5000}
          step={50}
          format={formatMs}
          onChange={(maxLatencyMs) => update({ maxLatencyMs, minLatencyMs: Math.min(maxLatencyMs, config.minLatencyMs) })}
        />
        <Slider
          label="Saves that fail"
          value={config.failureRate}
          max={1}
          step={0.05}
          format={formatPercent}
          onChange={(failureRate) => update({ failureRate })}
        />
      </section>

      <section className={styles.section}>
        <h3>Teammates</h3>
        <Slider
          label="Changes per minute"
          value={config.teammateChangesPerMinute}
          max={1200}
          step={30}
          format={formatNumber}
          onChange={(teammateChangesPerMinute) => update({ teammateChangesPerMinute })}
        />
        <Slider
          label="Edit the deal you're saving"
          hint="Chance a teammate moves the same deal just before your save lands (causes a conflict)."
          value={config.raceChance}
          max={1}
          step={0.05}
          format={formatPercent}
          onChange={(raceChance) => update({ raceChance })}
        />
      </section>

      <section className={styles.section}>
        <h3>Data</h3>
        <div className={styles.dataset}>
          <select
            aria-label="Number of deals"
            value={nextDealCount}
            onChange={(event) => setNextDealCount(Number(event.target.value))}
          >
            {DATASET_SIZES.map((size) => (
              <option key={size} value={size}>
                {formatNumber(size)} deals
              </option>
            ))}
          </select>
          <button type="button" disabled={hasUnsaved} onClick={() => void dispatch(regenerateDeals(nextDealCount))}>
            Regenerate
          </button>
        </div>
        <p className={styles.hint}>
          {hasUnsaved ? 'Available once all changes are saved or discarded.' : `Currently ${formatNumber(dealCount)} deals.`}
        </p>
      </section>
    </aside>
  );
}

interface SliderProps {
  label: string;
  hint?: string;
  value: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

function Slider({ label, hint, value, max, step, format, onChange }: SliderProps) {
  return (
    <label className={styles.slider}>
      <span className={styles.sliderLabel}>
        {label} <strong>{format(value)}</strong>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
