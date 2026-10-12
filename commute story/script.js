const story = document.querySelector('.story');
const panels = [...document.querySelectorAll('.panel')];
const dots = [...document.querySelectorAll('.dots a')];
const counter = document.querySelector('.counter span');
const progress = document.querySelector('.progress i');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentIndex = 0;
let locked = false;

function render(index) {
  currentIndex = Math.max(0, Math.min(panels.length - 1, index));
  const ratio = currentIndex / (panels.length - 1);
  progress.style.width = `${ratio * 100}%`;
  counter.textContent = String(currentIndex + 1).padStart(2, '0');
  document.body.classList.toggle('vehicle-mode', currentIndex >= 5);
  document.body.classList.toggle('cabin-mode', currentIndex >= 6);
  document.body.classList.toggle('arrival-mode', currentIndex >= 7);
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
    if (i === currentIndex) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
}

function goTo(index) {
  const next = Math.max(0, Math.min(panels.length - 1, index));
  if (next === currentIndex || locked) return;
  locked = true;
  render(next);
  story.scrollTo({ left: next * story.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
  window.setTimeout(() => { locked = false; }, reduceMotion ? 0 : 620);
}

story.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });

story.addEventListener('scroll', () => {
  if (locked) return;
  render(Math.round(story.scrollLeft / story.clientWidth));
}, { passive: true });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    goTo(currentIndex + 1);
  } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    event.preventDefault();
    goTo(currentIndex + 1);
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    event.preventDefault();
    goTo(currentIndex - 1);
  }
});

dots.forEach((dot, index) => dot.addEventListener('click', (event) => {
  event.preventDefault();
  locked = false;
  goTo(index);
}));

document.querySelector('.final-copy a').addEventListener('click', (event) => {
  event.preventDefault();
  locked = false;
  goTo(0);
});

render(0);
