import styles from './App.module.css';

/** Top-level layout. Feature components are added here phase by phase. */
export function App() {
  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>DealFlow</h1>
      </header>
      <main className={styles.main}>Pipeline coming soon…</main>
    </div>
  );
}
