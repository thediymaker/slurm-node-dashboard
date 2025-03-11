document.addEventListener("DOMContentLoaded", function () {
  // Process code blocks to enhance terminal look
  document.querySelectorAll(".code-block code").forEach(function (codeElement) {
    // Add terminal code class
    codeElement.classList.add("terminal-code");

    // For config files or non-command blocks, remove the terminal prompt
    if (
      codeElement.textContent.includes("=") ||
      codeElement.textContent.includes("#SBATCH") ||
      codeElement.textContent.includes("<iframe") ||
      codeElement.textContent.includes("name:") ||
      codeElement.textContent.includes("PROMETHEUS_URL")
    ) {
      codeElement.classList.add("config-code");
    }
  });
});

function copyToClipboard(buttonElement) {
  const codeBlock = buttonElement.parentElement.querySelector("code");
  const text = codeBlock.textContent;

  navigator.clipboard
    .writeText(text)
    .then(() => {
      // Get success message element
      let successMsg =
        buttonElement.parentElement.querySelector(".copy-success");

      // Create one if it doesn't exist
      if (!successMsg) {
        successMsg = document.createElement("div");
        successMsg.className = "copy-success";
        successMsg.textContent = "Copied!";
        buttonElement.parentElement.appendChild(successMsg);
      }

      // Show success message
      successMsg.classList.add("visible");

      // Highlight the code block briefly
      codeBlock.parentElement.classList.add("copied");
      setTimeout(() => {
        codeBlock.parentElement.classList.remove("copied");
      }, 500);

      // Hide after 1.5 seconds
      setTimeout(() => {
        successMsg.classList.remove("visible");
      }, 1500);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
}
