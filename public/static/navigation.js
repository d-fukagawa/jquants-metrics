(() => {
  const desktop = document.querySelector('.nav-desktop');
  const mobile = document.querySelector('.nav-menu');
  if (!desktop || !mobile) return;

  const groups = [...desktop.querySelectorAll('.nav-group')];
  const disclosures = [...groups, mobile];
  const mobileViewport = window.matchMedia('(max-width: 980px)');
  let lastFocusedNavigation = null;

  function close(disclosure, restoreFocus = false) {
    if (!disclosure.open) return;
    disclosure.open = false;
    if (restoreFocus) disclosure.querySelector('summary').focus();
  }

  // Native details keeps links usable even when this enhancement is unavailable.
  groups.forEach((group) => {
    group.addEventListener('toggle', () => {
      if (group.open) groups.forEach((other) => {
        if (other !== group) close(other);
      });
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = disclosures.find((disclosure) => disclosure.open);
    if (open) {
      event.preventDefault();
      close(open, true);
    }
  });

  document.addEventListener('click', (event) => {
    disclosures.forEach((disclosure) => {
      if (!disclosure.contains(event.target)) {
        close(disclosure, disclosure.contains(document.activeElement));
      }
    });
    if (!desktop.contains(event.target) && !mobile.contains(event.target)) {
      lastFocusedNavigation = null;
    }
  });

  [desktop, mobile].forEach((navigation) => {
    navigation.addEventListener('focusin', () => {
      lastFocusedNavigation = navigation;
    });
    navigation.addEventListener('focusout', (event) => {
      if (!navigation.contains(event.relatedTarget)) {
        (navigation === desktop ? groups : [mobile]).forEach((disclosure) => close(disclosure));
        // A hidden focused element can blur before resize fires. Keep its
        // navigation only for that null-target transition.
        if (event.relatedTarget) lastFocusedNavigation = null;
      }
    });
  });

  window.addEventListener('resize', () => {
    const focused = document.activeElement;
    const inDesktop = desktop.contains(focused) || lastFocusedNavigation === desktop;
    const inMobile = mobile.contains(focused) || lastFocusedNavigation === mobile;
    const group = groups.find((item) => item.contains(focused));
    disclosures.forEach((disclosure) => close(disclosure));
    if (mobileViewport.matches && inDesktop) {
      mobile.querySelector('summary').focus();
    } else if (!mobileViewport.matches && inMobile) {
      desktop.querySelector('a').focus();
    } else if (group) {
      group.querySelector('summary').focus();
    } else if (inMobile) {
      mobile.querySelector('summary').focus();
    }
  });
})();
