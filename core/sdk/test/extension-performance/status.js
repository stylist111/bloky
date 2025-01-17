document.addEventListener("DOMContentLoaded", () => {
  function getQueryStringParameter(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  const errorsParam = getQueryStringParameter("errors");

  const elem = document.getElementById("status");
  if (errorsParam) {
    elem.innerText = "Status: with errors";
    elem.setAttribute("errors", "true");

    const errors = errorsParam.split(";");
    const ul = document.createElement("ul");

    errors.forEach(error => {
      const li = document.createElement("li");
      li.textContent = error;
      ul.appendChild(li);
    });

    elem.appendChild(ul);
  }
  else {
    elem.innerText = "Status: all good!";
    elem.setAttribute("errors", "false");
  }
});
