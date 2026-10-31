export const passwordVisibilityScript = String.raw`
(() => {
  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const wrapper = button.closest('[data-password-wrapper]');
      const input = wrapper?.querySelector('input');
      if (!(input instanceof HTMLInputElement)) return;
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.setAttribute('aria-label', visible ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
      button.setAttribute('aria-pressed', String(!visible));
      button.querySelector('[data-eye-open]')?.toggleAttribute('hidden', !visible);
      button.querySelector('[data-eye-off]')?.toggleAttribute('hidden', visible);
      input.focus();
    });
  });
})();
`;
