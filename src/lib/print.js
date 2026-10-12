export function printSvg({ markup, width, height }) {
  document.querySelectorAll('.print-sheet, .print-page').forEach((el) => el.remove());
  const page = document.createElement('style');
  page.className = 'print-page';
  page.textContent = `@page { size: ${width}px ${height}px; margin: 0; }`;
  const sheet = document.createElement('div');
  sheet.className = 'print-sheet';
  sheet.innerHTML = markup;
  document.head.append(page);
  document.body.append(sheet);
  window.addEventListener(
    'afterprint',
    () => {
      page.remove();
      sheet.remove();
    },
    { once: true }
  );
  window.print();
}
