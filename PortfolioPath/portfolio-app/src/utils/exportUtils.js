import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToCSV = (simulationResults, riskMetrics, portfolio, initialValue) => {
  if (!simulationResults || !riskMetrics) {
    alert('No simulation results to export');
    return;
  }

  let csv = 'PortfolioPath Pro - Simulation Results\n';
  csv += `Generated: ${new Date().toISOString()}\n\n`;

  // Portfolio composition
  csv += 'Portfolio Composition\n';
  csv += 'Ticker,Weight\n';
  portfolio.forEach(p => {
    csv += `${p.ticker},${(p.weight * 100).toFixed(2)}%\n`;
  });
  csv += `\nInitial Value,$${initialValue.toLocaleString()}\n\n`;

  // Risk metrics
  csv += 'Risk Metrics\n';
  csv += 'Metric,Value\n';
  csv += `Expected Return,${riskMetrics.mean.toFixed(2)}%\n`;
  csv += `Volatility,${riskMetrics.volatility.toFixed(2)}%\n`;
  csv += `Sharpe Ratio,${riskMetrics.sharpeRatio.toFixed(3)}\n`;
  csv += `VaR (95%),${riskMetrics.var95.toFixed(2)}%\n`;
  csv += `VaR (99%),${riskMetrics.var99.toFixed(2)}%\n`;
  csv += `Expected Shortfall,${riskMetrics.expectedShortfall.toFixed(2)}%\n`;
  csv += `Kurtosis,${riskMetrics.kurtosis.toFixed(2)}\n\n`;

  // Percentiles
  csv += 'Outcome Percentiles\n';
  csv += 'Percentile,Final Value,Return\n';
  const { percentiles } = riskMetrics;
  csv += `10th,$${percentiles.p10.toFixed(0)},${((percentiles.p10 - initialValue) / initialValue * 100).toFixed(2)}%\n`;
  csv += `25th,$${percentiles.p25.toFixed(0)},${((percentiles.p25 - initialValue) / initialValue * 100).toFixed(2)}%\n`;
  csv += `50th (Median),$${percentiles.p50.toFixed(0)},${((percentiles.p50 - initialValue) / initialValue * 100).toFixed(2)}%\n`;
  csv += `75th,$${percentiles.p75.toFixed(0)},${((percentiles.p75 - initialValue) / initialValue * 100).toFixed(2)}%\n`;
  csv += `90th,$${percentiles.p90.toFixed(0)},${((percentiles.p90 - initialValue) / initialValue * 100).toFixed(2)}%\n`;

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `portfoliopath_results_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

export const exportToPDF = (simulationResults, riskMetrics, portfolio, initialValue, fanChartData) => {
  if (!simulationResults || !riskMetrics) {
    alert('No simulation results to export');
    return;
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(225, 29, 72); // Rose color
  doc.text('PortfolioPath Pro', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text('Monte Carlo Simulation Report', pageWidth / 2, 28, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 35, { align: 'center' });

  // Portfolio Composition
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Portfolio Composition', 14, 50);
  
  const portfolioData = portfolio.map(p => [p.ticker, `${(p.weight * 100).toFixed(2)}%`]);
  portfolioData.push(['Total', '100.00%']);
  
  autoTable(doc, {
    startY: 55,
    head: [['Ticker', 'Weight']],
    body: portfolioData,
    theme: 'striped',
    headStyles: { fillColor: [225, 29, 72] },
    margin: { left: 14 },
    tableWidth: 80,
  });

  // Get the final Y position after the table
  let lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 100;

  // Initial Value
  doc.text(`Initial Investment: $${initialValue.toLocaleString()}`, 14, lastY + 10);

  // Risk Metrics
  const metricsY = lastY + 20;
  doc.setFontSize(14);
  doc.text('Risk Metrics', 14, metricsY);
  
  const metricsData = [
    ['Expected Return', `${riskMetrics.mean.toFixed(2)}%`],
    ['Volatility (Std Dev)', `${riskMetrics.volatility.toFixed(2)}%`],
    ['Sharpe Ratio', riskMetrics.sharpeRatio.toFixed(3)],
    ['Value at Risk (95%)', `${riskMetrics.var95.toFixed(2)}%`],
    ['Value at Risk (99%)', `${riskMetrics.var99.toFixed(2)}%`],
    ['Expected Shortfall', `${riskMetrics.expectedShortfall.toFixed(2)}%`],
    ['Kurtosis', riskMetrics.kurtosis.toFixed(2)],
  ];

  autoTable(doc, {
    startY: metricsY + 5,
    head: [['Metric', 'Value']],
    body: metricsData,
    theme: 'striped',
    headStyles: { fillColor: [225, 29, 72] },
    margin: { left: 14 },
    tableWidth: 100,
  });

  // Outcome Scenarios
  lastY = doc.lastAutoTable ? doc.lastAutoTable.finalY : metricsY + 80;
  const scenariosY = lastY + 15;
  doc.text('Outcome Scenarios', 14, scenariosY);
  
  const { percentiles } = riskMetrics;
  const scenariosData = [
    ['Worst Case (10th)', `$${percentiles.p10.toFixed(0)}`, `${((percentiles.p10 - initialValue) / initialValue * 100).toFixed(2)}%`],
    ['Below Average (25th)', `$${percentiles.p25.toFixed(0)}`, `${((percentiles.p25 - initialValue) / initialValue * 100).toFixed(2)}%`],
    ['Most Likely (50th)', `$${percentiles.p50.toFixed(0)}`, `${((percentiles.p50 - initialValue) / initialValue * 100).toFixed(2)}%`],
    ['Above Average (75th)', `$${percentiles.p75.toFixed(0)}`, `${((percentiles.p75 - initialValue) / initialValue * 100).toFixed(2)}%`],
    ['Best Case (90th)', `$${percentiles.p90.toFixed(0)}`, `${((percentiles.p90 - initialValue) / initialValue * 100).toFixed(2)}%`],
  ];

  autoTable(doc, {
    startY: scenariosY + 5,
    head: [['Scenario', 'Final Value', 'Return']],
    body: scenariosData,
    theme: 'striped',
    headStyles: { fillColor: [225, 29, 72] },
    margin: { left: 14 },
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('This report is for informational purposes only and does not constitute financial advice.', pageWidth / 2, 285, { align: 'center' });
  doc.text('Past performance does not guarantee future results. Monte Carlo simulations are probabilistic models.', pageWidth / 2, 290, { align: 'center' });

  // Save
  doc.save(`portfoliopath_report_${new Date().toISOString().split('T')[0]}.pdf`);
};
