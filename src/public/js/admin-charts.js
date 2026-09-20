(() => {
  const data = window.__ADMIN_CHARTS__;
  if (!data || typeof Chart === 'undefined') return;

  const palette = {
    female: '#e11d48',
    male: '#0369a1',
    brand: '#0f4c5c',
    accent: '#c44900',
    soft: '#1a7a6d',
  };

  const commonLegend = { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } };

  new Chart(document.getElementById('chartUserRealtime'), {
    type: 'bar',
    data: {
      labels: data.byUserRealtime.labels,
      datasets: [
        {
          label: 'Mujeres',
          data: data.byUserRealtime.female,
          backgroundColor: palette.female,
        },
        {
          label: 'Hombres',
          data: data.byUserRealtime.male,
          backgroundColor: palette.male,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: commonLegend },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  new Chart(document.getElementById('chartUserFinal'), {
    type: 'bar',
    data: {
      labels: data.byUserFinal.labels,
      datasets: [
        {
          label: 'Mujeres',
          data: data.byUserFinal.women,
          backgroundColor: palette.female,
        },
        {
          label: 'Hombres',
          data: data.byUserFinal.men,
          backgroundColor: palette.male,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: commonLegend },
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  new Chart(document.getElementById('chartGenderRealtime'), {
    type: 'doughnut',
    data: {
      labels: data.genderRealtime.labels,
      datasets: [
        {
          data: data.genderRealtime.values,
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

  new Chart(document.getElementById('chartGenderFinal'), {
    type: 'doughnut',
    data: {
      labels: data.genderFinal.labels,
      datasets: [
        {
          data: data.genderFinal.values,
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

  new Chart(document.getElementById('chartModes'), {
    type: 'bar',
    data: {
      labels: data.modeComparison.labels,
      datasets: [
        {
          label: 'Votos reportados',
          data: data.modeComparison.values,
          backgroundColor: [palette.soft, palette.accent],
          borderRadius: 8,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
})();
