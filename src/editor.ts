export const editorScript = String.raw`
(() => {
  const editor = document.querySelector('[data-editor]');
  const input = document.querySelector('[data-editor-input]');
  const form = editor?.closest('form');
  if (!(editor instanceof HTMLElement) || !(input instanceof HTMLTextAreaElement) || !(form instanceof HTMLFormElement)) return;

  const sync = () => { input.value = editor.innerHTML; };
  document.querySelectorAll('[data-command]').forEach((button) => {
    button.addEventListener('click', () => {
      const command = button.getAttribute('data-command');
      if (!command) return;
      editor.focus();
      if (command === 'createLink') {
        const url = window.prompt('Nhập URL liên kết (https://...)');
        if (url) document.execCommand(command, false, url);
      } else {
        document.execCommand(command, false);
      }
      sync();
    });
  });
  document.querySelector('[data-block]')?.addEventListener('change', (event) => {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    editor.focus();
    document.execCommand('formatBlock', false, select.value);
    sync();
  });
  editor.addEventListener('input', sync);
  form.addEventListener('submit', sync);
})();
`;
