import { useMemo } from 'react';

const getIntensityLevel = (count) => {
  if (!count) {
    return 0;
  }
  if (count >= 8) {
    return 4;
  }
  if (count >= 5) {
    return 3;
  }
  if (count >= 3) {
    return 2;
  }
  return 1;
};

const buildCalendar = (year) => {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const days = [];
  for (let date = new Date(start); date < end; date.setUTCDate(date.getUTCDate() + 1)) {
    days.push(new Date(date));
  }

  const weeks = [];
  let currentWeek = [];
  let previousDay = null;

  days.forEach((day) => {
    const weekDay = day.getUTCDay();
    if (previousDay === null) {
      for (let pad = 0; pad < weekDay; pad += 1) {
        currentWeek.push(null);
      }
    }

    currentWeek.push(day);
    if (weekDay === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    previousDay = day;
  });

  if (currentWeek.length) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
};

function Heatmap({ year, items }) {
  const dataMap = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      map.set(item.date, item);
    });
    return map;
  }, [items]);

  const weeks = useMemo(() => buildCalendar(year), [year]);

  return (
    <div className="heatmap">
      <div className="heatmap-grid">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="heatmap-week">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <span key={dayIndex} className="heatmap-cell empty" />;
              }
              const isoDate = day.toISOString().slice(0, 10);
              const stats = dataMap.get(isoDate);
              const level = getIntensityLevel(stats?.submitCount ?? 0);
              const title = stats
                ? `${isoDate}\nSubmissions: ${stats.submitCount}\nAccepted: ${stats.acCount}`
                : `${isoDate}\nNo submissions`;
              return (
                <span
                  key={dayIndex}
                  className={`heatmap-cell level-${level}`}
                  title={title}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="heatmap-legend">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={`heatmap-cell level-${level}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export default Heatmap;
