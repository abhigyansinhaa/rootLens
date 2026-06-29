const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/features/analysis/tabs/DriversTab.tsx',
  'src/features/analysis/AnalysisResult.tsx',
  'src/components/kpi/TrustAccordion.tsx',
  'src/components/kpi/RiskSegmentsChart.tsx',
  'src/components/kpi/DriverImpactCard.tsx',
  'src/components/kpi/ConcentrationCallout.tsx'
];

const basePath = path.join(__dirname, 'src');

filesToFix.forEach(f => {
  const fullPath = path.join(__dirname, f);
  if (!fs.existsSync(fullPath)) return;

  let content = fs.readFileSync(fullPath, 'utf8');

  // Specific replacements to be safe
  if (f.includes('DriversTab')) {
    content = content.replace(
      /<div className="rounded-lg bg-\(--surface-1\) p-4" style={{ boxShadow: 'var\(--shadow-surface\)' }}>/g,
      '<div className="rounded-lg bg-(--surface-1) p-4 border border-(--border-subtle)">'
    );
  }
  if (f.includes('AnalysisResult')) {
    content = content.replace(
      /className="rounded-lg bg-\(--surface-1\) p-5 flex flex-col max-h-\[inherit\]"\s*style={{ boxShadow: 'var\(--shadow-surface\)' }}/g,
      'className="rounded-lg bg-(--surface-1) p-5 flex flex-col max-h-[inherit] border border-(--border-subtle)"'
    );
  }
  if (f.includes('TrustAccordion')) {
    content = content.replace(
      /className="w-full flex items-center justify-between gap-4 rounded-lg bg-\(--surface-1\) px-5 py-4 text-left transition-colors hover:bg-\(--surface-2\)"\s*style={{ boxShadow: 'var\(--shadow-surface\)' }}/g,
      'className="w-full flex items-center justify-between gap-4 rounded-lg bg-(--surface-1) border border-(--border-subtle) px-5 py-4 text-left transition-colors hover:bg-(--surface-2)"'
    );
  }
  if (f.includes('RiskSegmentsChart')) {
    content = content.replace(
      /className="rounded-lg bg-\(--surface-1\) p-6 overflow-hidden"\s*style={{ boxShadow: 'var\(--shadow-surface\)' }}/g,
      'className="rounded-lg bg-(--surface-1) p-6 overflow-hidden border border-(--border-subtle)"'
    );
  }
  if (f.includes('DriverImpactCard')) {
    content = content.replace(
      /<div className="rounded-lg bg-\(--surface-1\) overflow-hidden" style={{ boxShadow: 'var\(--shadow-surface\)' }}>/g,
      '<div className="rounded-lg bg-(--surface-1) overflow-hidden border border-(--border-subtle)">'
    );
  }
  if (f.includes('ConcentrationCallout')) {
    content = content.replace(
      /className="rounded-lg bg-\(--surface-1\) p-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between"\s*style={{ boxShadow: 'var\(--shadow-surface\)' }}/g,
      'className="rounded-lg bg-(--surface-1) p-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between border border-(--border-subtle)"'
    );
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`Fixed ${f}`);
});
