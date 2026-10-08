const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!open));
    navLinks.style.display = open ? '' : 'flex';
    navLinks.style.position = open ? '' : 'absolute';
    navLinks.style.top = open ? '' : '68px';
    navLinks.style.left = open ? '' : '0';
    navLinks.style.right = open ? '' : '0';
    navLinks.style.margin = open ? '' : '0';
    navLinks.style.padding = open ? '' : '18px 20px 22px';
    navLinks.style.flexDirection = open ? '' : 'column';
    navLinks.style.background = open ? '' : '#000';
    navLinks.style.borderBottom = open ? '' : '1px solid rgba(255,255,255,.08)';
  });
}

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    if (window.innerWidth <= 720 && navToggle) {
      navToggle.click();
    }
  });
});

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.code-panel');
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    panels.forEach(panel => panel.classList.toggle('active', panel.id === target));
  });
});

const copyText = async (text, button) => {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => button.textContent = original, 1200);
  } catch {
    button.textContent = 'Copy failed';
    setTimeout(() => button.textContent = 'Copy', 1200);
  }
};

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', () => copyText(button.dataset.copy, button));
});

const copyCode = document.querySelector('#copyCode');
if (copyCode) {
  copyCode.addEventListener('click', () => {
    const activePanel = document.querySelector('.code-panel.active');
    copyText(activePanel.innerText, copyCode);
  });
}

// Tiny ambient motion for a premium, subtle feel.
const commandCard = document.querySelector('.command-card');
if (commandCard && window.matchMedia('(pointer:fine)').matches) {
  window.addEventListener('pointermove', (event) => {
    const x = (event.clientX / window.innerWidth - 0.5) * 6;
    const y = (event.clientY / window.innerHeight - 0.5) * 4;
    commandCard.style.transform = `perspective(1000px) rotateY(${x - 8}deg) rotateX(${y + 4}deg)`;
  });
}
