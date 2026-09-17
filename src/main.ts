import './styles.css';
import { App } from './core/App';

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function fail(message: string) {
  const enter = document.querySelector<HTMLButtonElement>('#enter');
  if (enter) {
    enter.disabled = true;
    enter.textContent = 'The garden could not open';
  }
  const note = document.querySelector<HTMLElement>('#resume-note');
  if (note) note.textContent = message;
}

if (!webglAvailable()) {
  fail('This browser cannot draw the garden (WebGL is unavailable). Try another browser or device.');
} else {
  try {
    new App();
  } catch (err) {
    console.error(err);
    fail('Something went wrong while building the garden. Reloading the page usually helps.');
  }
}
