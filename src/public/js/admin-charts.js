(() => {
  const data = window.__ADMIN_CHARTS__;
  if (!data || typeof Chart === 'undefined') return;

  const palette = {
    female: '#e11d48',
    male: '#0369a1',
  };

  const commonLegend = { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } };

  const byUserEl = document.getElementById('chartByUser');
  if (byUserEl) {
    new Chart(byUserEl, {
      type: 'bar',
      data: {
        labels: data.byUser.labels,
        datasets: [
          {
            label: 'Mujeres',
            data: data.byUser.female,
            backgroundColor: palette.female,
          },
          {
            label: 'Hombres',
            data: data.byUser.male,
            backgroundColor: palette.male,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: commonLegend },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  const genderEl = document.getElementById('chartGender');
  if (genderEl) {
    new Chart(genderEl, {
      type: 'doughnut',
      data: {
        labels: data.gender.labels,
        datasets: [
          {
            data: data.gender.values,
            backgroundColor: [palette.female, palette.male],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: commonLegend,
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0) || 1;
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return `${ctx.label}: ${ctx.raw} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
})();
