"use client";

import { useEffect, useState } from "react";
import styles from "./StatusBar.module.css";

function format(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function StatusBar() {
  const [time, setTime] = useState<string>("--:--:--");

  useEffect(() => {
    const tick = () => setTime(format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.bar}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.left}>
          <span className={styles.time}>
            SYS_TIME <span className={styles.timeVal}>{time}</span>
          </span>
          <span className={styles.utc}>UTC+3</span>
        </div>
        <div className={styles.right}>
          <span className={styles.dot} />
          <span className={styles.granted}>
            &gt; ACCESS GRANTED · TBS_DIGITAL
          </span>
        </div>
      </div>
    </div>
  );
}
