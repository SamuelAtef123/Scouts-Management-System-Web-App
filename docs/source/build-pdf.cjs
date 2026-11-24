const { chromium } = require('playwright');
(async () => {
  const [src, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + src, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const left = await p.evaluate(() => document.querySelectorAll('i[data-lucide]').length);
  await p.pdf({
    path: out, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:7.5pt;color:#74778c;font-family:Arial;padding:0 15mm;display:flex;justify-content:space-between"><span>Scouts Management System · Project report and user guide</span><span class="pageNumber"></span></div>',
  });
  console.log('errors', errs, 'unreplaced icons', left);
  await b.close();
})();
