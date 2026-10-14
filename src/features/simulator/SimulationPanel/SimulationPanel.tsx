import { useState } from 'react';
import { DEFAULT_SIMULATION_CONFIG, type SimulationConfig } from '../../../services/fakeApi';
import { useAppDispatch, useAppSelector } from '../../../store';
import { selectSyncSummary } from '../../../store/syncSlice';
import { simulatorToggled, updateSimulation } from '../../../store/uiSlice';
import { regenerateDeals } from '../../../store/viewSlice';
import { formatNumber } from '../../../utils/dealUtils';
import './SimulationPanel.css';

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
 * SimulationPanel
 *
 * Side panel for testers (opened from the header) that changes how the fake
 * backend behaves while you use the app. Changes apply to the next request.
 * - Presets: As in the brief, Perfect network, Bad network, Offline, Busy team.
 * - Save speed and failure rate.
 * - How busy teammates are, and how often one edits the deal you're saving.
 * - Regenerate the data with 1,000 to 100,000 deals (only when nothing is unsaved).
 */
export function SimulationPanel() {
  const dispatch = useAppDispatch();
  const { simulatorOpen, simulation: config, dealCount } = useAppSelector((state) => state.ui);
  const { saving, failed, conflicts } = useAppSelector(selectSyncSummary);
  const [nextDealCount, setNextDealCount] = useState(dealCount);

  if (!simulatorOpen) return null;

  const update = (changes: Partial<SimulationConfig>) => dispatch(updateSimulation(changes));
  const hasUnsaved = saving + failed + conflicts > 0;

  return (
    <aside className="sim-panel" aria-label="Simulator">
      <header className="sim-header">
        <h2>Simulator</h2>
        <button type="button" onClick={() => dispatch(simulatorToggled())}>
          Close
        </button>
      </header>
      <p className="hint">Controls the fake backend. Changes apply to the next request.</p>

      <section>
        <h3>Presets</h3>
        <div className="sim-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => update(preset.config)}>
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Network</h3>
        <Slider
          label="Fastest save"
          value={config.minLatencyMs}
          max={5000}
          step={50}
          format={formatMs}
          onChange={(ms) => update({ minLatencyMs: ms, maxLatencyMs: Math.max(ms, config.maxLatencyMs) })}
        />
        <Slider
          label="Slowest save"
          value={config.maxLatencyMs}
          max={5000}
          step={50}
          format={formatMs}
          onChange={(ms) => update({ maxLatencyMs: ms, minLatencyMs: Math.min(ms, config.minLatencyMs) })}
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

      <section>
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

      <section>
        <h3>Data</h3>
        <div className="sim-dataset">
          <select aria-label="Number of deals" value={nextDealCount} onChange={(e) => setNextDealCount(Number(e.target.value))}>
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
        <p className="hint">
          {hasUnsaved ? 'Available once all changes are saved or discarded.' : `Currently ${formatNumber(dealCount)} deals.`}
        </p>
      </section>
    </aside>
  );
}

/** A labelled range input showing its current value. */
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
    <label className="sim-slider">
      <span className="sim-slider-label">
        {label} <strong>{format(value)}</strong>
      </span>
      <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
