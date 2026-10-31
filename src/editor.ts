export const editorScript = String.raw`
(() => {
  if (!window.tinymce) return;
  window.tinymce.init({
    selector: '#content-editor',
    license_key: 'gpl',
    base_url: '/vendor/tinymce',
    suffix: '.min',
    height: 500,
    menubar: false,
    branding: false,
    promotion: false,
    resize: true,
    plugins: 'autolink code link lists table',
    toolbar: 'undo redo | blocks | bold italic underline strikethrough | bullist numlist blockquote | link table | removeformat code',
    toolbar_mode: 'sliding',
    content_css: '/vendor/tinymce/skins/content/default/content.min.css',
    content_security_policy: "default-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;",
    browser_spellcheck: true,
    contextmenu: false,
    link_default_target: '_blank',
    link_assume_external_targets: 'https',
    setup(editor) {
      editor.on('change input undo redo', () => editor.save());
    }
  });
})();
`;
