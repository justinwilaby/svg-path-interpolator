let animationFrame;

function animatePaths(paths) {
  cancelAnimationFrame(animationFrame);
  const currentPath = paths.concat();
  const len = paths.length;
  const canvas = document.querySelectorAll('canvas');
  const rangeX = document.querySelector('#scaleX');
  const rangeY = document.querySelector('#scaleY');
  const fills = [ '#459641', '#1C6C87' ];
  let i = len;
  let ctx = canvas[0].getContext('2d');

  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let x;
  let y;
  while (i -= 2) {
    x = paths[i];
    y = paths[i - 1];
    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
  }
  rangeX.addEventListener('change', scaleX);
  rangeY.addEventListener('change', scaleY);
  i = 0;
  let k = 0;
  let translate = 10;
  let scaleXFactor = 0;
  let scaleYFactor = 0;

  function tick() {
    const j = i % len;
    if (j < 16) {
      canvas[k % 2].style.zIndex = '0';
      k++;
      canvas[k % 2].style.zIndex = '1';
      ctx = canvas[k % 2].getContext('2d');
      ctx.fillStyle = fills[k % 2];
      ctx.clearRect(0, 0, 1280, 900);
    }
    let x = currentPath[j] + translate;
    let y = currentPath[j + 1] + translate;
    x = x + (x * (x / maxX) * scaleXFactor);
    y = y + (y * (y / maxY) * scaleYFactor);
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
    i += 16;
    animationFrame = requestAnimationFrame(tick);
  }

  function scaleX(event) {
    scaleXFactor = event.target.value / 2;
    ctx.clearRect(0, 0, 1280, 900);
    i = 16;
  }

  function scaleY(event) {
    scaleYFactor = event.target.value / 2;
    ctx.clearRect(0, 0, 1280, 900);
    i = 16;
  }

  tick();
}
