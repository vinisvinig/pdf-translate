document.addEventListener("DOMContentLoaded", function () {
  const inputText = document.getElementById("inputText");
  const modeSelect = document.getElementById("modeSelect");
  const transformBtn = document.getElementById("transformBtn");
  const outputText = document.getElementById("outputText");

  transformBtn.addEventListener("click", function () {
    const text = inputText.value;
    const mode = modeSelect.value;
    let result = "";

    switch (mode) {
      case "uppercase":
        result = text.toUpperCase();
        break;
      case "lowercase":
        result = text.toLowerCase();
        break;
      case "capitalize":
        result = text
          .toLowerCase()
          .split(" ")
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        break;
      case "snake":
        result = text
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^\w_]/g, "");
        break;
      case "kebab":
        result = text
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w-]/g, "");
        break;
      case "reverse":
        result = text.split("").reverse().join("");
        break;
      case "remove-spaces":
        result = text.replace(/\s+/g, "");
        break;
      default:
        result = text;
    }

    outputText.textContent = result;
  });
});
