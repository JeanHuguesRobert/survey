import React from "react";

/**
 * GazetteLayout - A layout component for an 1820s French newspaper style.
 *
 * Features:
 * - Sepia/Paper texture background
 * - Serif fonts (Times New Roman, Garamond)
 * - Multi-column layout for content
 * - Classic header styling
 */
export default function GazetteLayout({
  children,
  title = "LA GAZETTE",
  subtitle = "Journal Politique et Littéraire",
  weeks = [],
  selectedWeek = null,
  onWeekChange = () => {},
}) {
  return (
    <div className="min-h-screen bg-[#f4e4bc] text-[#2c241b] font-serif p-4 md:p-8 overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Cinzel:wght@400;700;900&family=EB+Garamond:ital,wght@0,400;0,700;1,400&display=swap');

        .gazette-container {
          max-width: 1200px;
          margin: 0 auto;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
          background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E");
          padding: 2rem;
          border: 1px solid #d4c49c;
        }

        .gazette-header {
          text-align: center;
          border-bottom: 3px double #2c241b;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
        }

        .gazette-title {
          font-family: 'Cinzel', serif;
          font-size: 4rem;
          font-weight: 900;
          letter-spacing: 0.1em;
          line-height: 1;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
        }

        .gazette-subtitle {
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }

        .gazette-date-line {
          border-top: 1px solid #2c241b;
          border-bottom: 1px solid #2c241b;
          padding: 0.5rem 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: 'EB Garamond', serif;
          text-transform: uppercase;
          font-size: 0.9rem;
          letter-spacing: 0.05em;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .gazette-selector {
          background: transparent;
          border: none;
          font-family: 'EB Garamond', serif;
          font-size: 0.9rem;
          color: #2c241b;
          cursor: pointer;
          text-transform: uppercase;
          border-bottom: 1px dotted #2c241b;
          padding-bottom: 2px;
        }

        .gazette-selector:focus {
          outline: none;
          border-bottom: 1px solid #2c241b;
        }

        .gazette-content {
          column-count: 1;
        }

        @media (min-width: 768px) {
          .gazette-content {
            column-count: 2;
            column-gap: 2rem;
          }
        }

        @media (min-width: 1024px) {
          .gazette-content {
            column-count: 3;
            column-gap: 2rem;
          }
        }
      `}</style>

      <div className="gazette-container">
        <header className="gazette-header">
          <h1 className="gazette-title">{title}</h1>
          <div className="gazette-subtitle">{subtitle}</div>
          <div className="gazette-date-line">
            <div className="flex items-center gap-2">
              <span>Édition du :</span>
              {weeks.length > 0 ? (
                <select
                  className="gazette-selector"
                  value={selectedWeek || ""}
                  onChange={(e) => onWeekChange(Number(e.target.value))}
                >
                  {weeks.map((week) => (
                    <option key={week.timestamp} value={week.timestamp}>
                      {week.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span>
                  {new Date().toLocaleDateString("fr-FR", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
            <span>N° {Math.floor(Math.random() * 10000)}</span>
            <span>Prix: 5 Sous</span>
          </div>
        </header>

        <main className="gazette-content">{children}</main>
      </div>
    </div>
  );
}
