var originPushState = window.history.pushState;
var originReplaceState = window.history.replaceState;

var getKey = function () {
  return decodeURIComponent(location.pathname);
};

var inject = function () {
  console.log(
    window.__CACHE_SCROLLTOP__ && window.__CACHE_SCROLLTOP__[getKey()],
  );
  if (window.__CACHE_SCROLLTOP__ && window.__CACHE_SCROLLTOP__[getKey()]) {
    document.documentElement.scrollTop = window.__CACHE_SCROLLTOP__[getKey()];
  }
};

var onscroll = function () {
  if (window.__CACHE_SCROLLTOP__ == null) {
    window.__CACHE_SCROLLTOP__ = {};
  }
  window.__CACHE_SCROLLTOP__[getKey()] = document.documentElement.scrollTop;
};

window.history.pushState = function () {
  originPushState.apply(this, arguments);
  inject();
};
window.history.replaceState = function () {
  originReplaceState.apply(this, arguments);
  inject();
};

if (!document.body.onscroll) {
  document.body.onscroll = onscroll;
}

window.addEventListener('DOMContentLoaded', onscroll);
