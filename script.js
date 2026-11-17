const pageInput = document.querySelector('#pageInput');
const thumbnails = [...document.querySelectorAll('.thumbnail')];
const zoomLevel = document.querySelector('#zoomLevel');
const paper = document.querySelector('#paper');
const findBar = document.querySelector('#findBar');
let page = 1;
let zoom = 100;

function setPage(nextPage) {
  page = Math.min(12, Math.max(1, nextPage));
  pageInput.value = page;
  thumbnails.forEach((thumbnail) => thumbnail.classList.toggle('active', Number(thumbnail.dataset.page) === page));
  document.querySelector('.paper-top span:last-child').textContent = page;
}

function setZoom(nextZoom) {
  zoom = Math.min(160, Math.max(60, nextZoom));
  zoomLevel.textContent = `${zoom}%`;
  paper.style.transform = `scale(${zoom / 100})`;
}

document.querySelector('#previousPage').addEventListener('click', () => setPage(page - 1));
document.querySelector('#nextPage').addEventListener('click', () => setPage(page + 1));
pageInput.addEventListener('change', () => setPage(Number(pageInput.value)));
thumbnails.forEach((thumbnail) => thumbnail.addEventListener('click', () => setPage(Number(thumbnail.dataset.page))));
document.querySelector('#zoomOut').addEventListener('click', () => setZoom(zoom - 10));
document.querySelector('#zoomIn').addEventListener('click', () => setZoom(zoom + 10));
document.querySelector('#sidebarToggle').addEventListener('click', () => document.querySelector('#thumbnails').classList.toggle('hidden'));
document.querySelector('#starButton').addEventListener('click', (event) => {
  const active = event.currentTarget.getAttribute('aria-pressed') === 'true';
  event.currentTarget.setAttribute('aria-pressed', String(!active));
  event.currentTarget.querySelector('span').textContent = active ? 'Star' : 'Starred';
  event.currentTarget.firstChild.textContent = active ? '☆ ' : '★ ';
});
document.querySelector('.breadcrumbs strong').addEventListener('dblclick', () => findBar.hidden = false);
document.querySelector('#closeFind').addEventListener('click', () => { findBar.hidden = true; });
document.querySelector('#findInput').addEventListener('input', (event) => {
  document.querySelector('#findResult').textContent = event.target.value ? '1 result' : '';
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') setPage(page + 1);
  if (event.key === 'ArrowLeft') setPage(page - 1);
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    findBar.hidden = false;
    document.querySelector('#findInput').focus();
  }
});
