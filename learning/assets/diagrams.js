// Renders every <pre class="mermaid"> with the course palette.
// Requires the Mermaid UMD build to be loaded first (see HTML-ARTIFACTS.md).
mermaid.initialize({
  startOnLoad: true,
  theme: 'base',
  securityLevel: 'strict',
  flowchart: { wrappingWidth: 320 },
  themeVariables: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    primaryColor: '#e4f2f1',
    primaryBorderColor: '#145b5f',
    primaryTextColor: '#182025',
    lineColor: '#145b5f',
    secondaryColor: '#fff0dd',
    tertiaryColor: '#fbfaf6',
    noteBkgColor: '#fff0dd',
    noteBorderColor: '#8b4a14',
    actorBkg: '#e4f2f1',
    actorBorder: '#145b5f',
  },
});
