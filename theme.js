// Cache only appearance, never account details. The signed-in profile is authoritative.
(()=>{
  const apply=value=>{const theme=value==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;try{localStorage.setItem('pn-appearance',theme)}catch{}return theme};
  window.PocketNorthTheme={apply};
  let saved='light';try{saved=localStorage.getItem('pn-appearance')||'light'}catch{}
  apply(saved);
})();
