export function mountComponent(container, component, props = {}) {
  container.innerHTML = component.render(props);
  return component.mount(container, props);
}

// Cargador universal: cada componente se procesa de forma independiente.
export function loadComponents(components) {
  components.forEach((component) => {
    loadComponent(component);
  });
}

// Cargador de componentes
function loadComponent({ id, render, init, optional = false }) {
  const container = document.getElementById(id);

  if (!container) {
    if (!optional) {
      console.warn(`[component-loader] No existe el contenedor #${id}.`);
    }
    return;
  }

  const setup = render || init;

  if (typeof setup !== 'function') {
    console.error(`[component-loader] El componente #${id} no tiene una función válida.`);
    return;
  }

  Promise.resolve()
    .then(() => setup(container))
    .catch((error) => {
      console.error(`[component-loader] Falló el componente #${id}.`, error);
    });
}
